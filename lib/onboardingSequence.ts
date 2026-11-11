/**
 * The onboarding sequence: add a rep, and the rest runs itself.
 *
 *   Added on the Team page  -> welcome email with a sign-in button (startOnboarding)
 *   Day 1, 3, 6, 10         -> a reminder naming the next step, only while
 *                              something is left and they've been quiet ~20h
 *   After the 4th reminder  -> the office is told they've gone quiet; reminders stop
 *   A closed step opens     -> the agreement goes final, or secure storage turns
 *                              on after they started: one email saying so
 *   Their side is finished  -> the office is told the ride-along and gear are theirs
 *   Every step done         -> "You're all set" to the rep
 *   Any time after          -> permit renewals 14 and 3 days out, and on expiry
 *
 * runOnboardingSequence() runs from the hourly cron and only sends between
 * 8am and 7pm Central. Every email is claimed in onboarding_sends under a key
 * before it goes, so an overlapping run can't send it twice. "Send the welcome
 * again" starts the reminders over (reminder keys hang off the welcome row).
 */

import { issueLoginToken, listMembers, listTeams } from "@/lib/auth";
import { PERMIT_CITIES, expiring, loadAllOnboarding, stepsFor, type Step } from "@/lib/onboarding";
import { piiReady } from "@/lib/pii";
import { AGREEMENT_STATUS, AGREEMENT_VERSION } from "@/lib/repAgreement";
import { localDay } from "@/lib/day";
import { site } from "@/lib/site";
import {
  onbGate,
  onbOfficeStalled,
  onbOfficeTurn,
  onbPermit,
  onbReady,
  onbReminder,
  onbWelcome,
  sendOnboardingEmail,
  type OnbCtx,
  type OnbEmail,
} from "@/lib/emails";

export const REMINDER_DAYS = [1, 3, 6, 10];
/** Days after the last reminder before the office hears they've gone quiet. */
const STALL_AFTER_DAYS = 2;
const QUIET_MS = 20 * 3600_000;
const LINK_TTL_MIN = 3 * 24 * 60;
const DAY = 86_400_000;

const TIME: Partial<Record<Step["key"], string>> = {
  profile: "About 5 minutes",
  agreement: "About 5 minutes",
  w9: "About 3 minutes",
  bank: "About 2 minutes",
  training: "About 20 minutes",
  permits: "Depends on the city; the checklist says how",
};

const ROLE_LABEL: Record<string, string> = { setter: "Knocker", closer: "Closer", rep: "Rep", admin: "Admin" };

/* ------------------------------------------------------------------ data */

const dbOn = () => !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
function h() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
  return { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
}
const rest = (path: string) => `${process.env.SUPABASE_URL}/rest/v1/${path}`;
const base = () => process.env.NEXT_PUBLIC_SITE_URL || site.url;

async function get<T>(path: string): Promise<T[]> {
  if (!dbOn()) return [];
  const res = await fetch(rest(path), { headers: h(), cache: "no-store" });
  if (!res.ok) return [];
  return (await res.json()) as T[];
}

export type SendRow = {
  id: number;
  member_id: number;
  kind: string;
  key: string;
  ok: boolean | null;
  to_addr: string | null;
  detail: Record<string, unknown> | null;
  sent_at: string;
};

export async function loadSends(memberId?: number) {
  return get<SendRow>(
    `onboarding_sends?select=id,member_id,kind,key,ok,to_addr,detail,sent_at${memberId ? `&member_id=eq.${memberId}` : ""}&order=sent_at.asc`,
  );
}

/** Claim a key before sending. Returns the row id, or null if someone already has it. */
async function claim(memberId: number, kind: string, key: string, detail?: Record<string, unknown>) {
  const res = await fetch(rest("onboarding_sends?on_conflict=member_id,key&select=id"), {
    method: "POST",
    headers: { ...h(), Prefer: "resolution=ignore-duplicates,return=representation" },
    body: JSON.stringify([{ member_id: memberId, kind, key, detail: detail ?? null }]),
  });
  if (!res.ok) {
    console.error("[onboarding-seq] claim", res.status, (await res.text()).slice(0, 200));
    return null;
  }
  const rows = (await res.json()) as Array<{ id: number }>;
  return rows[0]?.id ?? null;
}

async function settle(id: number, ok: boolean, to: string) {
  await fetch(rest(`onboarding_sends?id=eq.${id}`), {
    method: "PATCH",
    headers: { ...h(), Prefer: "return=minimal" },
    body: JSON.stringify({ ok, to_addr: to }),
  }).catch(() => undefined);
}

