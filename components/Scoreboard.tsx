import Link from "next/link";
import { moneyShort } from "@/lib/money";
import {
  PERIODS,
  DEFAULT_GOALS,
  HAIL_BANDS,
  MIN_DOORS_FOR_RATE,
  closerNotes,
  fmtMetric,
  goalsFor,
  isCloserRow,
  isSetterRow,
  metricsFor,
  moneyOf,
  paceFraction,
  pct,
  rankBy,
  recordsFor,
  roofsOf,
  setterNotes,
  teamOfRoof,
  type Board,
  type DayRow,
  type Metric,
  type MetricKey,
  type Money,
  type Note,
  type Period,
  type RankedRow,
  type RepRow,
  type Scope,
  type TeamRef,
} from "@/lib/scoreboard";

/**
 * The scoreboard page body. Pure: data in, markup out, so the page, the
 * meeting view and the sample-data preview render the same thing.
 *
 * The data arriving here has already been cut to what this viewer may see
 * (lib/scoreboard.ts restrict): a knocker's page never carries another team
 * or a profit figure, so nothing below has to hide anything.
 *
 * Design: revenue and profit per roof lead, because they are the company's
 * chief numbers. Then you, your team, the board, and the coaching. Hairlines
 * instead of boxes; every control is a plain link, so any view can be shared.
 */

type BoardKey = "setters" | "closers";

export type ScoreboardProps = {
  period: Period;
  now: Board;
  before: Board;
  days: DayRow[];
  me: { name: string; role: string };
  scope: Scope;
  /** Admins: every team, for the scope switcher. Empty for everyone else. */
  allTeams: TeamRef[];
  board: BoardKey;
  rank: MetricKey | null;
  /** "team", or a person's name. */
  focus: string;
  showProfit: boolean;
  isAdmin: boolean;
  basePath: string;
  nowMs: number;
  loadFailed?: boolean;
  present?: boolean;
  /** Admin-only extras the page renders (the profit estimate form). */
  footer?: React.ReactNode;
};

const GREEN = "#0c7a40";

const n = (v: number) => Math.round(v).toLocaleString("en-US");
const usd = (v: number | null | undefined) =>
  v == null ? null : v.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
/** 75000 -> "$75k", 17500 -> "$17.5k". For goals beside a full number. */
const kMoney = (v: number) => (v >= 1000 ? `$${Number((v / 1000).toFixed(1))}k` : moneyShort(v));

function ordinal(k: number) {
  const s = ["th", "st", "nd", "rd"];
  const v = k % 100;
  return `${k}${s[(v - 20) % 10] || s[v] || s[0]}`;
}

function ago(iso: string, nowMs: number) {
  const mins = Math.round((nowMs - new Date(iso).getTime()) / 60000);
  if (mins < 2) return "just now";
  if (mins < 60) return `${mins}m ago`;
  if (mins < 60 * 18) return `${Math.round(mins / 60)}h ago`;
  return new Date(iso).toLocaleDateString("en-US", { timeZone: "America/Chicago", month: "short", day: "numeric" });
}

/** "8551 S Meditteranean, Dallas" -> "S Meditteranean". The street, not the house. */
function street(address: string | null) {
  const line = String(address || "").split(",")[0].trim();
  return line.replace(/^\d+[A-Z]?\s+/i, "");
}

const firstName = (who: string) => who.split(" ")[0];

export function scopeLabel(scope: Scope) {
  return scope.kind === "company" ? "Company" : scope.kind === "team" ? scope.name : "You";
}

/* ---------------------------------------------------------------- pieces */

function Delta({ now, before, label, money = false }: { now: number | null; before: number | null; label: string; money?: boolean }) {
  if (now == null || before == null || (now === 0 && before === 0)) return <span className="text-gray-400">&nbsp;</span>;
  const d = now - before;
  const shown = money ? usd(Math.abs(d)) : n(Math.abs(d));
  return (
    <span className={d > 0 ? "text-[#0c7a40]" : "text-gray-500"} title={`${money ? usd(before) : n(before)} at ${label}`}>
      {d > 0 ? "+" : d < 0 ? "−" : "±"}
      {shown}
    </span>
  );
}

function GoalBar({
  label,
  value,
  goal,
  pace,
  format = n,
  unit,
}: {
  label: string;
  value: number;
  goal: number;
  pace: number;
  format?: (v: number) => string;
  unit: string;
}) {
  const fill = Math.min(100, (value / goal) * 100);
  const expected = goal * pace;
  const done = value >= goal;
  const behind = Math.ceil(expected - value);
  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 text-sm">
        <span className="text-gray-600">{label}</span>
        <span>
          <strong className="text-[#0b0e13]">{format(value)}</strong>
          <span className="text-gray-500"> of {format(goal)}</span>
          <span className={`ml-2 text-xs font-semibold ${done || behind <= 0 ? "text-[#0c7a40]" : "text-[#b54708]"}`}>
            {done ? "Goal met" : behind <= 0 ? "On pace" : `${format(behind)}${unit ? ` ${unit}` : ""} behind pace`}
          </span>
        </span>
      </div>
      <div className="relative mt-1.5 h-2 rounded-full bg-[#eceef1]" role="img" aria-label={`${format(value)} of ${format(goal)}`}>
        <div className="h-2 rounded-full" style={{ width: `${fill}%`, background: GREEN }} />
        {!done && pace > 0 && pace < 1 ? (
          <div className="absolute -top-1 h-4 w-0.5 rounded bg-[#0b0e13]/40" style={{ left: `${pace * 100}%` }} title="Where you'd be on pace" />
        ) : null}
      </div>
    </div>
  );
}

function NoteLine({ note }: { note: Note }) {
  const dot = note.tone === "good" ? GREEN : note.tone === "owed" ? "#c2410c" : "#b54708";
  return (
    <li className="flex gap-2.5 text-sm leading-relaxed text-[#3b424e]">
      <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: dot }} />
      <span>
        {note.text}
        {note.href ? (
          <>
            {" "}
            <Link href={note.href} className="font-semibold text-[#0c7a40] underline-offset-2 hover:underline">
              {note.link}
            </Link>
          </>
        ) : null}
      </span>
    </li>
  );
}

function SectionHead({ title, sub, id, right }: { title: string; sub?: string; id?: string; right?: React.ReactNode }) {
  return (
    <div id={id} className="flex scroll-mt-20 flex-wrap items-end justify-between gap-x-4 gap-y-2">
      <div>
        <h2 className="font-display text-lg font-bold text-[#0b0e13]">{title}</h2>
        {sub ? <p className="text-sm text-gray-500">{sub}</p> : null}
      </div>
      {right}
    </div>
  );
}

