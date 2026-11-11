/**
 * The scoreboard: every rep's numbers, the same numbers for everyone.
 *
 * The work is in two database functions (public.scoreboard for a period,
 * public.scoreboard_days for personal bests and streaks). This file picks the
 * period in Central time, fetches, and turns raw counts into the things a
 * person reads: rank, goal progress, streak, best day, and the one step of
 * the funnel where they lose the most compared with the team.
 *
 * What counts:
 *   Doors        every knock recorded, including a second visit to the same house
 *   Talked       someone came to the door (any outcome except not home)
 *   Set          an inspection booked, by its setter, unless it was canceled
 *   Inspected    the closer recorded a verdict (damage found or roof is fine)
 *   Agreement    sent or signed; an agreement sent twice counts once
 *   Signed       the signed agreement, credited to the closer who wrote it and
 *                to the setter who found the door
 */

import { localDay, addDays } from "@/lib/day";

export type PeriodKey = "today" | "week" | "month" | "30d";

export const PERIODS: Array<{ key: PeriodKey; label: string }> = [
  { key: "today", label: "Today" },
  { key: "week", label: "This week" },
  { key: "month", label: "This month" },
  { key: "30d", label: "30 days" },
];

/**
 * Team defaults until an admin sets a person's own goal on the Team page.
 * Starting points to confirm with Parker, not targets anyone agreed to.
 */
export const DEFAULT_GOALS = { knocksWeek: 300, setsWeek: 8, signedMonth: 75000 };

/** Rates are noise on small numbers. Below these, show a dash. */
export const MIN_DOORS_FOR_RATE = 20;
export const MIN_DOORS_FOR_COACHING = 40;
export const MIN_INSPECTIONS_FOR_COACHING = 5;

const TZ = "America/Chicago";
const HOUR = new Intl.DateTimeFormat("en-US", { timeZone: TZ, hour: "numeric", hourCycle: "h23" });

/** The instant Central midnight starts a YYYY-MM-DD day (CDT or CST). */
export function chicagoMidnight(day: string): Date {
  for (const utcHour of ["05", "06"]) {
    const d = new Date(`${day}T${utcHour}:00:00Z`);
    if (localDay(d.toISOString()) === day && Number(HOUR.format(d)) === 0) return d;
  }
  return new Date(`${day}T06:00:00Z`);
}

/** Monday = 0. */
function weekdayIndex(day: string) {
  return (new Date(`${day}T12:00:00Z`).getUTCDay() + 6) % 7;
}

function nextMonthFirst(day: string) {
  const [y, m] = day.split("-").map(Number);
  return m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;
}
function prevMonthFirst(day: string) {
  const [y, m] = day.split("-").map(Number);
  return m === 1 ? `${y - 1}-12-01` : `${y}-${String(m - 1).padStart(2, "0")}-01`;
}

const fmt = (day: string, o: Intl.DateTimeFormatOptions) =>
  new Date(`${day}T12:00:00Z`).toLocaleDateString("en-US", { timeZone: "UTC", ...o });

export type Period = {
  key: PeriodKey;
  label: string;
  /** "Nov 9 to 15", "November", "Wednesday, Nov 11". */
  span: string;
  from: Date;
  to: Date;
  /** The same stretch of the period before, up to the same point. */
  prevFrom: Date;
  prevTo: Date;
  /** "this time yesterday", "this point last week". */
  versus: string;
  today: string;
  /** Multiplies a weekly goal to this period. */
  weekFactor: number;
  /** Multiplies a monthly goal to this period. */
  monthFactor: number;
  /** Days in the period, for the daily chart. */
  days: string[];
};

