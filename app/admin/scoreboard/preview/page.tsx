import { notFound } from "next/navigation";
import { Scoreboard } from "@/components/Scoreboard";
import {
  periodFor,
  PERIODS,
  EMPTY_TEAM,
  metricsFor,
  restrict,
  seesProfit,
  type Board,
  type DayRow,
  type MetricKey,
  type PeriodKey,
  type RepRow,
  type Roof,
  type Scope,
} from "@/lib/scoreboard";
import { addDays } from "@/lib/day";

/**
 * The scoreboard with made-up numbers, for designing it before the team has
 * a week of doors behind it. Development only: production returns 404.
 *
 *   ?as=setter (Devon, North) | closer (Zach, North) | admin (Parker)
 */
export const dynamic = "force-dynamic";

const NORTH = 1;
const SOUTH = 2;

function rep(who: string, role: RepRow["role"], team_id: number | null, o: Partial<RepRow>): RepRow {
  return {
    who, role, active: true, team_id, goal_knocks_week: null, goal_sets_week: null, goal_signed_month: null,
    knocks: 0, talked: 0, days_out: 0, hours: 0, sets: 0, held: 0, held_damage: 0, set_signed: 0,
    set_signed_value: 0, set_no_shows: 0, come_backs: 0, come_backs_late: 0, assigned: 0, no_shows: 0,
    ran: 0, damage: 0, sent: 0, signed: 0, signed_value: 0, ...o,
  };
}

function sample(scale: number, t: number): Board {
  const s = (v: number) => Math.round(v * scale);
  const reps = [
    rep("Maria Lopez", "setter", NORTH, { knocks: s(312), talked: s(118), days_out: 3, hours: 19, sets: s(11), held: s(7), held_damage: s(6), set_signed: s(3), come_backs: 6 }),
    rep("Devon Reyes", "setter", NORTH, { knocks: s(266), talked: s(92), days_out: 3, hours: 17, sets: s(8), held: s(6), held_damage: s(4), set_signed: s(2), set_no_shows: 1, come_backs_late: 2 }),
    rep("Tasha Green", "setter", NORTH, { knocks: s(141), talked: s(52), days_out: 2, hours: 9, sets: s(4), held: s(2), held_damage: s(2), set_signed: s(1) }),
    rep("Luis Ortega", "setter", SOUTH, { knocks: s(198), talked: s(57), days_out: 3, hours: 13, sets: s(5), held: s(4), held_damage: s(3), set_signed: s(2) }),
    rep("Jordan Hale", "setter", SOUTH, { knocks: s(233), talked: s(80), days_out: 3, hours: 15, sets: s(7), held: s(5), held_damage: s(4), set_signed: s(1) }),
    rep("Zach Delgado", "closer", NORTH, { assigned: s(12), ran: s(11), damage: s(9), sent: s(6), signed: s(5) }),
    rep("Chris Bell", "closer", SOUTH, { assigned: s(9), ran: s(8), damage: s(6), sent: s(4), signed: s(3), no_shows: 1 }),
    rep("Parker Lee", "admin", null, {}),
  ];
  const roofsAll: Array<[string, string, number, number | null, Roof["profit_kind"]]> = [
    ["Maria Lopez", "Zach Delgado", 23400, 7900, "actual"],
    ["Maria Lopez", "Zach Delgado", 19800, 6100, "estimated"],
    ["Maria Lopez", "Zach Delgado", 21900, null, null],
    ["Devon Reyes", "Zach Delgado", 18500, 5200, "actual"],
    ["Devon Reyes", "Zach Delgado", 26300, 9400, "estimated"],
    ["Tasha Green", "Chris Bell", 17200, 4300, "actual"],
    ["Luis Ortega", "Chris Bell", 16400, 3900, "actual"],
    ["Luis Ortega", "Chris Bell", 22800, 6800, "estimated"],
    ["Jordan Hale", "Chris Bell", 15900, 3100, "estimated"],
  ];
  const roofs: Roof[] = roofsAll.slice(0, Math.max(1, Math.round(roofsAll.length * scale))).map(([setter, closer, revenue, profit, kind], i) => ({
    job_id: `sample-${i}`,
    signed_at: new Date(t - (i * 7 + 1) * 3600000).toISOString(),
    setter,
    closer,
    squares: 28,
    address: `${4100 + i * 37} Sample St`,
    city: "Fort Worth",
    revenue: Math.round(revenue * (0.9 + scale / 10)),
    profit,
    profit_kind: kind,
  }));
  const sum = (k: keyof RepRow) => reps.reduce((a, r) => a + Number(r[k]), 0);
  const team = {
    ...EMPTY_TEAM,
    knocks: sum("knocks"), talked: sum("talked"), sets: sum("sets") + s(2), web_sets: s(2),
    held: sum("ran"), damage: sum("damage"), sent: sum("sent"), signed: roofs.length, signed_value: roofs.reduce((a, r) => a + r.revenue, 0),
  };
  const who = reps.filter((r) => r.knocks > 0).map((r) => r.who);
  const reasons = [
    ["Has a roofer", 41], ["Already replaced", 33], ["Just not interested", 29], ["No damage they can see", 22],
    ["Worried about the deductible", 14], ["No-soliciting sign, or asked us not to come back", 6],
  ].flatMap(([reason, v]) => who.map((w, i) => ({ who: w, reason: String(reason), n: Math.max(0, Math.round((Number(v) * scale * (5 - i)) / 15)) })));
  const curve = [0.19, 0.22, 0.24, 0.27, 0.31, 0.29, 0.33, 0.38, 0.44, 0.47, 0.41, 0.3];
  const hours = curve.flatMap((r, i) =>
    who.map((w, j) => {
      const knocks = Math.round(((i > 6 ? 30 : 18) * scale * (5 - j)) / 5);
      return { who: w, hour: 8 + i, knocks, talked: Math.round(knocks * r), sets: Math.round(knocks * r * 0.09) };
    }),
  );
  const hail = [
    [4, 0.36, 0.052], [3, 0.35, 0.041], [2, 0.31, 0.021], [1, 0.27, 0.008],
  ].flatMap(([band, tr, sr]) =>
    who.map((w, j) => {
      const knocks = Math.round(((band === 4 ? 70 : band === 3 ? 80 : band === 2 ? 20 : 8) * scale * (5 - j)) / 5);
      return { who: w, band: Number(band), knocks, talked: Math.round(knocks * Number(tr)), sets: Math.round(knocks * Number(sr)) };
    }),
  );
  const wins: Board["wins"] = [
    { kind: "signed", who: "Zach Delgado", at: new Date(t - 40 * 60000).toISOString(), amount: 23400, address: "5629 Ainsdale Dr", city: "Fort Worth" },
    { kind: "set", who: "Maria Lopez", at: new Date(t - 95 * 60000).toISOString(), amount: null, address: "6313 Lakeside Dr", city: null },
    { kind: "damage", who: "Chris Bell", at: new Date(t - 3 * 3600000).toISOString(), amount: null, address: "7408 Ederville Rd", city: "Fort Worth" },
    { kind: "set", who: "Devon Reyes", at: new Date(t - 5 * 3600000).toISOString(), amount: null, address: "6112 Lake Worth Blvd", city: null },
    { kind: "signed", who: "Chris Bell", at: new Date(t - 26 * 3600000).toISOString(), amount: 16400, address: "4921 Merrimac St", city: "Fort Worth" },
    { kind: "set", who: "Jordan Hale", at: new Date(t - 28 * 3600000).toISOString(), amount: null, address: "3301 Azle Ave", city: null },
  ];
  return {
    team, reps, reasons, hours, hail, daily: [], wins, roofs,
    teams: [{ id: NORTH, name: "North" }, { id: SOUTH, name: "South" }],
    settings: { est_cost_per_square: 410, est_other_per_job: 650, est_commission_pct: 10 },
  };
}

