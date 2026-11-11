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

/* ------------------------------------------------------------------------ */

export type RepRow = {
  who: string;
  role: "setter" | "closer" | "rep" | "admin" | null;
  active: boolean;
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

export function ranked(reps: RepRow[], board: "setters" | "closers", byMoney: boolean) {
  const rows = reps.filter((r) => shows(r, board));
  rows.sort((a, b) =>
    board === "setters"
      ? b.sets - a.sets || b.knocks - a.knocks || a.who.localeCompare(b.who)
      : (byMoney ? b.signed_value - a.signed_value : 0) || b.signed - a.signed || b.ran - a.ran || a.who.localeCompare(b.who),
  );
  // Ties share a rank.
  let rank = 0;
  let last = "";
  return rows.map((r, i) => {
    const key = board === "setters" ? `${r.sets}:${r.knocks}` : `${byMoney ? r.signed_value : ""}:${r.signed}:${r.ran}`;
    if (key !== last) rank = i + 1;
    last = key;
    return { ...r, rank };
  });
}

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