export function periodFor(key: PeriodKey, now = new Date()): Period {
  const today = localDay(now.toISOString());
  let fromDay: string;
  let toDay: string;
  let prevFromDay: string;
  let span: string;
  let versus: string;
  let weekFactor: number;
  let monthFactor: number;

  if (key === "today") {
    fromDay = today;
    toDay = addDays(today, 1);
    prevFromDay = addDays(today, -1);
    span = fmt(today, { weekday: "long", month: "short", day: "numeric" });
    versus = "this time yesterday";
    // A day's goal is a fifth of the week's.
    weekFactor = 1 / 5;
    monthFactor = 1 / 22;
  } else if (key === "week") {
    fromDay = addDays(today, -weekdayIndex(today));
    toDay = addDays(fromDay, 7);
    prevFromDay = addDays(fromDay, -7);
    const end = addDays(fromDay, 6);
    const sameMonth = fromDay.slice(0, 7) === end.slice(0, 7);
    span = `${fmt(fromDay, { month: "short", day: "numeric" })} to ${fmt(end, sameMonth ? { day: "numeric" } : { month: "short", day: "numeric" })}`;
    versus = "this point last week";
    weekFactor = 1;
    monthFactor = 7 / 30.4;
  } else if (key === "month") {
    fromDay = `${today.slice(0, 8)}01`;
    toDay = nextMonthFirst(today);
    prevFromDay = prevMonthFirst(today);
    span = fmt(fromDay, { month: "long" });
    versus = "this point last month";
    const len = Math.round((Date.parse(`${toDay}T12:00:00Z`) - Date.parse(`${fromDay}T12:00:00Z`)) / 86400000);
    weekFactor = len / 7;
    monthFactor = 1;
  } else {
    fromDay = addDays(today, -29);
    toDay = addDays(today, 1);
    prevFromDay = addDays(fromDay, -30);
    span = `${fmt(fromDay, { month: "short", day: "numeric" })} to ${fmt(today, { month: "short", day: "numeric" })}`;
    versus = "the 30 days before";
    weekFactor = 30 / 7;
    monthFactor = 30 / 30.4;
  }

  const from = chicagoMidnight(fromDay);
  const to = chicagoMidnight(toDay);
  const prevFrom = chicagoMidnight(prevFromDay);
  // Compare like with like: a Wednesday morning against last Wednesday
  // morning, not against all of last week.
  const elapsed = Math.max(0, Math.min(now.getTime(), to.getTime()) - from.getTime());
  const prevTo = new Date(Math.min(prevFrom.getTime() + elapsed, from.getTime()));

  const days: string[] = [];
  for (let d = fromDay; d < toDay && days.length < 40; d = addDays(d, 1)) days.push(d);

  return {
    key,
    label: key === "30d" ? "Last 30 days" : PERIODS.find((p) => p.key === key)!.label,
    span,
    from,
    to,
    prevFrom,
    prevTo,
    versus,
    today,
    weekFactor,
    monthFactor,
    days,
  };
}

/**
 * Last Monday to Sunday, whole: what a weekly scorecard reports. Compared
 * with the whole week before, not a partial one.
 */
export function lastWeekPeriod(now = new Date()): Period {
  const p = periodFor("week", new Date(now.getTime() - 7 * 86400000));
  const end = p.days[p.days.length - 1];
  return {
    ...p,
    label: "Last week",
    prevTo: p.from,
    versus: "the week before",
    today: end,
  };
}

/* ------------------------------------------------------------------------ */

export type RepRow = {
  who: string;
  role: "setter" | "closer" | "rep" | "admin" | null;
  active: boolean;
  team_id: number | null;
  goal_knocks_week: number | null;
  goal_sets_week: number | null;
  goal_signed_month: number | null;
  knocks: number;
  talked: number;
  days_out: number;
  hours: number;
  sets: number;
  held: number;
  held_damage: number;
  set_signed: number;
  set_signed_value: number;
  set_no_shows: number;
  come_backs: number;
  come_backs_late: number;
  assigned: number;
  no_shows: number;
  ran: number;
  damage: number;
  sent: number;
  signed: number;
  signed_value: number;
};

export type TeamRow = {
  knocks: number;
  talked: number;
  sets: number;
  web_sets: number;
  no_shows: number;
  held: number;
  damage: number;
  sent: number;
  signed: number;
  signed_value: number;
};