export default async function ScoreboardPreview({
  searchParams,
}: {
  searchParams: Promise<{ p?: string; board?: string; who?: string; as?: string; team?: string; rank?: string; present?: string }>;
}) {
  if (process.env.NODE_ENV === "production") notFound();
  const sp = await searchParams;
  const key: PeriodKey = PERIODS.some((x) => x.key === sp.p) ? (sp.p as PeriodKey) : "week";
  const period = periodFor(key);
  // eslint-disable-next-line react-hooks/purity -- sample data, development only
  const t = Date.now();
  const full = sample(1, t);
  const fullBefore = sample(0.82, t);
  const me =
    sp.as === "closer" ? { name: "Zach Delgado", role: "closer" } : sp.as === "admin" ? { name: "Parker Lee", role: "admin" } : { name: "Devon Reyes", role: "setter" };
  const isAdmin = me.role === "admin";

  const daily: Board["daily"] = [];
  for (const d of period.days.filter((d) => d <= period.today)) {
    if (new Date(`${d}T12:00:00Z`).getUTCDay() === 0) continue;
    for (const r of full.reps.filter((x) => x.knocks > 0)) {
      const k = Math.round((r.knocks / 3) * (0.7 + ((d.charCodeAt(9) + r.who.length) % 7) / 10));
      daily.push({ day: d, who: r.who, knocks: k, sets: Math.round(k / 28), signed: 0, signed_value: 0 });
    }
  }
  full.daily = daily;
  const days: DayRow[] = [];
  for (let i = 0; i < 40; i++) {
    const d = addDays(period.today, -i);
    if (new Date(`${d}T12:00:00Z`).getUTCDay() === 0) continue;
    days.push({ who: "Devon Reyes", day: d, knocks: i < 9 ? 70 + ((i * 13) % 30) : 0, sets: i % 3 === 0 ? 3 : 1, signed_value: 0 });
    days.push({ who: "Zach Delgado", day: d, knocks: 0, sets: 0, signed_value: i % 4 === 0 ? 21000 : 0 });
  }

  const team = full.teams.find((x) => String(x.id) === sp.team);
  const scope: Scope = isAdmin
    ? team
      ? { kind: "team", id: team.id, name: team.name }
      : { kind: "company" }
    : { kind: "team", id: NORTH, name: "North" };
  const showProfit = seesProfit(me.role);
  const now = restrict(full, scope, me.name, showProfit);
  const before = restrict(fullBefore, scope, me.name, showProfit);
  const board = sp.board === "closers" ? "closers" : sp.board === "setters" ? "setters" : me.role === "closer" ? "closers" : "setters";
  const rank = metricsFor(board, showProfit).some((m) => m.key === sp.rank) ? (sp.rank as MetricKey) : null;
  const inScope = new Set(now.reps.map((r) => r.who));

  return (
    <Scoreboard
      period={period}
      now={now}
      before={before}
      days={days.filter((d) => inScope.has(d.who))}
      me={me}
      scope={scope}
      allTeams={isAdmin ? full.teams : []}
      board={board}
      rank={rank}
      focus={sp.who && inScope.has(sp.who) ? sp.who : sp.who === "team" ? "team" : isAdmin ? "team" : me.name}
      showProfit={showProfit}
      isAdmin={isAdmin}
      basePath="/admin/scoreboard/preview"
      nowMs={t}
      present={isAdmin && sp.present === "1"}
    />
  );
}