async function deliver(memberId: number, kind: string, key: string, to: string[], email: OnbEmail, detail?: Record<string, unknown>) {
  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey || to.length === 0) return false;
  const id = await claim(memberId, kind, key, detail);
  if (!id) return false;
  let ok = true;
  for (const addr of to) {
    const r = await sendOnboardingEmail(resendKey, addr, email, `onboarding-${kind}`);
    ok = ok && r.ok;
  }
  await settle(id, ok, to.join(", "));
  return ok;
}

/** A link that signs the rep in and opens their checklist at one step. */
async function repLink(email: string, step?: string | null) {
  const next = `/admin/onboarding${step ? `?step=${step}` : ""}`;
  const t = await issueLoginToken(email, LINK_TTL_MIN);
  return t ? `${base()}/auth/callback?t=${t}&next=${encodeURIComponent(next)}` : `${base()}/login`;
}

/* ----------------------------------------------------------- the state */

type Member = Awaited<ReturnType<typeof listMembers>>[number];
type All = Awaited<ReturnType<typeof loadAllOnboarding>>;

function gatesNow() {
  return { agreement: AGREEMENT_STATUS === "final" ? AGREEMENT_VERSION : null, secure: piiReady() };
}

function blockedWhy(s: Step): string | null {
  if (s.done || s.by !== "rep") return null;
  if (s.key === "agreement" && AGREEMENT_STATUS === "draft") return "opens once the office finalizes it; we'll email you";
  if ((s.key === "w9" || s.key === "bank") && !piiReady()) return "opens soon; we'll email you";
  return null;
}

export function split(steps: Step[]) {
  const open = steps.filter((s) => !s.done && s.by === "rep" && !blockedWhy(s));
  const blocked = steps.filter((s) => blockedWhy(s)).map((s) => ({ label: s.label, why: blockedWhy(s)! }));
  const office = steps.filter((s) => !s.done && s.by === "office");
  return { open, blocked, office, done: steps.filter((s) => s.done).length, total: steps.length };
}

function stepsOf(m: Member, all: All) {
  return stepsFor({
    onb: all.onb.get(m.id) ?? null,
    tax: all.tax.has(m.id) ? { member_id: m.id } : null,
    bank: all.bank.has(m.id) ? { member_id: m.id } : null,
    permits: all.permits.filter((p) => p.member_id === m.id),
  });
}

const fmtDay = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { timeZone: "America/Chicago", weekday: "short", month: "short", day: "numeric" });

function ctxFor(m: Member, steps: Step[], team: string | null, url: string): OnbCtx {
  const s = split(steps);
  return {
    first: m.name.trim().split(/\s+/)[0] || m.name,
    name: m.name,
    role: ROLE_LABEL[m.role] ?? m.role,
    team,
    url,
    open: s.open.map((x) => ({ label: x.label, time: TIME[x.key] })),
    blocked: s.blocked,
    done: s.done,
    total: s.total,
    officeOpen: s.office.map((x) => x.label),
  };
}

/** The latest welcome that went out, which the reminders count from. */
export function currentWelcome(sends: SendRow[]) {
  const w = sends.filter((x) => x.kind === "welcome" && x.ok);
  return w[w.length - 1] ?? null;
}

/**
 * What the sequence is doing for one person, for the office's screens:
 * where it is, and when the next email goes if nothing changes.
 */
export function sequenceStatus(m: Pick<Member, "onboarding_started_at">, steps: Step[], sends: SendRow[], now = Date.now()) {
  const welcome = currentWelcome(sends);
  const s = split(steps);
  const failed = sends.filter((x) => x.ok === false);
  if (steps.every((x) => x.done)) return { state: "done" as const, label: "Ready", failed };
  if (!m.onboarding_started_at) return { state: "off" as const, label: "No onboarding emails", failed };
  if (!welcome) return { state: "unsent" as const, label: "Welcome not sent", failed };
  const reminders = sends.filter((x) => x.kind === "reminder" && x.key.startsWith(`reminder:${welcome.id}:`)).length;
  if (s.open.length === 0) return { state: "waiting" as const, label: s.office.length ? "Waiting on the office" : "Waiting on a step to open", reminders, failed };
  if (reminders >= REMINDER_DAYS.length) return { state: "stalled" as const, label: `Quiet after ${reminders} reminders`, reminders, failed };
  const due = Date.parse(welcome.sent_at) + REMINDER_DAYS[reminders] * DAY;
  return { state: "running" as const, label: `Reminder ${reminders + 1} of ${REMINDER_DAYS.length} ${due <= now ? "goes next run" : `on ${fmtDay(new Date(due).toISOString())}`}`, reminders, failed, nextAt: due };
}