export type Board = {
  team: TeamRow;
  reps: RepRow[];
  reasons: Array<{ who: string; reason: string; n: number }>;
  hours: Array<{ who: string; hour: number; knocks: number; talked: number; sets: number }>;
  hail: Array<{ who: string; band: number; knocks: number; talked: number; sets: number }>;
  daily: Array<{ day: string; who: string; knocks: number; sets: number; signed: number; signed_value: number }>;
  wins: Array<{ kind: "signed" | "damage" | "set"; who: string; at: string; amount: number | null; address: string | null; city: string | null }>;
  /** Every roof signed in the period, with revenue and (when known) profit. */
  roofs: Roof[];
  teams: TeamRef[];
  settings: EstimateSettings;
};

export type Roof = {
  job_id: string;
  signed_at: string;
  setter: string | null;
  closer: string | null;
  squares: number | null;
  address: string | null;
  city: string | null;
  revenue: number;
  /** "actual" once the office enters costs, "estimated" from company rates, else null. */
  profit_kind: "actual" | "estimated" | null;
  profit: number | null;
};

export type TeamRef = { id: number; name: string };

export type EstimateSettings = {
  est_cost_per_square: number | null;
  est_other_per_job: number | null;
  est_commission_pct: number | null;
};

export type DayRow = { who: string; day: string; knocks: number; sets: number; signed_value: number };

export const EMPTY_TEAM: TeamRow = {
  knocks: 0, talked: 0, sets: 0, web_sets: 0, no_shows: 0, held: 0, damage: 0, sent: 0, signed: 0, signed_value: 0,
};

