/**
 * Weekly scorecards: each person's week and their team's, and the company
 * report for admins. Built from the same numbers and the same visibility
 * rules as the scoreboard (restrict), so an email never carries more than
 * the person could see on the page: a knocker's has no profit and no other
 * team; only admins get the company.
 */

import { site } from "@/lib/site";
import { listMembers } from "@/lib/auth";
import {
  closerNotes,
  goalsFor,
  loadScoreboard,
  metricsFor,
  moneyOf,
  rankBy,
  restrict,
  roofsOf,
  seesProfit,
  setterNotes,
  teamOfRoof,
  type Period,
  type Scope,
} from "@/lib/scoreboard";
import { buildCompanyReport, buildPersonScorecard, type ScorecardRow } from "@/lib/emails";

const usd = (v: number | null | undefined) =>
  v == null ? "None yet" : v.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const n = (v: number) => Math.round(v).toLocaleString("en-US");
const pctOf = (a: number, b: number, min = 20) => (b >= min && b > 0 ? `${Math.round((a / b) * 100)}%` : "too few to rate");
function ordinal(k: number) {
  const s = ["th", "st", "nd", "rd"];
  const v = k % 100;
  return `${k}${s[(v - 20) % 10] || s[v] || s[0]}`;
}

export type Scorecard = {
  memberId: number;
  name: string;
  email: string;
  role: string;
  team: string | null;
  kind: "person" | "company";
  subject: string;
  html: string;
  /** Nothing happened for this person in the period. */
  quiet: boolean;
};