/* -------------------------------------------------------------- welcome */

/**
 * Start (or restart) someone's sequence: stamp the start and send the
 * welcome now. Called from the Team page when they're added, and from their
 * checklist when the office sends the welcome again.
 */
export async function startOnboarding(memberId: number): Promise<{ ok: boolean; error?: string }> {
  if (!dbOn()) return { ok: false, error: "Not configured." };
  if (!process.env.RESEND_API_KEY) return { ok: false, error: "Email isn't set up (RESEND_API_KEY)." };
  const [members, teams, all] = await Promise.all([listMembers(), listTeams(), loadAllOnboarding()]);
  const m = members.find((x) => x.id === memberId);
  if (!m || !m.active) return { ok: false, error: "They're not an active team member." };
  if (m.role === "admin") return { ok: false, error: "Admins don't go through onboarding." };
  if (!m.onboarding_started_at) {
    await fetch(rest(`team_members?id=eq.${m.id}`), {
      method: "PATCH",
      headers: { ...h(), Prefer: "return=minimal" },
      body: JSON.stringify({ onboarding_started_at: new Date().toISOString() }),
    });
  }
  const steps = stepsOf(m, all);
  const team = teams.find((t) => t.id === m.team_id)?.name ?? null;
  const first = split(steps).open[0]?.key ?? null;
  const ctx = ctxFor(m, steps, team, await repLink(m.email, first));
  const ok = await deliver(m.id, "welcome", `welcome:${Date.now()}`, [m.email], onbWelcome(ctx), { gates: gatesNow() });
  return ok ? { ok } : { ok, error: "The welcome email didn't send. Check Health for mail errors." };
}

/* ------------------------------------------------------------- the run */