async function rpc<T>(fn: string, body: Record<string, unknown>): Promise<T | null> {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  try {
    const res = await fetch(`${process.env.SUPABASE_URL}/rest/v1/rpc/${fn}`, {
      method: "POST",
      headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    if (!res.ok) {
      console.error(`[scoreboard] ${fn} ${res.status}`, (await res.text()).slice(0, 200));
      return null;
    }
    return (await res.json()) as T;
  } catch (err) {
    console.error(`[scoreboard] ${fn}`, err);
    return null;
  }
}

function normalize(b: Board | null): Board {
  return {
    team: { ...EMPTY_TEAM, ...(b?.team ?? {}) },
    reps: b?.reps ?? [],
    reasons: b?.reasons ?? [],
    hours: b?.hours ?? [],
    hail: b?.hail ?? [],
    daily: b?.daily ?? [],
    wins: b?.wins ?? [],
    roofs: (b?.roofs ?? []).map((r) => ({ ...r, revenue: Number(r.revenue) || 0, profit: r.profit == null ? null : Number(r.profit) })),
    teams: b?.teams ?? [],
    settings: b?.settings ?? { est_cost_per_square: null, est_other_per_job: null, est_commission_pct: null },
  };
}

export async function loadScoreboard(p: Period) {
  const [cur, prev, days] = await Promise.all([
    rpc<Board>("scoreboard", { p_from: p.from.toISOString(), p_to: p.to.toISOString() }),
    rpc<Board>("scoreboard", { p_from: p.prevFrom.toISOString(), p_to: p.prevTo.toISOString() }),
    rpc<DayRow[]>("scoreboard_days", { p_days: 180 }),
  ]);
  return { ok: cur !== null, now: normalize(cur), before: normalize(prev), days: days ?? [] };
}

/** Just this period, no comparison or records: the line on Today. */
export async function loadBoard(p: Period): Promise<Board | null> {
  const b = await rpc<Board>("scoreboard", { p_from: p.from.toISOString(), p_to: p.to.toISOString() });
  return b ? normalize(b) : null;
}

/* ------------------------------------------------------------------------ */

export const isSetterRow = (r: RepRow) =>
  r.role === "setter" || r.role === "rep" || r.knocks > 0 || r.sets > 0;
export const isCloserRow = (r: RepRow) =>
  r.role === "closer" || r.role === "rep" || r.ran > 0 || r.signed > 0 || r.sent > 0 || r.assigned > 0;

/** Off the team and nothing in this period: not on the board. */
const shows = (r: RepRow, board: "setters" | "closers") =>
  board === "setters"
    ? (r.active && r.role !== "admin" && r.role !== "closer") || r.knocks > 0 || r.sets > 0
    : (r.active && r.role !== "admin" && r.role !== "setter") || r.ran > 0 || r.signed > 0 || r.sent > 0 || r.assigned > 0;

export function goalsFor(r: Pick<RepRow, "goal_knocks_week" | "goal_sets_week" | "goal_signed_month">, p: Period) {
  const knocksWeek = r.goal_knocks_week ?? DEFAULT_GOALS.knocksWeek;
  const setsWeek = r.goal_sets_week ?? DEFAULT_GOALS.setsWeek;
  const signedMonth = r.goal_signed_month ?? DEFAULT_GOALS.signedMonth;
  return {
    knocks: Math.max(1, Math.round(knocksWeek * p.weekFactor)),
    sets: Math.max(1, Math.round(setsWeek * p.weekFactor)),
    signed: Math.max(1000, Math.round((signedMonth * p.monthFactor) / 500) * 500),
    custom: r.goal_knocks_week != null || r.goal_sets_week != null || r.goal_signed_month != null,
  };
}

/** Streak of days on doors, best days, best week signed. Sundays never break a streak. */
export function recordsFor(who: string, days: DayRow[], today: string) {
  const mine = days.filter((d) => d.who === who);
  const byDay = new Map(mine.map((d) => [d.day, d]));
  let streak = 0;
  let d = (byDay.get(today)?.knocks ?? 0) > 0 ? today : addDays(today, -1);
  for (let i = 0; i < 200; i++) {
    const r = byDay.get(d);
    const sunday = new Date(`${d}T12:00:00Z`).getUTCDay() === 0;
    if (r && r.knocks > 0) streak++;
    else if (!sunday) break;
    d = addDays(d, -1);
  }
  const best = (k: "knocks" | "sets") =>
    mine.reduce<{ n: number; day: string } | null>((b, r) => (r[k] > (b?.n ?? 0) ? { n: r[k], day: r.day } : b), null);
  const weeks = new Map<string, number>();
  for (const r of mine) {
    if (!r.signed_value) continue;
    const wk = addDays(r.day, -weekdayIndex(r.day));
    weeks.set(wk, (weeks.get(wk) ?? 0) + Number(r.signed_value));
  }
  let bestWeek: { n: number; day: string } | null = null;
  for (const [wk, n] of weeks) if (n > (bestWeek?.n ?? 0)) bestWeek = { n, day: wk };
  const todayRow = byDay.get(today);
  const bestKnocks = best("knocks");
  return {
    streak,
    bestKnocks,
    bestSets: best("sets"),
    bestWeek,
    bestToday: !!todayRow && todayRow.knocks > 0 && bestKnocks?.day === today,
  };
}

/* ------------------------------------------------------------------------ */

/** "34%", or null when the base is too small to mean anything. */
export function pct(n: number, d: number, min = MIN_DOORS_FOR_RATE): string | null {
  if (d < min || d === 0) return null;
  return `${Math.round((n / d) * 100)}%`;
}

/** Where the period should be by now, 0 to 1, for "on pace". */
export function paceFraction(p: Period, now = new Date()) {
  if (p.key === "30d") return 1;
  if (p.key === "today") {
    // Doors are knocked roughly 8am to 7pm.
    const [h, m] = new Intl.DateTimeFormat("en-US", { timeZone: TZ, hour: "numeric", minute: "numeric", hourCycle: "h23" })
      .format(now)
      .split(":")
      .map(Number);
    return Math.min(1, Math.max(0, (h + m / 60 - 8) / 11));
  }
  const span = p.to.getTime() - p.from.getTime();
  return Math.min(1, Math.max(0, (now.getTime() - p.from.getTime()) / span));
}

/** "1 in 8". */
function oneIn(n: number, d: number) {
  if (d === 0) return "none";
  if (n === 0) return `none of ${d}`;
  return `1 in ${Math.max(1, Math.round(d / n))}`;
}

export type Note = { tone: "gap" | "good" | "owed"; text: string; href?: string; link?: string };

/**
 * The one place a setter loses the most against the team, in plain words.
 * Only on enough doors to mean something.
 */
export function setterNotes(r: RepRow, all: RepRow[]): Note[] {
  const notes: Note[] = [];
  if (r.come_backs_late > 0) {
    notes.push({
      tone: "owed",
      text: `${r.come_backs_late} come-back${r.come_backs_late === 1 ? " is" : "s are"} past due. Those people asked you to come back.`,
      href: "/admin#come-backs",
      link: "See them",
    });
  }
  if (r.knocks < MIN_DOORS_FOR_COACHING) return notes;
  const team = all.filter((x) => x.knocks > 0);
  const tKnocks = team.reduce((s, x) => s + x.knocks, 0);
  const tTalked = team.reduce((s, x) => s + x.talked, 0);
  const tSets = team.reduce((s, x) => s + x.sets, 0);
  if (team.length < 2 || tKnocks === 0) return notes;
  const gaps: Array<{ ratio: number; note: Note }> = [];
  const talk = r.talked / r.knocks;
  const tTalk = tTalked / tKnocks;
  if (tTalk > 0) {
    gaps.push({
      ratio: talk / tTalk,
      note: {
        tone: "gap",
        text: `Fewer doors open for you. You talk to ${oneIn(r.talked, r.knocks)} doors; the team talks to ${oneIn(tTalked, tKnocks)}. Check when doors answer, below.`,
        href: "#when",
        link: "When doors answer",
      },
    });
  }
  if (r.talked >= 10 && tTalked > 0) {
    const set = r.sets / r.talked;
    const tSet = tSets / tTalked;
    if (tSet > 0) {
      gaps.push({
        ratio: set / tSet,
        note: {
          tone: "gap",
          text: `Conversations aren't turning into inspections. You set ${oneIn(r.sets, r.talked)} people you talk to; the team sets ${oneIn(tSets, tTalked)}.`,
          href: "/sales",
          link: "Door script",
        },
      });
    }
  }
  if (r.sets >= 5 && r.set_no_shows / r.sets > 0.2) {
    gaps.push({
      ratio: 0.5,
      note: {
        tone: "gap",
        text: `${r.set_no_shows} of your ${r.sets} inspections were no-shows. Confirm the time out loud before you leave the door.`,
      },
    });
  }
  const worst = gaps.sort((a, b) => a.ratio - b.ratio)[0];
  if (worst && worst.ratio < 0.85) notes.push(worst.note);
  else notes.push({ tone: "good", text: "At or above the team at every step. More doors is the lever now." });
  return notes;
}

export function closerNotes(r: RepRow, all: RepRow[]): Note[] {
  const notes: Note[] = [];
  if (r.ran < MIN_INSPECTIONS_FOR_COACHING) return notes;
  const team = all.filter((x) => x.ran > 0);
  const tDamage = team.reduce((s, x) => s + x.damage, 0);
  const tSigned = team.reduce((s, x) => s + x.signed, 0);
  if (team.length < 2 || tDamage === 0 || r.damage === 0) return notes;
  const ratio = r.signed / r.damage / (tSigned / tDamage);
  if (ratio < 0.85) {
    notes.push({
      tone: "gap",
      text: `Damage found isn't turning into signatures. You sign ${oneIn(r.signed, r.damage)} roofs with damage; the team signs ${oneIn(tSigned, tDamage)}.`,
      href: "/sales",
      link: "Closer playbook",
    });
  } else {
    notes.push({ tone: "good", text: "Signing at or above the team on roofs with damage." });
  }
  return notes;
}

export const HAIL_BANDS: Record<number, string> = {
  4: "2.5 in and up",
  3: "2 to 2.5 in",
  2: "1 to 2 in",
  1: "Under 1 in, or no radar",
};

/* ------------------------------------------------------------------------ */
/* Revenue and profit per roof: the company's chief numbers.                 */
/* ------------------------------------------------------------------------ */

export type Money = {
  roofs: number;
  revenue: number;
  /** Revenue divided by roofs. */
  perRoof: number | null;
  /** Roofs with a profit figure (actual or estimated). */
  profitRoofs: number;
  estimated: number;
  profit: number;
  /** Profit divided by the roofs that have one. */
  profitPerRoof: number | null;
  /** Profit over the revenue of the roofs that have one. */
  margin: number | null;
};

export function moneyOf(roofs: Roof[]): Money {
  const revenue = roofs.reduce((t, r) => t + r.revenue, 0);
  const withProfit = roofs.filter((r) => r.profit != null);
  const profit = withProfit.reduce((t, r) => t + (r.profit ?? 0), 0);
  const profitRevenue = withProfit.reduce((t, r) => t + r.revenue, 0);
  return {
    roofs: roofs.length,
    revenue,
    perRoof: roofs.length ? revenue / roofs.length : null,
    profitRoofs: withProfit.length,
    estimated: withProfit.filter((r) => r.profit_kind === "estimated").length,
    profit,
    profitPerRoof: withProfit.length ? profit / withProfit.length : null,
    margin: profitRevenue > 0 ? profit / profitRevenue : null,
  };
}

/** A roof belongs to the team of the knocker who found it, else the closer's. */
export function teamOfRoof(r: Roof, teamOf: Map<string, number | null>) {
  return (r.setter ? teamOf.get(r.setter) : null) ?? (r.closer ? teamOf.get(r.closer) : null) ?? null;
}

/* ------------------------------------------------------------------------ */
/* Who sees what.                                                            */
/*                                                                           */
/* Admins: the company, every team, every person. Everyone else: their own   */
/* numbers and their team, ranked. Closers see profit on their roofs and     */
/* their team's; knockers see revenue, never profit. The filtering happens   */
/* here, on the server, before anything is rendered, so a knocker's page     */
/* never carries another team's numbers or a profit figure at all.           */
/* ------------------------------------------------------------------------ */

export type Scope =
  | { kind: "company" }
  | { kind: "team"; id: number; name: string }
  | { kind: "self" };

export const seesProfit = (role?: string | null) => role === "admin" || role === "closer" || role === "rep";

/** Keep only these people, and recount the team totals from them. */
export function restrict(b: Board, scope: Scope, me: string, showProfit: boolean): Board {
  const teamOf = new Map(b.reps.map((r) => [r.who, r.team_id] as const));
  let keep: (who: string | null | undefined) => boolean;
  let roofs: Roof[];
  if (scope.kind === "company") {
    keep = () => true;
    roofs = b.roofs;
  } else if (scope.kind === "team") {
    keep = (who) => !!who && teamOf.get(who) === scope.id;
    roofs = b.roofs.filter((r) => teamOfRoof(r, teamOf) === scope.id);
  } else {
    keep = (who) => who === me;
    roofs = b.roofs.filter((r) => r.setter === me || r.closer === me);
  }
  if (!showProfit) roofs = roofs.map((r) => ({ ...r, profit: null, profit_kind: null }));
  const reps = b.reps.filter((r) => keep(r.who));
  const sum = (k: keyof RepRow) => reps.reduce((t, r) => t + Number(r[k] || 0), 0);
  const team: TeamRow =
    scope.kind === "company"
      ? b.team
      : {
          knocks: sum("knocks"),
          talked: sum("talked"),
          sets: sum("sets"),
          web_sets: 0,
          no_shows: sum("no_shows"),
          held: sum("ran"),
          damage: sum("damage"),
          sent: sum("sent"),
          signed: roofs.length,
          signed_value: roofs.reduce((t, r) => t + r.revenue, 0),
        };
  return {
    team,
    reps,
    reasons: b.reasons.filter((x) => keep(x.who)),
    hours: b.hours.filter((x) => keep(x.who)),
    hail: b.hail.filter((x) => keep(x.who)),
    daily: b.daily.filter((x) => keep(x.who)),
    wins: b.wins.filter((x) => keep(x.who)),
    roofs,
    teams: scope.kind === "company" ? b.teams : b.teams.filter((t) => scope.kind === "team" && t.id === scope.id),
    settings: b.settings,
  };
}

/* ------------------------------------------------------------------------ */
/* Stack ranking by any metric.                                              */
/* ------------------------------------------------------------------------ */

export type MetricKey =
  | "sets" | "knocks" | "talk" | "per100" | "held" | "roofs" | "revenue" | "perRoof"
  | "profit" | "profitPerRoof" | "margin" | "close" | "ran";

export type Metric = {
  key: MetricKey;
  label: string;
  /** Column header. */
  short: string;
  kind: "count" | "money" | "rate" | "per100";
  profit?: boolean;
  /** null means "not enough to rank on": sorted last, shown as a dot. */
  value: (r: RepRow, m: Money) => number | null;
};

export const SETTER_METRICS: Metric[] = [
  { key: "sets", label: "Inspections set", short: "Set", kind: "count", value: (r) => r.sets },
  { key: "knocks", label: "Doors", short: "Doors", kind: "count", value: (r) => r.knocks },
  { key: "talk", label: "Talk rate", short: "Talked", kind: "rate", value: (r) => (r.knocks >= MIN_DOORS_FOR_RATE ? r.talked / r.knocks : null) },
  { key: "per100", label: "Sets per 100 doors", short: "Per 100", kind: "per100", value: (r) => (r.knocks >= MIN_DOORS_FOR_RATE ? (r.sets / r.knocks) * 100 : null) },
  { key: "roofs", label: "Roofs signed", short: "Roofs", kind: "count", value: (_r, m) => m.roofs },
  { key: "revenue", label: "Revenue", short: "Revenue", kind: "money", value: (_r, m) => m.revenue },
  { key: "perRoof", label: "Revenue per roof", short: "Per roof", kind: "money", value: (_r, m) => m.perRoof },
];

export const CLOSER_METRICS: Metric[] = [
  { key: "revenue", label: "Revenue", short: "Revenue", kind: "money", value: (_r, m) => m.revenue },
  { key: "roofs", label: "Roofs signed", short: "Roofs", kind: "count", value: (_r, m) => m.roofs },
  { key: "perRoof", label: "Revenue per roof", short: "Per roof", kind: "money", value: (_r, m) => m.perRoof },
  { key: "profitPerRoof", label: "Profit per roof", short: "Profit/roof", kind: "money", profit: true, value: (_r, m) => m.profitPerRoof },
  { key: "profit", label: "Profit", short: "Profit", kind: "money", profit: true, value: (_r, m) => (m.profitRoofs ? m.profit : null) },
  { key: "margin", label: "Margin", short: "Margin", kind: "rate", profit: true, value: (_r, m) => m.margin },
  { key: "close", label: "Close rate", short: "Close", kind: "rate", value: (r) => (r.damage >= 3 ? r.signed / r.damage : null) },
  { key: "ran", label: "Inspections run", short: "Inspected", kind: "count", value: (r) => r.ran },
];

export function metricsFor(board: "setters" | "closers", showProfit: boolean) {
  return (board === "setters" ? SETTER_METRICS : CLOSER_METRICS).filter((m) => showProfit || !m.profit);
}

/** Each person's roofs on this board: as the knocker on Setters, as the closer on Closers. */
export function roofsOf(who: string, roofs: Roof[], board: "setters" | "closers") {
  return roofs.filter((r) => (board === "setters" ? r.setter === who : r.closer === who));
}

export type RankedRow = RepRow & { rank: number | null; money: Money; metric: number | null };

/**
 * Stack rank on any metric. People without enough to rank on (a rate on a
 * handful of doors) go to the bottom without a rank, rather than topping the
 * board on one lucky knock.
 */
export function rankBy(reps: RepRow[], roofs: Roof[], board: "setters" | "closers", metric: Metric): RankedRow[] {
  const rows = reps
    .filter((r) => shows(r, board))
    .map((r) => {
      const money = moneyOf(roofsOf(r.who, roofs, board));
      return { ...r, money, metric: metric.value(r, money), rank: null as number | null };
    });
  rows.sort((a, b) => {
    if (a.metric == null && b.metric == null) return a.who.localeCompare(b.who);
    if (a.metric == null) return 1;
    if (b.metric == null) return -1;
    return b.metric - a.metric || a.who.localeCompare(b.who);
  });
  let rank = 0;
  let last: number | null = null;
  rows.forEach((r, i) => {
    if (r.metric == null) return;
    if (r.metric !== last) rank = i + 1;
    last = r.metric;
    r.rank = rank;
  });
  return rows;
}

export function fmtMetric(m: Metric, v: number | null) {
  if (v == null) return null;
  if (m.kind === "money") return v.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
  if (m.kind === "rate") return `${Math.round(v * 100)}%`;
  if (m.kind === "per100") return v.toFixed(1);
  return Math.round(v).toLocaleString("en-US");
}