function Chips({ items, small = false }: { items: Array<{ label: string; href: string; on: boolean }>; small?: boolean }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((c) => (
        <Link
          key={c.label + c.href}
          href={c.href}
          scroll={false}
          className={`rounded-full font-semibold ${small ? "px-2.5 py-1 text-xs" : "px-3 py-1.5 text-sm"} ${
            c.on ? "bg-[#0b0e13] text-white" : "border border-[#d7dbe0] bg-white text-[#3b424e] hover:border-[#0b0e13]"
          }`}
        >
          {c.label}
        </Link>
      ))}
    </div>
  );
}

/* ------------------------------------------------- revenue and profit per roof */

function MoneyBlock({
  m,
  was,
  showProfit,
  versus,
  isAdmin,
  estimatesSet,
  big = false,
}: {
  m: Money;
  was: Money;
  showProfit: boolean;
  versus: string;
  isAdmin: boolean;
  estimatesSet: boolean;
  big?: boolean;
}) {
  const head = big ? "text-6xl" : "text-4xl";
  const missing = m.roofs - m.profitRoofs;
  return (
    <div className={`rounded-lg border border-[#e3e6ea] bg-white ${big ? "p-8" : "p-5"}`}>
      <div className="flex flex-wrap gap-x-12 gap-y-5">
        <div>
          <div className="text-sm font-semibold text-gray-500">Revenue per roof</div>
          <div className={`mt-1 font-display font-extrabold tabular-nums text-[#0b0e13] ${head}`}>{usd(m.perRoof) ?? "$0"}</div>
          <div className="mt-1 text-xs tabular-nums">
            <Delta now={m.perRoof} before={was.perRoof} label={versus} money />
          </div>
        </div>
        {showProfit ? (
          <div>
            <div className="text-sm font-semibold text-gray-500">
              Profit per roof{m.estimated ? <span className="font-normal text-gray-400"> · {m.estimated === m.profitRoofs ? "estimated" : "part estimated"}</span> : null}
            </div>
            <div className={`mt-1 font-display font-extrabold tabular-nums ${head}`} style={{ color: GREEN }}>
              {m.profitPerRoof != null ? usd(m.profitPerRoof) : <span className="text-gray-300">Not in yet</span>}
            </div>
            <div className="mt-1 text-xs tabular-nums">
              <Delta now={m.profitPerRoof} before={was.profitPerRoof} label={versus} money />
            </div>
          </div>
        ) : null}
        <dl className={`flex flex-wrap gap-x-8 gap-y-3 self-end ${big ? "text-lg" : "text-sm"}`}>
          <div>
            <dt className="text-gray-500">Roofs signed</dt>
            <dd className="font-semibold tabular-nums text-[#0b0e13]">{n(m.roofs)}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Revenue</dt>
            <dd className="font-semibold tabular-nums text-[#0b0e13]">{usd(m.revenue)}</dd>
          </div>
          {showProfit ? (
            <>
              <div>
                <dt className="text-gray-500">Profit</dt>
                <dd className="font-semibold tabular-nums text-[#0b0e13]">{m.profitRoofs ? usd(m.profit) : "·"}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Margin</dt>
                <dd className="font-semibold tabular-nums text-[#0b0e13]">{m.margin != null ? `${Math.round(m.margin * 100)}%` : "·"}</dd>
              </div>
            </>
          ) : null}
        </dl>
      </div>
      {showProfit && m.roofs > 0 && !big ? (
        <p className="mt-4 border-t border-[#eceef1] pt-3 text-xs text-gray-500">
          Profit from {m.profitRoofs} of {m.roofs} roof{m.roofs === 1 ? "" : "s"}
          {m.estimated ? `, ${m.estimated} estimated until the job's costs are entered` : ""}.
          {missing > 0
            ? isAdmin
              ? estimatesSet
                ? ` ${missing} ${missing === 1 ? "has" : "have"} no squares to estimate from; enter costs on the job.`
                : ` ${missing} ${missing === 1 ? "has" : "have"} no costs yet. Set the estimate rates at the bottom of this page, or enter costs on each job.`
              : ` ${missing} still ${missing === 1 ? "needs" : "need"} costs from the office.`
            : ""}
        </p>
      ) : null}
    </div>
  );
}

/* ---------------------------------------------------------- teams (admin) */