export async function buildScorecards(period: Period): Promise<{ ok: boolean; cards: Scorecard[] }> {
  const [data, members] = await Promise.all([loadScoreboard(period), listMembers()]);
  if (!data.ok) return { ok: false, cards: [] };
  const url = `${site.url}/admin/scoreboard`;
  const teams = data.now.teams;
  const cards: Scorecard[] = [];

  for (const m of members.filter((x) => x.active && x.email)) {
    const team = teams.find((t) => t.id === m.team_id) ?? null;

    /* Admins: the company report. */
    if (m.role === "admin") {
      const b = data.now;
      const money = moneyOf(b.roofs);
      const was = moneyOf(data.before.roofs);
      const teamOf = new Map(b.reps.map((r) => [r.who, r.team_id] as const));
      const teamRows: ScorecardRow[] = teams
        .map((t) => ({ t, m: moneyOf(b.roofs.filter((r) => teamOfRoof(r, teamOf) === t.id)) }))
        .sort((a, z) => (z.m.profitPerRoof ?? -1e12) - (a.m.profitPerRoof ?? -1e12) || (z.m.perRoof ?? 0) - (a.m.perRoof ?? 0))
        .map(({ t, m: tm }, i) => [
          `${i + 1}. ${t.name}`,
          tm.roofs
            ? `${tm.profitPerRoof != null ? `${usd(tm.profitPerRoof)} profit · ` : ""}${usd(tm.perRoof)} revenue a roof · ${tm.roofs} roof${tm.roofs === 1 ? "" : "s"}`
            : "No roofs",
        ]);
      const knockers = rankBy(b.reps, b.roofs, "setters", metricsFor("setters", true)[0])
        .filter((r) => r.knocks > 0 || r.sets > 0)
        .slice(0, 5)
        .map((r): ScorecardRow => [
          `${r.rank ?? "·"}. ${r.who}${r.team_id ? ` (${teams.find((t) => t.id === r.team_id)?.name ?? ""})` : ""}`,
          `${r.sets} set · ${n(r.knocks)} doors`,
        ]);
      const closers = rankBy(b.reps, b.roofs, "closers", metricsFor("closers", true)[0])
        .filter((r) => r.money.roofs > 0 || r.ran > 0)
        .slice(0, 5)
        .map((r): ScorecardRow => [
          `${r.rank ?? "·"}. ${r.who}${r.team_id ? ` (${teams.find((t) => t.id === r.team_id)?.name ?? ""})` : ""}`,
          `${usd(r.money.revenue)} · ${r.money.roofs} roof${r.money.roofs === 1 ? "" : "s"}`,
        ]);
      const led = money.profitPerRoof != null;
      const html = buildCompanyReport({
        span: period.span,
        key: money.roofs === 0 ? {
          label: "Roofs signed",
          value: "0",
          sub: `No roofs signed. ${n(b.team.knocks)} doors, ${b.team.sets} inspection${b.team.sets === 1 ? "" : "s"} set.`,
        } : {
          label: led ? "Profit per roof" : "Revenue per roof",
          value: usd(led ? money.profitPerRoof : money.perRoof),
          sub: `${money.roofs} roof${money.roofs === 1 ? "" : "s"} signed, ${usd(money.revenue)} revenue${
            led ? `, ${usd(money.perRoof)} revenue a roof${money.estimated ? `. ${money.estimated} roof${money.estimated === 1 ? "" : "s"} estimated until costs are in` : ""}` : ""
          }. The week before: ${usd(led ? was.profitPerRoof : was.perRoof)}.`,
        },
        rows: [
          ["Roofs signed", `${money.roofs}`, true],
          ["Revenue", usd(money.revenue)],
          ["Revenue per roof", usd(money.perRoof), true],
          ["Profit per roof", money.profitPerRoof != null ? usd(money.profitPerRoof) : "Costs not in yet", true],
          ["Margin", money.margin != null ? `${Math.round(money.margin * 100)}%` : "None yet"],
          ["Doors", n(b.team.knocks)],
          ["Talked", `${n(b.team.talked)} (${pctOf(b.team.talked, b.team.knocks)})`],
          ["Inspections set", `${b.team.sets}`],
          ["Inspected", `${b.team.held}, damage on ${b.team.damage}`],
        ],
        teams: teamRows,
        knockers,
        closers,
        url,
      });
      cards.push({
        memberId: m.id,
        name: m.name,
        email: m.email,
        role: m.role,
        team: null,
        kind: "company",
        subject: money.roofs
          ? `Company report, ${period.span}: ${usd(led ? money.profitPerRoof : money.perRoof)} ${led ? "profit" : "revenue"} per roof`
          : `Company report, ${period.span}: no roofs signed`,
        html,
        quiet: false,
      });
      continue;
    }

    /* Everyone else: their week and their team's. */
    const scope: Scope = team ? { kind: "team", id: team.id, name: team.name } : { kind: "self" };
    const showProfit = seesProfit(m.role);
    const b = restrict(data.now, scope, m.name, showProfit);
    const me = b.reps.find((r) => r.who === m.name);
    if (!me) continue;
    const g = goalsFor(me, { ...period, weekFactor: 1, monthFactor: 7 / 30.4 });
    const knocker = m.role === "setter" || (m.role === "rep" && me.knocks > 0);
    const setters = rankBy(b.reps, b.roofs, "setters", metricsFor("setters", showProfit)[0]);
    const closers = rankBy(b.reps, b.roofs, "closers", metricsFor("closers", showProfit)[0]);
    const mineS = setters.find((r) => r.who === m.name);
    const mineC = closers.find((r) => r.who === m.name);
    const setM = moneyOf(roofsOf(m.name, b.roofs, "setters"));
    const closeM = moneyOf(roofsOf(m.name, b.roofs, "closers"));
    const teamM = moneyOf(b.roofs);
    const where = team ? ` on ${team.name}` : "";
    const quiet = me.knocks === 0 && me.sets === 0 && me.ran === 0 && closeM.roofs === 0;

    let headline: string;
    let key: { label: string; value: string; sub?: string };
    let mine: ScorecardRow[];
    let subject: string;
    if (knocker) {
      headline = quiet
        ? "No doors on the board last week."
        : `You were ${ordinal(mineS?.rank ?? setters.length)} of ${setters.length} knocker${setters.length === 1 ? "" : "s"}${where}.`;
      key = {
        label: "Inspections set",
        value: `${me.sets}`,
        sub: `Goal ${g.sets} · ${n(me.knocks)} doors · ${pctOf(me.talked, me.knocks)} talked`,
      };
      mine = [
        ["Doors", `${n(me.knocks)} of ${n(g.knocks)}`, true],
        ["Talked", `${n(me.talked)} (${pctOf(me.talked, me.knocks)})`],
        ["Inspections set", `${me.sets} of ${g.sets}`, true],
        ["Sets per 100 doors", me.knocks >= 20 ? ((me.sets / me.knocks) * 100).toFixed(1) : "too few to rate"],
        ["Roofs from your doors", `${setM.roofs}`],
        ["Revenue from your doors", usd(setM.revenue)],
        me.come_backs_late ? ["Come-backs past due", `${me.come_backs_late}`, true] : false,
      ].filter(Boolean) as ScorecardRow[];
      subject = quiet ? `Your week, ${period.span}` : `Your week: ${me.sets} set, ${ordinal(mineS?.rank ?? 0)}${where}`;
    } else {
      headline = quiet
        ? "No inspections on the board last week."
        : `You were ${ordinal(mineC?.rank ?? closers.length)} of ${closers.length} closer${closers.length === 1 ? "" : "s"}${where}.`;
      key = {
        label: "Revenue per roof",
        value: usd(closeM.perRoof ?? 0),
        sub: `${closeM.roofs} roof${closeM.roofs === 1 ? "" : "s"} · ${usd(closeM.revenue)} revenue${
          showProfit && closeM.profitPerRoof != null ? ` · ${usd(closeM.profitPerRoof)} profit a roof${closeM.estimated ? " (estimated)" : ""}` : ""
        }`,
      };
      mine = [
        ["Inspections run", `${me.ran}`],
        ["Damage found", `${me.damage}`],
        ["Roofs signed", `${closeM.roofs}`, true],
        ["Revenue", `${usd(closeM.revenue)} of ${usd(g.signed)}`, true],
        ["Revenue per roof", usd(closeM.perRoof)],
        showProfit ? ["Profit per roof", closeM.profitPerRoof != null ? usd(closeM.profitPerRoof) : "Costs not in yet"] : false,
        ["Close rate", pctOf(me.signed, me.damage, 3)],
      ].filter(Boolean) as ScorecardRow[];
      subject = quiet ? `Your week, ${period.span}` : `Your week: ${closeM.roofs} roof${closeM.roofs === 1 ? "" : "s"}, ${usd(closeM.perRoof)} a roof`;
    }

    const notes = knocker ? setterNotes(me, b.reps) : closerNotes(me, b.reps);
    const gap = notes.find((x) => x.tone !== "good");

    const html = buildPersonScorecard({
      firstName: m.name.split(" ")[0],
      span: period.span,
      headline,
      key,
      mine,
      note: gap?.text ?? null,
      team: team
        ? {
            name: team.name,
            rows: [
              ["Roofs signed", `${teamM.roofs}`, true],
              ["Revenue per roof", usd(teamM.perRoof), true],
              showProfit ? ["Profit per roof", teamM.profitPerRoof != null ? usd(teamM.profitPerRoof) : "Costs not in yet"] : false,
              ["Doors", n(b.team.knocks)],
              ["Inspections set", `${b.team.sets}`],
            ].filter(Boolean) as ScorecardRow[],
            ranking: setters
              .filter((r) => r.knocks > 0 || r.sets > 0)
              .map((r): ScorecardRow => [`${r.rank ?? "·"}. ${r.who === m.name ? "You" : r.who}`, `${r.sets} set · ${n(r.knocks)} doors`, r.who === m.name]),
          }
        : null,
      url,
    });
    cards.push({ memberId: m.id, name: m.name, email: m.email, role: m.role, team: team?.name ?? null, kind: "person", subject, html, quiet });
  }
  return { ok: true, cards };
}
