import { notFound } from "next/navigation";
import { Scoreboard } from "@/components/Scoreboard";
import { periodFor, PERIODS, EMPTY_TEAM, type Board, type DayRow, type PeriodKey, type RepRow } from "@/lib/scoreboard";
import { addDays } from "@/lib/day";

/**
 * The scoreboard with made-up numbers, for designing it before the team has
 * a week of doors behind it. Development only: production returns 404.
 */
export const dynamic = "force-dynamic";

function rep(who: string, role: RepRow["role"], o: Partial<RepRow>): RepRow {
  return {
    who, role, active: true, goal_knocks_week: null, goal_sets_week: null, goal_signed_month: null,
    knocks: 0, talked: 0, days_out: 0, hours: 0, sets: 0, held: 0, held_damage: 0, set_signed: 0,
    set_signed_value: 0, set_no_shows: 0, come_backs: 0, come_backs_late: 0, assigned: 0, no_shows: 0,
    ran: 0, damage: 0, sent: 0, signed: 0, signed_value: 0, ...o,
  };
}

function sample(scale: number): Board {
  const s = (v: number) => Math.round(v * scale);
  const reps = [
    rep("Maria Lopez", "setter", { knocks: s(312), talked: s(118), days_out: 3, hours: 19, sets: s(11), held: s(7), held_damage: s(6), set_signed: s(3), set_signed_value: s(61000), come_backs: 6 }),
    rep("Parker Lee", "admin", { knocks: s(204), talked: s(61), days_out: 3, hours: 14, sets: s(5), held: s(4), held_damage: s(3), set_signed: s(1), set_signed_value: s(18500), come_backs: 4, come_backs_late: 2 }),
    rep("Devon Reyes", "setter", { knocks: s(266), talked: s(92), days_out: 3, hours: 17, sets: s(8), held: s(6), held_damage: s(4), set_signed: s(2), set_signed_value: s(39000), set_no_shows: 1 }),
    rep("Tasha Green", "setter", { knocks: s(141), talked: s(52), days_out: 2, hours: 9, sets: s(4), held: s(2), held_damage: s(2), set_signed: s(1), set_signed_value: s(21000) }),
    rep("Luis Ortega", "setter", { knocks: s(58), talked: s(17), days_out: 1, hours: 4, sets: s(1) }),
    rep("Zach Delgado", "closer", { assigned: s(12), ran: s(11), damage: s(9), sent: s(6), signed: s(4), signed_value: s(84500) }),
    rep("Chris Bell", "closer", { assigned: s(9), ran: s(8), damage: s(6), sent: s(4), signed: s(2), signed_value: s(39500), no_shows: 1 }),
    rep("Ana Cruz", "closer", { assigned: s(5), ran: s(5), damage: s(4), sent: s(2), signed: s(1), signed_value: s(16000) }),
  ];
  const sum = (k: keyof RepRow) => reps.reduce((t, r) => t + Number(r[k]), 0);
  const team = {
    ...EMPTY_TEAM,
    knocks: sum("knocks"), talked: sum("talked"), sets: sum("sets") + s(2), web_sets: s(2),
    held: sum("ran"), damage: sum("damage"), sent: sum("sent"), signed: sum("signed"), signed_value: sum("signed_value"),
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
  return { team, reps, reasons, hours, hail, daily: [], wins: [] };
}

export default async function ScoreboardPreview({
  searchParams,
}: {
  searchParams: Promise<{ p?: string; board?: string; who?: string; as?: string }>;
}) {
  if (process.env.NODE_ENV === "production") notFound();
  const { p, board, who, as } = await searchParams;
  const key: PeriodKey = PERIODS.some((x) => x.key === p) ? (p as PeriodKey) : "week";
  const period = periodFor(key);
  const now = sample(1);
  const before = sample(0.82);
  const me = as === "closer" ? { name: "Zach Delgado", role: "closer" } : as === "admin" ? { name: "Parker Lee", role: "admin" } : { name: "Devon Reyes", role: "setter" };

  // A week of days, today included, and wins.
  const daily: Board["daily"] = [];
  for (const d of period.days.filter((d) => d <= period.today)) {
    const dow = new Date(`${d}T12:00:00Z`).getUTCDay();
    if (dow === 0) continue;
    for (const r of now.reps.filter((x) => x.knocks > 0)) {
      const k = Math.round((r.knocks / 3) * (0.7 + ((d.charCodeAt(9) + r.who.length) % 7) / 10));
      daily.push({ day: d, who: r.who, knocks: k, sets: Math.round(k / 28), signed: 0, signed_value: 0 });
    }
  }
  now.daily = daily;
  const t = Date.now();
  now.wins = [
    { kind: "signed", who: "Zach Delgado", at: new Date(t - 40 * 60000).toISOString(), amount: 23400, address: "5629 Ainsdale Dr", city: "Fort Worth" },
    { kind: "set", who: "Maria Lopez", at: new Date(t - 95 * 60000).toISOString(), amount: null, address: "6313 Lakeside Dr", city: null },
    { kind: "damage", who: "Chris Bell", at: new Date(t - 3 * 3600000).toISOString(), amount: null, address: "7408 Ederville Rd", city: "Fort Worth" },
    { kind: "set", who: "Devon Reyes", at: new Date(t - 5 * 3600000).toISOString(), amount: null, address: "6112 Lake Worth Blvd", city: null },
    { kind: "signed", who: "Ana Cruz", at: new Date(t - 26 * 3600000).toISOString(), amount: 16000, address: "4921 Merrimac St", city: "Fort Worth" },
  ];
  const days: DayRow[] = [];
  for (let i = 0; i < 40; i++) {
    const d = addDays(period.today, -i);
    if (new Date(`${d}T12:00:00Z`).getUTCDay() === 0) continue;
    days.push({ who: "Devon Reyes", day: d, knocks: i < 9 ? 70 + ((i * 13) % 30) : 0, sets: i % 3 === 0 ? 3 : 1, signed_value: 0 });
    days.push({ who: "Zach Delgado", day: d, knocks: 0, sets: 0, signed_value: i % 4 === 0 ? 21000 : 0 });
  }

  return (
    <Scoreboard
      period={period}
      now={now}
      before={before}
      days={days}
      me={me}
      board={board === "closers" ? "closers" : board === "setters" ? "setters" : me.role === "closer" ? "closers" : "setters"}
      focus={who && now.reps.some((r) => r.who === who) ? who : who === "team" ? "team" : me.name}
      money={me.role !== "setter"}
      isAdmin={me.role === "admin"}
      basePath="/admin/scoreboard/preview"
      nowMs={t}
    />
  );
}