function TeamsTable({ board, href, showProfit }: { board: Board; href: (team: string) => string; showProfit: boolean }) {
  const teamOf = new Map(board.reps.map((r) => [r.who, r.team_id] as const));
  const groups: Array<{ id: number | null; name: string }> = [
    ...board.teams.map((t) => ({ id: t.id as number | null, name: t.name })),
    { id: null, name: "No team" },
  ];
  const rows = groups
    .map((g) => {
      const reps = board.reps.filter((r) => r.team_id === g.id);
      const roofs = board.roofs.filter((r) => teamOfRoof(r, teamOf) === g.id);
      const m = moneyOf(roofs);
      const sum = (k: keyof RepRow) => reps.reduce((t, r) => t + Number(r[k] || 0), 0);
      return { ...g, people: reps.filter((r) => r.active).length, m, knocks: sum("knocks"), sets: sum("sets"), damage: sum("damage"), signed: sum("signed") };
    })
    .filter((r) => r.id !== null || r.knocks > 0 || r.m.roofs > 0)
    .sort((a, b) => (b.m.profitPerRoof ?? -1e12) - (a.m.profitPerRoof ?? -1e12) || (b.m.perRoof ?? 0) - (a.m.perRoof ?? 0));

  if (board.teams.length === 0) {
    return (
      <p className="mt-3 rounded-lg border border-dashed border-gray-300 bg-white p-5 text-sm text-gray-600">
        No teams yet. Create them on the{" "}
        <Link href="/admin/team#teams" className="font-semibold text-[#0c7a40] underline">
          Team page
        </Link>{" "}
        (a closer and the knockers who feed them), and each team gets its own board here.
      </p>
    );
  }
  const th = "px-3 py-2 text-right text-xs font-semibold text-gray-500";
  const td = "px-3 py-3 text-right tabular-nums text-[#3b424e]";
  return (
    <div className="mt-3 overflow-x-auto rounded-lg border border-[#e3e6ea] bg-white">
      <table className="w-full min-w-[44rem] text-sm">
        <thead>
          <tr className="border-b border-[#eceef1]">
            <th className="w-8 px-3 py-2 text-left text-xs font-semibold text-gray-500">#</th>
            <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">Team</th>
            {showProfit ? <th className={th}>Profit / roof</th> : null}
            <th className={th}>Revenue / roof</th>
            <th className={th}>Roofs</th>
            <th className={th}>Revenue</th>
            {showProfit ? <th className={th}>Margin</th> : null}
            <th className={th}>Doors</th>
            <th className={th}>Set</th>
            <th className={th}>Close</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={String(r.id)} className="border-b border-[#f0f1f3] last:border-0">
              <td className="px-3 py-3 font-display font-extrabold text-gray-400">{r.id === null ? "" : i + 1}</td>
              <td className="px-3 py-3">
                {r.id === null ? (
                  <span className="text-gray-500">{r.name}</span>
                ) : (
                  <Link href={href(String(r.id))} className="font-semibold text-[#0b0e13] hover:underline">
                    {r.name}
                  </Link>
                )}
                <span className="ml-1.5 text-xs text-gray-400">{r.people} people</span>
              </td>
              {showProfit ? <td className={`${td} font-semibold text-[#0b0e13]`}>{usd(r.m.profitPerRoof) ?? "·"}</td> : null}
              <td className={td}>{usd(r.m.perRoof) ?? "·"}</td>
              <td className={td}>{r.m.roofs}</td>
              <td className={td}>{usd(r.m.revenue)}</td>
              {showProfit ? <td className={td}>{r.m.margin != null ? `${Math.round(r.m.margin * 100)}%` : "·"}</td> : null}
              <td className={td}>{n(r.knocks)}</td>
              <td className={td}>{r.sets}</td>
              <td className={td}>{r.damage >= 3 ? `${Math.round((r.signed / r.damage) * 100)}%` : "·"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ------------------------------------------------------------ leaderboard */

function Leaderboard({
  rows,
  metrics,
  metric,
  board,
  me,
  period,
  prevBy,
  rankHref,
  personHref,
}: {
  rows: RankedRow[];
  metrics: Metric[];
  metric: Metric;
  board: BoardKey;
  me: string;
  period: Period;
  prevBy: Map<string, number | null>;
  rankHref: (k: MetricKey) => string;
  personHref: (who: string) => string;
}) {
  const goalMetric = metrics[0];
  const rest = metrics.slice(1);
  const cols = `2rem minmax(9rem,1.4fr) minmax(8rem,1.2fr) repeat(${rest.length}, minmax(4.5rem,1fr))`;
  const value = (r: RankedRow, m: Metric) => fmtMetric(m, m.value(r, r.money));

  return (
    <div className="mt-3 overflow-hidden rounded-lg border border-[#e3e6ea] bg-white">
      <div className="sm:overflow-x-auto">
        <div className="sm:min-w-[52rem]">
          {/* Headers: each one ranks the board by itself. */}
          <div
            className="hidden items-end gap-x-3 border-b border-[#eceef1] px-4 py-2 text-xs font-semibold text-gray-500 sm:grid"
            style={{ gridTemplateColumns: cols }}
          >
            <span>#</span>
            <span>Name</span>
            {[goalMetric, ...rest].map((m, i) => (
              <Link
                key={m.key}
                href={rankHref(m.key)}
                scroll={false}
                title={`Rank by ${m.label.toLowerCase()}`}
                className={`${i === 0 ? "text-left" : "text-right"} hover:text-[#0b0e13] ${m.key === metric.key ? "text-[#0b0e13] underline decoration-2 underline-offset-4" : ""}`}
              >
                {m.short}
              </Link>
            ))}
          </div>
          <ol>
            {rows.map((r) => {
              const you = r.who === me;
              const g = goalsFor(r, period);
              const goalVal = goalMetric.value(r, r.money) ?? 0;
              const goal = board === "setters" ? g.sets : g.signed;
              const fill = Math.min(100, (goalVal / goal) * 100);
              const was = prevBy.get(r.who) ?? null;
              const cur = r.metric;
              return (
                <li
                  key={r.who}
                  className={`border-b border-[#f0f1f3] px-4 py-3 last:border-0 ${you ? "bg-[#f3faf6]" : ""}`}
                >
                  {/* Phone: rank, name, the ranked number; the rest on one line. */}
                  <div className="grid grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-x-3 sm:hidden">
                    <span className={`font-display font-extrabold tabular-nums ${r.rank === 1 ? "text-[#0c7a40]" : "text-gray-400"}`}>{r.rank ?? "·"}</span>
                    <div className="min-w-0">
                      <Link href={personHref(r.who)} scroll={false} className="font-semibold text-[#0b0e13]">
                        {r.who}
                      </Link>
                      {you ? <span className="ml-1.5 text-xs font-semibold text-[#0c7a40]">You</span> : null}
                      <div className="text-xs leading-snug text-gray-500">
                        {metrics
                          .filter((m) => m.key !== metric.key)
                          .slice(0, 3)
                          .map((m) => {
                            const v = value(r, m);
                            return v ? `${v} ${m.short.toLowerCase()}` : null;
                          })
                          .filter(Boolean)
                          .join(" · ")}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-display font-extrabold tabular-nums text-[#0b0e13]">{value(r, metric) ?? <span className="text-gray-300">·</span>}</div>
                      <div className="text-[11px] text-gray-400">{metric.short}</div>
                    </div>
                  </div>

                  {/* Wider: every metric in a column. */}
                  <div className="hidden items-center gap-x-3 sm:grid" style={{ gridTemplateColumns: cols }}>
                    <span className={`font-display text-base font-extrabold tabular-nums ${r.rank === 1 ? "text-[#0c7a40]" : "text-gray-400"}`}>{r.rank ?? "·"}</span>
                    <div className="min-w-0 truncate">
                      <Link href={personHref(r.who)} scroll={false} className="font-semibold text-[#0b0e13] hover:underline">
                        {r.who}
                      </Link>
                      {you ? <span className="ml-1.5 text-xs font-semibold text-[#0c7a40]">You</span> : null}
                      {!r.active ? <span className="ml-1.5 text-xs text-gray-400">off the team</span> : null}
                    </div>
                    <div>
                      <div className="flex items-baseline gap-1.5">
                        <span className={`font-display text-base font-extrabold tabular-nums ${goalMetric.key === metric.key ? "text-[#0b0e13]" : "text-[#3b424e]"}`}>
                          {value(r, goalMetric) ?? "0"}
                        </span>
                        <span className="text-xs text-gray-400">of {board === "setters" ? n(goal) : kMoney(goal)}</span>
                        {cur != null && was != null && cur !== was ? (
                          <span className={`text-xs ${cur > was ? "text-[#0c7a40]" : "text-gray-400"}`} title={period.versus}>
                            {cur > was ? "↑" : "↓"}
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-1 h-1.5 w-full max-w-[9rem] rounded-full bg-[#eceef1]">
                        <div className="h-1.5 rounded-full" style={{ width: `${fill}%`, background: GREEN }} />
                      </div>
                    </div>
                    {rest.map((m) => (
                      <span
                        key={m.key}
                        className={`text-right tabular-nums ${m.key === metric.key ? "font-semibold text-[#0b0e13]" : "text-[#3b424e]"}`}
                      >
                        {value(r, m) ?? <span className="text-gray-300">·</span>}
                      </span>
                    ))}
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------- page */

export function Scoreboard(props: ScoreboardProps) {
  const { period, now, before, days, me, scope, allTeams, board, focus, showProfit, isAdmin, basePath, nowMs } = props;

  const href = (o: Partial<{ p: string; team: string; board: string; rank: string; who: string; present: string }>, hash = "") => {
    const q = new URLSearchParams();
    const p = o.p ?? period.key;
    if (p !== "week") q.set("p", p);
    const team = o.team ?? (isAdmin && scope.kind === "team" ? String(scope.id) : "");
    if (isAdmin && team && team !== "company") q.set("team", team);
    const b = o.board ?? board;
    if (b !== "setters") q.set("board", b);
    const rk = o.rank ?? props.rank ?? "";
    if (rk) q.set("rank", rk);
    // Always carry whose coaching is open, "team" included: with no
    // parameter the page opens on your own.
    const w = o.who ?? focus;
    if (w) q.set("who", w);
    const pr = o.present ?? (props.present ? "1" : "");
    if (pr === "1") q.set("present", "1");
    const s = q.toString();
    return `${basePath}${s ? `?${s}` : ""}${hash}`;
  };

  const pace = paceFraction(period, new Date(nowMs));
  const metrics = metricsFor(board, showProfit);
  const metric = metrics.find((m) => m.key === props.rank) ?? metrics[0];
  const rows = rankBy(now.reps, now.roofs, board, metric);
  const prevRows = rankBy(before.reps, before.roofs, board, metric);
  const prevBy = new Map(prevRows.map((r) => [r.who, r.metric] as const));
  const setterRows = rankBy(now.reps, now.roofs, "setters", metricsFor("setters", showProfit)[0]);
  const closerRows = rankBy(now.reps, now.roofs, "closers", metricsFor("closers", showProfit)[0]);
  const mine = now.reps.find((r) => r.who === me.name);
  const mySetter = setterRows.find((r) => r.who === me.name);
  const myCloser = closerRows.find((r) => r.who === me.name);
  const myActive = !!mine && (mine.knocks > 0 || mine.sets > 0 || mine.ran > 0 || mine.signed > 0);
  const showYou = !!mine && !!(mySetter || myCloser) && (me.role !== "admin" || myActive);

  const money = moneyOf(now.roofs);
  const moneyWas = moneyOf(before.roofs);
  const estimatesSet = now.settings.est_cost_per_square != null;
  const label = scopeLabel(scope);

  /* The funnel, door to signature. */
  const t = now.team;
  const b = before.team;
  const steps: Array<{ label: string; v: number; was: number; of?: string; sub?: string }> = [
    { label: "Doors", v: t.knocks, was: b.knocks },
    { label: "Talked", v: t.talked, was: b.talked, of: pct(t.talked, t.knocks) ?? undefined, sub: "of doors" },
    {
      label: "Inspections set",
      v: t.sets,
      was: b.sets,
      of: t.talked >= MIN_DOORS_FOR_RATE ? `${n(((t.sets - t.web_sets) / t.talked) * 100)}%` : undefined,
      sub: "of talks",
    },
    { label: "Inspected", v: t.held, was: b.held },
    { label: "Damage found", v: t.damage, was: b.damage, of: pct(t.damage, t.held, 5) ?? undefined, sub: "of inspected" },
    { label: "Agreements out", v: t.sent, was: b.sent },
    { label: "Roofs signed", v: money.roofs, was: moneyWas.roofs, of: pct(money.roofs, t.sent, 3) ?? undefined, sub: "of sent" },
  ];

  /* Coaching: the scope, or one person in it. */
  const pick = <T extends { who: string }>(xs: T[]) => (focus === "team" ? xs : xs.filter((x) => x.who === focus));
  const focusRow = focus === "team" ? null : now.reps.find((r) => r.who === focus) ?? null;
  const people = now.reps
    .filter((r) => r.knocks > 0 || r.sets > 0 || r.ran > 0 || r.signed > 0)
    .sort((a, b) => (a.who === me.name ? -1 : b.who === me.name ? 1 : a.who.localeCompare(b.who)));

  const reasonMap = new Map<string, number>();
  for (const r of pick(now.reasons)) reasonMap.set(r.reason, (reasonMap.get(r.reason) ?? 0) + Number(r.n));
  const reasons = [...reasonMap].sort((a, b) => b[1] - a[1]);
  const reasonTotal = reasons.reduce((s, [, v]) => s + v, 0);
  const reasonMax = Math.max(1, ...reasons.map(([, v]) => v));

  const hourMap = new Map<number, { knocks: number; talked: number; sets: number }>();
  for (const h of pick(now.hours)) {
    const x = hourMap.get(h.hour) ?? { knocks: 0, talked: 0, sets: 0 };
    x.knocks += Number(h.knocks);
    x.talked += Number(h.talked);
    x.sets += Number(h.sets);
    hourMap.set(h.hour, x);
  }
  const hourKeys = [...new Set([...Array.from({ length: 12 }, (_, i) => i + 8), ...hourMap.keys()])].sort((a, b) => a - b);
  const hourRate = (h: number) => {
    const x = hourMap.get(h);
    return x && x.knocks ? x.talked / x.knocks : 0;
  };
  const hourMax = Math.max(0.25, ...hourKeys.filter((h) => (hourMap.get(h)?.knocks ?? 0) >= 10).map(hourRate));
  const hourLabel = (h: number) => (h === 0 ? "12a" : h < 12 ? `${h}a` : h === 12 ? "12p" : `${h - 12}p`);
  const bestHour = hourKeys.filter((h) => (hourMap.get(h)?.knocks ?? 0) >= 10).sort((a, b) => hourRate(b) - hourRate(a))[0];

  const hailMap = new Map<number, { knocks: number; talked: number; sets: number }>();
  for (const h of pick(now.hail)) {
    const x = hailMap.get(h.band) ?? { knocks: 0, talked: 0, sets: 0 };
    x.knocks += Number(h.knocks);
    x.talked += Number(h.talked);
    x.sets += Number(h.sets);
    hailMap.set(h.band, x);
  }

  const dayMap = new Map<string, { knocks: number; sets: number }>();
  for (const d of pick(now.daily)) {
    const x = dayMap.get(d.day) ?? { knocks: 0, sets: 0 };
    x.knocks += Number(d.knocks);
    x.sets += Number(d.sets);
    dayMap.set(d.day, x);
  }
  const dayMaxK = Math.max(1, ...[...dayMap.values()].map((d) => d.knocks));
  const dayMaxS = Math.max(1, ...[...dayMap.values()].map((d) => d.sets));
  const dayTick = (d: string) => {
    const dt = new Date(`${d}T12:00:00Z`);
    return period.key === "week" ? dt.toLocaleDateString("en-US", { timeZone: "UTC", weekday: "short" }) : String(dt.getUTCDate());
  };

  const focusLabel = focus === "team" ? (scope.kind === "company" ? "The company" : scope.kind === "team" ? scope.name : "You") : focus === me.name ? "You" : focus;
  const periodLower = period.label.toLowerCase();

  /* ----------------------------------------------------- meeting view */
  if (props.present) {
    const topSetters = setterRows.slice(0, 8);
    const topClosers = closerRows.slice(0, 8);
    return (
      <div className="fixed inset-0 z-[60] overflow-auto bg-[#f4f5f7] px-8 py-8 text-[#0b0e13]">
        <div className="mx-auto max-w-6xl">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-lg font-semibold text-gray-500">{period.span}</p>
              <h1 className="font-display text-5xl font-extrabold">{label === "Company" ? "PowerEdge" : label}</h1>
            </div>
            <Link href={href({ present: "0" })} className="rounded-full border border-[#d7dbe0] bg-white px-4 py-2 text-sm font-semibold text-[#3b424e]">
              Exit
            </Link>
          </div>
          <div className="mt-8">
            <MoneyBlock m={money} was={moneyWas} showProfit={showProfit} versus={period.versus} isAdmin={isAdmin} estimatesSet={estimatesSet} big />
          </div>
          <div className="mt-10 grid gap-10 lg:grid-cols-2">
            {[
              { title: "Knockers", rows: topSetters, m: metricsFor("setters", showProfit)[0], sub: (r: RankedRow) => `${n(r.knocks)} doors` },
              { title: "Closers", rows: topClosers, m: metricsFor("closers", showProfit)[0], sub: (r: RankedRow) => `${r.money.roofs} roof${r.money.roofs === 1 ? "" : "s"}` },
            ].map((col) => (
              <section key={col.title}>
                <h2 className="font-display text-2xl font-bold">{col.title}</h2>
                <p className="text-gray-500">Ranked by {col.m.label.toLowerCase()}</p>
                <ol className="mt-4 divide-y divide-[#e3e6ea] border-y border-[#e3e6ea]">
                  {col.rows.length === 0 ? <li className="py-4 text-gray-400">Nobody yet.</li> : null}
                  {col.rows.map((r) => (
                    <li key={r.who} className="flex items-baseline gap-4 py-3 text-xl">
                      <span className={`w-8 font-display font-extrabold ${r.rank === 1 ? "text-[#0c7a40]" : "text-gray-400"}`}>{r.rank ?? "·"}</span>
                      <span className="flex-1 font-semibold">{r.who}</span>
                      <span className="text-base text-gray-500">{col.sub(r)}</span>
                      <span className="w-32 text-right font-display font-extrabold tabular-nums">{fmtMetric(col.m, r.metric) ?? "0"}</span>
                    </li>
                  ))}
                </ol>
              </section>
            ))}
          </div>
          {scope.kind === "company" ? (
            <section className="mt-10">
              <h2 className="font-display text-2xl font-bold">Teams</h2>
              <TeamsTable board={now} showProfit={showProfit} href={(id) => href({ team: id })} />
            </section>
          ) : null}
          {now.wins.length ? (
            <section className="mt-10">
              <h2 className="font-display text-2xl font-bold">Wins</h2>
              <ul className="mt-3 grid gap-x-8 sm:grid-cols-2">
                {now.wins.slice(0, 8).map((w, i) => (
                  <li key={`${w.at}-${i}`} className="border-b border-[#e3e6ea] py-3 text-lg">
                    <span className="font-semibold">{firstName(w.who)}</span>{" "}
                    {w.kind === "signed" ? <>signed <strong style={{ color: GREEN }}>{usd(w.amount) ?? "a roof"}</strong></> : w.kind === "damage" ? "found damage" : "set an inspection"}
                    <span className="text-base text-gray-400"> · {street(w.address)}</span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      </div>
    );
  }

  /* ------------------------------------------------------------- render */
  return (
    <div className="px-4 py-6 sm:px-6 sm:py-8">
      <div className="mx-auto max-w-5xl">
        {/* Header */}
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-extrabold text-[#0b0e13]">
              Scoreboard <span className="text-gray-400">· {label}</span>
            </h1>
            <p className="mt-1 text-sm text-gray-600">
              {period.span}.{" "}
              <span className="text-gray-500">
                {isAdmin
                  ? "You see every team. Reps see their own numbers and their team."
                  : scope.kind === "team"
                    ? `Your numbers and ${scope.name}'s.`
                    : "Your numbers. Ask the office to put you on a team."}
              </span>
            </p>
          </div>
          <Chips items={PERIODS.map((p) => ({ label: p.label, href: href({ p: p.key }), on: p.key === period.key }))} />
        </div>

        {isAdmin ? (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-y border-[#e3e6ea] py-3">
            <Chips
              small
              items={[
                { label: "Company", href: href({ team: "company", who: "team" }), on: scope.kind === "company" },
                ...allTeams.map((tm) => ({
                  label: tm.name,
                  href: href({ team: String(tm.id), who: "team" }),
                  on: scope.kind === "team" && scope.id === tm.id,
                })),
              ]}
            />
            <div className="flex gap-2">
              <Link href={href({ present: "1" })} className="rounded-full border border-[#d7dbe0] bg-white px-3 py-1 text-xs font-semibold text-[#3b424e] hover:border-[#0b0e13]">
                Show in a meeting
              </Link>
              <Link href="/admin/scoreboard/send" className="rounded-full bg-[#0b0e13] px-3 py-1 text-xs font-semibold text-white">
                Send scorecards
              </Link>
            </div>
          </div>
        ) : null}

        {props.loadFailed ? (
          <p className="mt-5 rounded-md border border-amber-400 bg-amber-50 p-3 text-sm text-amber-900">
            The numbers didn&apos;t load. Refresh in a minute; if it keeps happening, check Health.
          </p>
        ) : null}

        {/* The chief numbers */}
        <section className="mt-6">
          <SectionHead
            title={`Revenue${showProfit ? " and profit" : ""} per roof`}
            sub={`${label === "You" ? "Your roofs" : label === "Company" ? "Every roof signed" : `${label}'s roofs`}, ${periodLower}. Small numbers compare with ${period.versus}.`}
          />
          <div className="mt-3">
            <MoneyBlock m={money} was={moneyWas} showProfit={showProfit} versus={period.versus} isAdmin={isAdmin} estimatesSet={estimatesSet} />
          </div>
        </section>

        {/* You */}
        {showYou && mine ? (
          <YouCard
            r={mine}
            setterRank={mySetter && mySetter.rank != null ? { rank: mySetter.rank, of: setterRows.length } : null}
            closerRank={myCloser && myCloser.rank != null ? { rank: myCloser.rank, of: closerRows.length } : null}
            scopeName={scope.kind === "team" ? scope.name : null}
            prev={before.reps.find((r) => r.who === me.name)}
            all={now.reps}
            roofs={now.roofs}
            days={days}
            period={period}
            pace={pace}
            showProfit={showProfit}
            role={me.role}
          />
        ) : null}

        {/* Teams, for the office */}
        {isAdmin && scope.kind === "company" ? (
          <section className="mt-8">
            <SectionHead title="Teams" sub={`Ranked by ${showProfit ? "profit" : "revenue"} per roof, ${periodLower}. Open one to see its board as its people do.`} />
            <TeamsTable board={now} showProfit={showProfit} href={(id) => href({ team: id, who: "team" })} />
          </section>
        ) : null}

        {/* The funnel */}
        <section className="mt-8">
          <SectionHead
            title={`${period.label}, door to signature`}
            sub={`${label === "Company" ? "The whole company" : label === "You" ? "Yours" : label}${t.web_sets ? `, including ${t.web_sets} inspection${t.web_sets === 1 ? "" : "s"} booked on the website` : ""}.`}
          />
          <div className="mt-3 overflow-x-auto rounded-lg border border-[#e3e6ea] bg-white">
            {/* Phone: a list, label left and number right. Wider: one row of steps. */}
            <ol className="flex flex-col divide-y divide-[#eceef1] sm:min-w-max sm:flex-row sm:divide-x sm:divide-y-0 lg:min-w-0">
              {steps.map((s) => (
                <li key={s.label} className="flex items-center justify-between gap-4 px-4 py-2.5 sm:block sm:min-w-[7.5rem] sm:flex-1 sm:py-3.5 lg:min-w-0">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-[#3b424e] sm:text-xs sm:text-gray-500">{s.label}</div>
                    <div className="mt-1 hidden font-display text-2xl font-extrabold tabular-nums text-[#0b0e13] sm:block">{n(s.v)}</div>
                    <div className="mt-0.5 text-xs tabular-nums text-gray-500">
                      {s.of ? (
                        <span>
                          <span className="font-semibold text-[#3b424e]">{s.of}</span> {s.sub}
                        </span>
                      ) : (
                        <span className="hidden sm:inline">&nbsp;</span>
                      )}
                    </div>
                    <div className="mt-1 hidden text-xs tabular-nums sm:block">
                      <Delta now={s.v} before={s.was} label={period.versus} />
                    </div>
                  </div>
                  <div className="shrink-0 text-right sm:hidden">
                    <div className="font-display text-xl font-extrabold tabular-nums text-[#0b0e13]">{n(s.v)}</div>
                    <div className="text-xs tabular-nums">
                      <Delta now={s.v} before={s.was} label={period.versus} />
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Leaderboard */}
        <section className="mt-8">
          <SectionHead
            title={scope.kind === "team" ? `${scope.name}, ranked` : scope.kind === "self" ? "Your numbers" : "Leaderboard"}
            sub={`Ranked by ${metric.label.toLowerCase()}. Tap a column or a chip to rank by something else, and a name for their coaching.`}
            right={
              <Chips
                items={[
                  { label: "Knockers", href: href({ board: "setters", rank: "" }), on: board === "setters" },
                  { label: "Closers", href: href({ board: "closers", rank: "" }), on: board === "closers" },
                ]}
              />
            }
          />
          <div className="mt-3 flex items-center gap-2 overflow-x-auto pb-1">
            <span className="shrink-0 text-xs font-semibold text-gray-500">Rank by</span>
            <Chips small items={metrics.map((m) => ({ label: m.label, href: href({ rank: m.key }), on: m.key === metric.key }))} />
          </div>
          {rows.length === 0 ? (
            <p className="mt-3 rounded-lg border border-dashed border-gray-300 bg-white p-6 text-center text-sm text-gray-600">
              {board === "setters" ? "No knockers here yet." : "No closers here yet."}{" "}
              {isAdmin ? "Add people and teams on the Team page." : ""}
            </p>
          ) : (
            <Leaderboard
              rows={rows}
              metrics={metrics}
              metric={metric}
              board={board}
              me={me.name}
              period={period}
              prevBy={prevBy}
              rankHref={(k) => href({ rank: k })}
              personHref={(who) => href({ who }, "#coaching")}
            />
          )}
          {isAdmin ? (
            <p className="mt-2 text-xs text-gray-500">
              Goals: {DEFAULT_GOALS.knocksWeek} doors and {DEFAULT_GOALS.setsWeek} inspections a week, {moneyShort(DEFAULT_GOALS.signedMonth)} revenue a month, unless set per person on the{" "}
              <Link href="/admin/team#goals" className="font-semibold text-gray-700 underline">
                Team page
              </Link>
              .
            </p>
          ) : null}
        </section>

        {/* Wins */}
        <section className="mt-8">
          <SectionHead title="Wins" sub={`${period.label}.`} />
          {now.wins.length === 0 ? (
            <p className="mt-3 text-sm text-gray-500">The first inspection set goes here.</p>
          ) : (
            <ul className="mt-3 grid gap-x-8 border-t border-[#eceef1] sm:grid-cols-2">
              {now.wins.map((w, i) => (
                <li key={`${w.kind}-${w.at}-${i}`} className="border-b border-[#eceef1] py-2.5 text-sm">
                  <span className="font-semibold text-[#0b0e13]">{w.who === me.name ? "You" : firstName(w.who)}</span>{" "}
                  <span className="text-[#0b0e13]">
                    {w.kind === "signed" ? (
                      w.amount ? (
                        <>
                          signed <strong className="text-[#0c7a40]">{usd(w.amount)}</strong>
                        </>
                      ) : (
                        "signed a roof"
                      )
                    ) : w.kind === "damage" ? (
                      "found damage"
                    ) : (
                      "set an inspection"
                    )}
                  </span>
                  <span className="text-xs text-gray-500"> · {[street(w.address), ago(w.at, nowMs)].filter(Boolean).join(" · ")}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Coaching */}
        <section className="mt-10">
          <SectionHead
            id="coaching"
            title={focus === "team" ? "Coaching" : `Coaching: ${focusLabel === "You" ? "you" : focusLabel}`}
            sub="What the doors are telling us. Pick a person to see theirs."
          />
          {people.length > 1 || scope.kind !== "self" ? (
            <div className="mt-3">
              <Chips
                items={[
                  { label: scope.kind === "company" ? "Company" : scope.kind === "team" ? scope.name : "You", href: href({ who: "team" }, "#coaching"), on: focus === "team" },
                  ...people.map((r) => ({ label: r.who === me.name ? "You" : r.who, href: href({ who: r.who }, "#coaching"), on: focus === r.who })),
                ]}
              />
            </div>
          ) : null}

          {/* Your own notes are already in your card at the top. */}
          {focusRow && !(focusRow.who === me.name && showYou) ? (
            <ul className="mt-4 space-y-1.5">
              {[...(isSetterRow(focusRow) ? setterNotes(focusRow, now.reps) : []), ...(isCloserRow(focusRow) ? closerNotes(focusRow, now.reps) : [])].map(
                (note, i) => <NoteLine key={i} note={note} />,
              )}
              {focusRow.knocks > 0 && focusRow.knocks < 40 && focusRow.ran < 5 ? (
                <li className="text-sm text-gray-500">Coaching notes start at 40 doors or 5 inspections in the period.</li>
              ) : null}
            </ul>
          ) : null}

          <div className="mt-5 grid gap-8 lg:grid-cols-3">
            <div>
              <h3 className="font-semibold text-[#0b0e13]">Why they said no</h3>
              <p className="text-xs text-gray-500">
                {reasonTotal ? `${n(reasonTotal)} no's, from the reason tapped at the door.` : "From the reason tapped at the door."}
              </p>
              {reasons.length === 0 ? (
                <p className="mt-3 text-sm text-gray-400">No no&apos;s recorded yet.</p>
              ) : (
                <ul className="mt-3 space-y-2.5">
                  {reasons.map(([reason, v]) => (
                    <li key={reason} title={`${reason}: ${v} (${Math.round((v / reasonTotal) * 100)}%)`}>
                      <div className="flex justify-between gap-3 text-sm">
                        <span className="truncate text-[#3b424e]">{reason}</span>
                        <span className="tabular-nums text-gray-500">{v}</span>
                      </div>
                      <div className="mt-1 h-1.5 rounded-r bg-[#9aa3ae]" style={{ width: `${Math.max(2, (v / reasonMax) * 100)}%` }} />
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div id="when" className="scroll-mt-20">
              <h3 className="font-semibold text-[#0b0e13]">When doors answer</h3>
              <p className="text-xs text-gray-500">
                {bestHour !== undefined
                  ? `Share of doors that opened, by hour. Best: ${hourLabel(bestHour)} at ${Math.round(hourRate(bestHour) * 100)}%.`
                  : "Share of doors that opened, by hour. Shows once an hour has 10 doors."}
              </p>
              <div className="mt-3 flex h-28 items-end gap-1 border-b border-[#d7dbe0]" role="img" aria-label="Share of doors that opened, by hour">
                {hourKeys.map((h) => {
                  const x = hourMap.get(h);
                  const enough = (x?.knocks ?? 0) >= 10;
                  const r = hourRate(h);
                  return (
                    <div
                      key={h}
                      className="flex h-full flex-1 flex-col justify-end"
                      title={x ? `${hourLabel(h)}: ${x.knocks} doors, ${x.talked} talked (${Math.round(r * 100)}%), ${x.sets} set${enough ? "" : ". Too few doors to read."}` : `${hourLabel(h)}: no doors`}
                    >
                      {x ? (
                        <div className="w-full rounded-t" style={{ height: `${Math.max(3, (Math.min(r, hourMax) / hourMax) * 100)}%`, background: enough ? GREEN : "#cfe3d7" }} />
                      ) : null}
                    </div>
                  );
                })}
              </div>
              <div className="mt-1 flex gap-1 text-[10px] text-gray-400">
                {hourKeys.map((h) => (
                  <span key={h} className="flex-1 text-center">
                    {h % 2 === 0 ? hourLabel(h) : ""}
                  </span>
                ))}
              </div>
            </div>

            <div>
              <h3 className="font-semibold text-[#0b0e13]">Hail at the door</h3>
              <p className="text-xs text-gray-500">Radar hail at the house, against what happened there.</p>
              <table className="mt-3 w-full text-sm">
                <thead>
                  <tr className="border-b border-[#eceef1] text-left text-xs text-gray-500">
                    <th className="py-1.5 font-semibold">Hail</th>
                    <th className="py-1.5 text-right font-semibold">Doors</th>
                    <th className="py-1.5 text-right font-semibold">Talked</th>
                    <th className="py-1.5 text-right font-semibold" title="Inspections set per 100 doors">Per 100</th>
                  </tr>
                </thead>
                <tbody>
                  {[4, 3, 2, 1].map((band) => {
                    const x = hailMap.get(band);
                    return (
                      <tr key={band} className="border-b border-[#f3f4f6] last:border-0">
                        <td className="py-2 text-[#3b424e]">{HAIL_BANDS[band]}</td>
                        <td className="py-2 text-right tabular-nums">{x ? n(x.knocks) : <span className="text-gray-300">0</span>}</td>
                        <td className="py-2 text-right tabular-nums">{x ? pct(x.talked, x.knocks) ?? <span className="text-gray-300">·</span> : <span className="text-gray-300">·</span>}</td>
                        <td className="py-2 text-right tabular-nums">
                          {x && x.knocks >= MIN_DOORS_FOR_RATE ? ((x.sets / x.knocks) * 100).toFixed(1) : <span className="text-gray-300">·</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <p className="mt-2 text-xs text-gray-500">If 2 in+ doesn&apos;t set more per 100, the map&apos;s default is wrong. This is where we&apos;ll see it.</p>
            </div>
          </div>
        </section>

        {/* Day by day */}
        {period.key !== "today" ? (
          <section className="mt-10">
            <SectionHead title="Day by day" sub={`${focusLabel === "You" ? "Yours" : focusLabel}, ${periodLower}.`} />
            <div className="mt-3 grid gap-6 sm:grid-cols-2">
              {[
                { label: "Doors", key: "knocks" as const, max: dayMaxK },
                { label: "Inspections set", key: "sets" as const, max: dayMaxS },
              ].map((c) => (
                <div key={c.key}>
                  <div className="text-sm font-semibold text-[#3b424e]">{c.label}</div>
                  <div className="mt-2 flex h-24 items-end gap-[2px] border-b border-[#d7dbe0]" role="img" aria-label={`${c.label} per day`}>
                    {period.days.map((d) => {
                      const v = dayMap.get(d)?.[c.key] ?? 0;
                      return (
                        <div key={d} className="flex h-full flex-1 flex-col justify-end" title={`${d}: ${v} ${c.label.toLowerCase()}`}>
                          {v > 0 ? (
                            <div className="mx-auto w-full max-w-[28px] rounded-t" style={{ height: `${Math.max(3, (v / c.max) * 100)}%`, background: d === period.today ? GREEN : "#3b424e" }} />
                          ) : d > period.today ? null : (
                            <div className="mx-auto h-[2px] w-full max-w-[28px] bg-[#e3e6ea]" />
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-1 flex gap-[2px] text-[10px] text-gray-400">
                    {period.days.map((d, i) => (
                      <span key={d} className="flex-1 text-center">
                        {period.key === "week" || i % 5 === 0 ? dayTick(d) : ""}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {props.footer}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------- you card */

function YouCard({
  r,
  setterRank,
  closerRank,
  scopeName,
  prev,
  all,
  roofs,
  days,
  period,
  pace,
  showProfit,
  role,
}: {
  r: RepRow;
  setterRank: { rank: number; of: number } | null;
  closerRank: { rank: number; of: number } | null;
  scopeName: string | null;
  prev?: RepRow;
  all: RepRow[];
  roofs: Board["roofs"];
  days: DayRow[];
  period: Period;
  pace: number;
  showProfit: boolean;
  role: string;
}) {
  const g = goalsFor(r, period);
  const rec = recordsFor(r.who, days, period.today);
  const asSetter = !!setterRank && (role !== "closer" || r.knocks > 0);
  const asCloser = !!closerRank && (role !== "setter" || r.ran > 0 || r.signed > 0);
  const where = scopeName ? `on ${scopeName}` : "";
  const lead =
    asSetter && setterRank
      ? { ...setterRank, kind: setterRank.of === 1 ? "knocker" : "knockers" }
      : closerRank
        ? { ...closerRank, kind: closerRank.of === 1 ? "closer" : "closers" }
        : null;
  const notes = [...(asSetter ? setterNotes(r, all) : []), ...(asCloser ? closerNotes(r, all) : [])];
  const fmtDay = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", { timeZone: "UTC", month: "short", day: "numeric" });
  const periodWord = period.key === "today" ? "today" : period.key === "week" ? "this week" : period.key === "month" ? "this month" : "over 30 days";
  const empty = r.knocks === 0 && r.sets === 0 && r.ran === 0 && r.signed === 0;
  const setM = moneyOf(roofsOf(r.who, roofs, "setters"));
  const closeM = moneyOf(roofsOf(r.who, roofs, "closers"));

  const facts: string[] = [];
  if (asSetter && rec.streak >= 2) facts.push(`${rec.streak} days in a row on doors`);
  if (rec.bestToday) facts.push("Best day of doors yet, today");
  else if (asSetter && rec.bestKnocks) facts.push(`Best day: ${n(rec.bestKnocks.n)} doors, ${fmtDay(rec.bestKnocks.day)}`);
  if (asSetter && rec.bestSets && rec.bestSets.n > 1) facts.push(`Most set in a day: ${rec.bestSets.n}`);
  if (asCloser && rec.bestWeek) facts.push(`Best week: ${moneyShort(rec.bestWeek.n)} signed`);

  const moneyLine = [
    asSetter && setM.roofs ? `${setM.roofs} roof${setM.roofs === 1 ? "" : "s"} from your doors, ${usd(setM.revenue)} (${usd(setM.perRoof)} a roof)` : null,
    asCloser && closeM.roofs
      ? `${closeM.roofs} roof${closeM.roofs === 1 ? "" : "s"} closed, ${usd(closeM.revenue)} (${usd(closeM.perRoof)} a roof)${
          showProfit && closeM.profitPerRoof != null ? `, ${usd(closeM.profitPerRoof)} profit a roof${closeM.estimated ? " (estimated)" : ""}` : ""
        }`
      : null,
  ].filter(Boolean);

  return (
    <section className="mt-6 rounded-lg border border-[#e3e6ea] bg-white p-5">
      <p className="font-display text-xl font-bold leading-snug">
        {empty ? (
          <>
            <span className="text-[#0b0e13]">Nothing on the board {periodWord} yet.</span> <span className="text-gray-400">The first door counts.</span>
          </>
        ) : lead ? (
          <>
            <span className="text-[#0b0e13]">You&apos;re {ordinal(lead.rank)}</span>{" "}
            <span className="text-gray-400">
              of {lead.of} {lead.kind} {where} {periodWord}.
            </span>
          </>
        ) : null}
      </p>
      {!empty ? (
        <p className="mt-1 text-sm text-gray-600">
          {[
            asSetter ? `${n(r.knocks)} doors` : null,
            asSetter ? `${n(r.talked)} talked` : null,
            asSetter ? `${n(r.sets)} inspection${r.sets === 1 ? "" : "s"} set` : null,
            asCloser ? `${r.ran} inspected` : null,
            asSetter && r.hours >= 1 ? `${(r.knocks / r.hours).toFixed(0)} doors an hour` : null,
          ]
            .filter(Boolean)
            .join(" · ")}
          {prev && asSetter && prev.sets !== r.sets ? <span className="text-gray-400"> ({prev.sets} set at {period.versus})</span> : null}
        </p>
      ) : null}
      {moneyLine.length ? <p className="mt-1 text-sm font-semibold text-[#0b0e13]">{moneyLine.join(" · ")}</p> : null}

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {asSetter ? (
          <>
            <GoalBar label="Doors" value={r.knocks} goal={g.knocks} pace={pace} unit="doors" />
            <GoalBar label="Inspections set" value={r.sets} goal={g.sets} pace={pace} unit="sets" />
          </>
        ) : null}
        {asCloser ? <GoalBar label="Revenue closed" value={closeM.revenue} goal={g.signed} pace={pace} format={(v) => moneyShort(v) || "$0"} unit="" /> : null}
      </div>

      {facts.length ? <p className="mt-4 text-sm text-[#3b424e]">{facts.join(" · ")}</p> : null}
      {notes.length ? (
        <ul className="mt-3 space-y-1.5 border-t border-[#eceef1] pt-3">
          {notes.map((note, i) => (
            <NoteLine key={i} note={note} />
          ))}
        </ul>
      ) : null}
    </section>
  );
}