function centralHour(now: number) {
  return Number(new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", hour: "numeric", hourCycle: "h23" }).format(new Date(now)));
}

/** Last time this person changed anything in their checklist. */
async function lastActivity() {
  const rows = (
    await Promise.all(
      ["rep_onboarding", "rep_tax", "rep_bank", "rep_permits"].map((t) => get<{ member_id: number; updated_at: string }>(`${t}?select=member_id,updated_at`)),
    )
  ).flat();
  const out = new Map<number, number>();
  for (const r of rows) {
    const t = Date.parse(r.updated_at);
    if (!Number.isNaN(t) && t > (out.get(r.member_id) ?? 0)) out.set(r.member_id, t);
  }
  return out;
}

export async function runOnboardingSequence(opts: { now?: number; anyHour?: boolean } = {}) {
  const now = opts.now ?? Date.now();
  const tally = { welcome: 0, reminder: 0, gate: 0, permit: 0, ready: 0, office_turn: 0, office_stalled: 0 };
  if (!dbOn() || !process.env.RESEND_API_KEY) return { ok: false, skipped: "not configured", ...tally };
  const hour = centralHour(now);
  if (!opts.anyHour && (hour < 8 || hour >= 19)) return { ok: true, skipped: "quiet hours", ...tally };

  const [members, teams, all, sends, activity] = await Promise.all([listMembers(), listTeams(), loadAllOnboarding(), loadSends(), lastActivity()]);
  const admins = members.filter((m) => m.active && m.role === "admin" && m.email.includes("@")).map((m) => m.email);
  const people = members.filter((m) => m.active && m.role !== "admin");
  const has = (memberId: number, key: string) => sends.some((x) => x.member_id === memberId && x.key === key);
  const today = localDay(new Date(now).toISOString());

  for (const m of people) {
    const mine = sends.filter((x) => x.member_id === m.id);
    const steps = stepsOf(m, all);
    const s = split(steps);
    const team = teams.find((t) => t.id === m.team_id)?.name ?? null;
    const permits = all.permits.filter((p) => p.member_id === m.id);

    // Permit renewals go to everyone holding one, in a sequence or not.
    for (const p of expiring(permits, today)) {
      const tier = p.days < 0 ? "expired" : p.days <= 3 ? "3" : p.days <= 14 ? "14" : null;
      if (!tier) continue;
      const key = `permit:${p.city}:${p.expires_on}:${tier}`;
      if (has(m.id, key)) continue;
      const ctx = ctxFor(m, steps, team, await repLink(m.email, "permits"));
      ctx.permit = {
        city: p.city,
        expires: new Date(`${p.expires_on}T12:00:00Z`).toLocaleDateString("en-US", { month: "long", day: "numeric" }),
        days: p.days,
        how: PERMIT_CITIES.find((c) => c.city === p.city)?.how ?? "Renew with the city before it runs out.",
      };
      if (await deliver(m.id, "permit", key, [m.email], onbPermit(ctx))) tally.permit++;
    }

    if (!m.onboarding_started_at) continue;
    const welcome = currentWelcome(mine);
    if (!welcome) continue; // never sent, or it failed: the office sees that on their checklist

    // All eight done: tell them once.
    if (steps.every((x) => x.done)) {
      if (!has(m.id, "ready")) {
        const ctx = ctxFor(m, steps, team, `${base()}/admin`);
        ctx.permitsHeld = permits.filter((p) => p.status === "approved").map((p) => p.city);
        if (await deliver(m.id, "ready", "ready", [m.email], onbReady(ctx))) tally.ready++;
      }
      continue;
    }

    // A step that was closed when they were welcomed has opened.
    const was = (welcome.detail?.gates ?? {}) as { agreement?: string | null; secure?: boolean };
    const agreementStep = steps.find((x) => x.key === "agreement")!;
    if (AGREEMENT_STATUS === "final" && !agreementStep.done && was.agreement !== AGREEMENT_VERSION) {
      const key = `gate:agreement:${AGREEMENT_VERSION}`;
      if (!has(m.id, key)) {
        const ctx = ctxFor(m, steps, team, await repLink(m.email, "agreement"));
        ctx.resign = !!all.onb.get(m.id)?.agreement_signed_at;
        if (await deliver(m.id, "gate", key, [m.email], onbGate(ctx, "agreement"))) tally.gate++;
      }
    }
    const secureOpen = steps.some((x) => (x.key === "w9" || x.key === "bank") && !x.done);
    if (piiReady() && secureOpen && !was.secure && !has(m.id, "gate:secure")) {
      const ctx = ctxFor(m, steps, team, await repLink(m.email, steps.find((x) => x.key === "w9" && !x.done) ? "w9" : "bank"));
      if (await deliver(m.id, "gate", "gate:secure", [m.email], onbGate(ctx, "secure"))) tally.gate++;
    }

    // Their side is done and the office's isn't: tell the office, once.
    if (s.open.length === 0) {
      if (s.office.length && !has(m.id, `office_turn:${welcome.id}`)) {
        const ctx = ctxFor(m, steps, team, `${base()}/admin/onboarding?member=${m.id}`);
        if (await deliver(m.id, "office_turn", `office_turn:${welcome.id}`, admins, onbOfficeTurn(ctx))) tally.office_turn++;
      }
      continue;
    }

    // Reminders, while something is left and they've been quiet a while.
    const sent = mine.filter((x) => x.kind === "reminder" && x.key.startsWith(`reminder:${welcome.id}:`)).length;
    const started = Date.parse(welcome.sent_at);
    const lastTouch = Math.max(activity.get(m.id) ?? 0, ...mine.map((x) => Date.parse(x.sent_at)));
    if (sent < REMINDER_DAYS.length) {
      if (now >= started + REMINDER_DAYS[sent] * DAY && now - lastTouch >= QUIET_MS) {
        const ctx = ctxFor(m, steps, team, await repLink(m.email, s.open[0]?.key));
        ctx.reminders = sent + 1;
        if (await deliver(m.id, "reminder", `reminder:${welcome.id}:${sent + 1}`, [m.email], onbReminder(ctx))) tally.reminder++;
      }
      continue;
    }

    // Four reminders and still open: the office takes it from here.
    const lastReminder = Math.max(...mine.filter((x) => x.kind === "reminder").map((x) => Date.parse(x.sent_at)));
    if (now - lastReminder >= STALL_AFTER_DAYS * DAY && !has(m.id, `office_stalled:${welcome.id}`)) {
      const ctx = ctxFor(m, steps, team, `${base()}/admin/onboarding?member=${m.id}`);
      ctx.reminders = sent;
      ctx.since = fmtDay(welcome.sent_at);
      ctx.phone = all.onb.get(m.id)?.phone ?? null;
      ctx.lastActivity = activity.get(m.id) ? fmtDay(new Date(activity.get(m.id)!).toISOString()) : null;
      if (await deliver(m.id, "office_stalled", `office_stalled:${welcome.id}`, admins, onbOfficeStalled(ctx))) tally.office_stalled++;
    }
  }
  return { ok: true, ...tally };
}

