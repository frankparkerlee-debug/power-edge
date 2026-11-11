import { sendAppointmentReminder } from "@/lib/emails";
// Inspection scheduling. Homeowners pick a real slot instead of typing
// "weekday mornings" into a box and waiting for someone to call back.
//
// Slots are generated, not stored: a fixed weekly template (Mon–Sat, four
// two-hour windows) projected forward, minus anything already booked. That
// keeps it zero-maintenance (no one has to seed a calendar) while the
// `appointments` table stays the single source of truth for what's taken.
//
// All slot math runs in America/Chicago (DFW) regardless of server timezone.

const TZ = "America/Chicago";

/** Two-hour arrival windows. Roof inspections are windows, not appointments. */
export const SLOT_HOURS = [8, 10, 13, 15] as const;
export const SLOT_LENGTH_HOURS = 2;

/** How far out homeowners can book, and the minimum lead time. */
const DAYS_AHEAD = 14;
const MIN_LEAD_MINUTES = 120;

export type Slot = {
  /** ISO instant the window opens: the booking key. */
  start: string;
  end: string;
  /** "Thu, Nov 13" */
  dayLabel: string;
  /** "8:00 – 10:00 AM" */
  timeLabel: string;
  /** YYYY-MM-DD in DFW local time, for grouping. */
  date: string;
};

function partsInTz(d: Date) {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false, weekday: "short",
  });
  const p: Record<string, string> = {};
  for (const part of fmt.formatToParts(d)) p[part.type] = part.value;
  return p;
}

/**
 * Build the UTC instant for a given DFW wall-clock date + hour. Done by
 * probing the offset so it stays correct across the DST boundary (Nov 2 /
 * Mar 8) without pulling in a timezone library.
 */
function dfwInstant(dateStr: string, hour: number): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  const guess = Date.UTC(y, m - 1, d, hour + 6, 0, 0); // CST assumption
  const probe = new Date(guess);
  const p = partsInTz(probe);
  const actualHour = Number(p.hour);
  const drift = actualHour - hour;
  return new Date(guess - drift * 3600 * 1000);
}

function label(hour: number) {
  const to12 = (h: number) => (h % 12 === 0 ? 12 : h % 12);
  const mer = (h: number) => (h < 12 ? "AM" : "PM");
  const end = hour + SLOT_LENGTH_HOURS;
  return mer(hour) === mer(end)
    ? `${to12(hour)}:00 – ${to12(end)}:00 ${mer(end)}`
    : `${to12(hour)}:00 ${mer(hour)} – ${to12(end)}:00 ${mer(end)}`;
}

/** Every slot in the booking window, before removing taken ones. */
export function candidateSlots(now = new Date()): Slot[] {
  const out: Slot[] = [];
  const cutoff = now.getTime() + MIN_LEAD_MINUTES * 60 * 1000;
  for (let i = 0; i < DAYS_AHEAD; i++) {
    const day = new Date(now.getTime() + i * 86400 * 1000);
    const p = partsInTz(day);
    if (p.weekday === "Sun") continue; // closed Sundays
    const dateStr = `${p.year}-${p.month}-${p.day}`;
    for (const h of SLOT_HOURS) {
      const start = dfwInstant(dateStr, h);
      if (start.getTime() < cutoff) continue;
      const end = new Date(start.getTime() + SLOT_LENGTH_HOURS * 3600 * 1000);
      const sp = partsInTz(start);
      out.push({
        start: start.toISOString(),
        end: end.toISOString(),
        date: dateStr,
        dayLabel: `${sp.weekday}, ${new Date(start).toLocaleDateString("en-US", {
          timeZone: TZ, month: "short", day: "numeric",
        })}`,
        timeLabel: label(h),
      });
    }
  }
  return out;
}

function authHeaders() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
  return { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
}
const dbOn = () => !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);

/**
 * Who drives to inspections.
 *
 * Capacity used to be one booked inspection per window for the whole company,
 * so four a day however many closers there were. It is now one per closer per
 * window, and these are the closers.
 */
export async function inspectors(): Promise<string[]> {
  if (!dbOn()) return [];
  try {
    const res = await fetch(
      `${process.env.SUPABASE_URL}/rest/v1/team_members?select=name&active=is.true&takes_inspections=is.true&order=name.asc`,
      { headers: authHeaders(), cache: "no-store" },
    );
    if (!res.ok) return [];
    const rows = (await res.json()) as Array<{ name: string }>;
    return rows.map((r) => r.name).filter(Boolean);
  } catch {
    return [];
  }
}

type Booked = { slot_start: string; closer: string | null };

/** Every booked inspection from an hour ago onward, with who is on it. */
async function bookedFrom(): Promise<Booked[]> {
  if (!dbOn()) return [];
  try {
    const since = new Date(Date.now() - 3600 * 1000).toISOString();
    const res = await fetch(
      `${process.env.SUPABASE_URL}/rest/v1/appointments?select=slot_start,closer&status=eq.booked&slot_start=gte.${since}`,
      { headers: authHeaders(), cache: "no-store" },
    );
    if (!res.ok) return [];
    const rows = (await res.json()) as Booked[];
    return rows.map((r) => ({ ...r, slot_start: new Date(r.slot_start).toISOString() }));
  } catch {
    return [];
  }
}

/**
 * Which closers are free in each window.
 *
 * With nobody set to take inspections, the old rule applies: one unassigned
 * booking per window, placed by the office. That keeps the public site from
 * ever offering capacity that does not exist.
 */
async function freeByWindow(): Promise<{ free: Map<string, string[]>; pooled: boolean }> {
  const [people, booked] = await Promise.all([inspectors(), bookedFrom()]);
  const free = new Map<string, string[]>();
  const pooled = people.length === 0;
  for (const s of candidateSlots()) {
    const here = booked.filter((b) => b.slot_start === s.start);
    if (pooled) {
      free.set(s.start, here.length === 0 ? [""] : []);
    } else {
      const busy = new Set(here.map((b) => b.closer || ""));
      free.set(s.start, people.filter((p) => !busy.has(p)));
    }
  }
  return { free, pooled };
}

/** Open slots, grouped by day, ready for the picker. */
export async function availableSlots() {
  const { free } = await freeByWindow();
  const open = candidateSlots().filter((s) => (free.get(s.start) ?? []).length > 0);
  const days: { date: string; dayLabel: string; slots: Slot[] }[] = [];
  for (const s of open) {
    let d = days.find((x) => x.date === s.date);
    if (!d) { d = { date: s.date, dayLabel: s.dayLabel, slots: [] }; days.push(d); }
    d.slots.push(s);
  }
  return days;
}

/**
 * How many windows this address has already taken today. A booked slot is a
 * window a real homeowner can no longer have, so this is checked against the
 * database rather than process memory: it has to hold across instances and
 * restarts.
 */
export async function bookingsFromIpToday(ip: string): Promise<number> {
  if (!dbOn() || !ip || ip === "unknown") return 0;
  try {
    const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const res = await fetch(
      `${process.env.SUPABASE_URL}/rest/v1/appointments?select=id&ip=eq.${encodeURIComponent(ip)}&created_at=gte.${since}&status=eq.booked`,
      { headers: { ...authHeaders(), Prefer: "count=exact" }, cache: "no-store" },
    );
    if (!res.ok) return 0;
    const rows = (await res.json()) as unknown[];
    return Array.isArray(rows) ? rows.length : 0;
  } catch {
    return 0;
  }
}

export type BookingInput = {
  slot_start: string;
  name: string;
  phone: string;
  email?: string;
  address?: string;
  notes?: string;
  source?: string;
  claim_intake_id?: string;
  ip?: string;
  /** Who set it. Present when a setter books at the door. */
  setter?: string;
  /** The job this inspection belongs to, when we already know it. */
  job_id?: string;
};

export type BookingResult =
  | { ok: true; slot: Slot; id?: string; closer?: string | null }
  | { ok: false; error: string; code: "taken" | "invalid" | "db" };

/**
 * Book a slot. The unique partial index on (slot_start) where status='booked'
 * is what actually prevents double-booking. Two homeowners hitting the same
 * window at once means the second insert fails at the DB, not in a race-prone
 * "check then write".
 */
export async function bookSlot(input: BookingInput): Promise<BookingResult> {
  const slot = candidateSlots().find(
    (s) => s.start === new Date(input.slot_start).toISOString(),
  );
  if (!slot) return { ok: false, error: "That time is no longer available.", code: "invalid" };
  if (!input.name?.trim() || !input.phone?.trim())
    return { ok: false, error: "Name and phone are required.", code: "invalid" };
  // A crew drives to this. Require something that could actually be dialled:
  // 10 digits, or 11 starting with a US country code.
  const digits = input.phone.replace(/\D/g, "");
  if (digits.length < 10 || digits.length > 11 || (digits.length === 11 && digits[0] !== "1")) {
    return { ok: false, error: "Enter a 10-digit phone number so we can confirm.", code: "invalid" };
  }
  if (!/^[A-Za-z]/.test(input.name.trim()) || input.name.trim().length < 2) {
    return { ok: false, error: "Enter the name we should ask for.", code: "invalid" };
  }
  if (!dbOn()) return { ok: false, error: "Scheduling is not configured.", code: "db" };

  /*
   * Pick a closer who is free in this window, lightest day first, and let the
   * database settle any race.
   *
   * Two setters can open the same morning on two phones and both see Zach
   * free. The unique index on (closer, slot_start) means only one insert wins;
   * the loser moves on to the next free closer rather than failing, and only
   * hears "that window filled up" when there genuinely is nobody left.
   */
  const { free, pooled } = await freeByWindow();
  let candidates = free.get(slot.start) ?? [];
  if (candidates.length === 0) {
    return { ok: false, error: "That window just filled up. Pick another.", code: "taken" };
  }
  if (!pooled && candidates.length > 1) {
    // A knocker's own team closer first (a team is a closer and the knockers
    // who feed them), then whoever has the lightest day.
    const [load, teams] = await Promise.all([dayLoad(slot.date), teamsByName()]);
    const mine = input.setter ? teams.get(input.setter) ?? null : null;
    const away = (who: string) => (mine != null && teams.get(who) === mine ? 0 : 1);
    candidates = [...candidates].sort((a, b) => away(a) - away(b) || (load.get(a) ?? 0) - (load.get(b) ?? 0));
  }

  for (const who of candidates) {
    try {
      const res = await fetch(`${process.env.SUPABASE_URL}/rest/v1/appointments`, {
        method: "POST",
        headers: { ...authHeaders(), Prefer: "return=representation" },
        body: JSON.stringify({
          slot_start: slot.start,
          slot_end: slot.end,
          name: input.name.trim(),
          phone: input.phone.trim(),
          email: input.email?.trim() || null,
          address: input.address?.trim() || null,
          notes: input.notes?.trim() || null,
          source: input.source || null,
          claim_intake_id: input.claim_intake_id || null,
          ip: input.ip || null,
          closer: pooled ? null : who,
          setter: input.setter || null,
          job_id: input.job_id || null,
        }),
      });
      if (res.status === 409) continue; // that closer was just taken; try the next
      if (!res.ok) return { ok: false, error: "Could not save that booking.", code: "db" };
      const rows = (await res.json()) as Array<{ id?: string }>;
      return { ok: true, slot, id: rows?.[0]?.id, closer: pooled ? null : who };
    } catch {
      return { ok: false, error: "Could not save that booking.", code: "db" };
    }
  }
  return { ok: false, error: "That window just filled up. Pick another.", code: "taken" };
}

/** Each active person's team, by name. */
async function teamsByName(): Promise<Map<string, number | null>> {
  const out = new Map<string, number | null>();
  if (!dbOn()) return out;
  try {
    const res = await fetch(`${process.env.SUPABASE_URL}/rest/v1/team_members?select=name,team_id&active=is.true`, {
      headers: authHeaders(),
      cache: "no-store",
    });
    if (!res.ok) return out;
    for (const r of (await res.json()) as Array<{ name: string; team_id: number | null }>) out.set(r.name, r.team_id);
  } catch {
    /* fall back to load order */
  }
  return out;
}

/** How many inspections each closer already has on a given day. */
async function dayLoad(date: string): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (!dbOn()) return out;
  try {
    const from = new Date(`${date}T00:00:00-06:00`).toISOString();
    const to = new Date(`${date}T23:59:59-06:00`).toISOString();
    const res = await fetch(
      `${process.env.SUPABASE_URL}/rest/v1/appointments?select=closer&status=eq.booked&slot_start=gte.${from}&slot_start=lte.${to}`,
      { headers: authHeaders(), cache: "no-store" },
    );
    if (!res.ok) return out;
    for (const r of (await res.json()) as Array<{ closer: string | null }>) {
      if (r.closer) out.set(r.closer, (out.get(r.closer) ?? 0) + 1);
    }
  } catch {
    /* even split is fine if this fails */
  }
  return out;
}

/** Upcoming booked inspections, for the admin board. */
export async function listAppointments(limit = 100) {
  if (!dbOn()) return [];
  try {
    const res = await fetch(
      `${process.env.SUPABASE_URL}/rest/v1/appointments?select=*&status=eq.booked&order=slot_start.asc&limit=${limit}`,
      { headers: authHeaders(), cache: "no-store" },
    );
    if (!res.ok) return [];
    return (await res.json()) as Record<string, string>[];
  } catch {
    return [];
  }
}

/**
 * Cancel a booking and free the window.
 *
 * Flipping status off 'booked' is what releases the slot: the unique index
 * that prevents double-booking is partial on status='booked', so a cancelled
 * row stops blocking without being deleted. Keeping the row means a no-show
 * or a serial canceller is still visible.
 */
export async function cancelAppointment(
  id: string,
  by: "homeowner" | "office",
): Promise<{ ok: boolean; error?: string }> {
  if (!dbOn()) return { ok: false, error: "Scheduling is not configured." };
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { ok: false, error: "Not found." };
  try {
    const res = await fetch(
      `${process.env.SUPABASE_URL}/rest/v1/appointments?id=eq.${id}&status=eq.booked`,
      {
        method: "PATCH",
        headers: { ...authHeaders(), Prefer: "return=representation" },
        body: JSON.stringify({
          status: by === "homeowner" ? "canceled_by_homeowner" : "canceled_by_office",
          canceled_at: new Date().toISOString(),
        }),
      },
    );
    if (!res.ok) return { ok: false, error: "Could not cancel." };
    const rows = (await res.json()) as Array<{ id?: string }>;
    if (!Array.isArray(rows) || rows.length === 0) {
      return { ok: false, error: "That booking is already cancelled." };
    }
    // Put the job back, or the office keeps chasing an inspection that is no
    // longer happening.
    try {
      const { listJobs, updateJob, logEvent } = await import("@/lib/jobs");
      const job = (await listJobs({ limit: 500 })).find((j) => j.appointment_id === id);
      if (job && job.stage === "inspection_booked") {
        await updateJob(job.id, { stage: "contacted", appointment_id: null });
        await logEvent(
          job.id,
          "note",
          by === "homeowner" ? "Homeowner cancelled the inspection" : "Office cancelled the inspection",
        );
      }
    } catch {
      /* the cancellation itself already succeeded */
    }
    return { ok: true };
  } catch {
    return { ok: false, error: "Could not cancel." };
  }
}

/** One booking by id, for the manage-link page. */
export async function getAppointment(id: string) {
  if (!dbOn() || !/^[0-9a-f-]{36}$/i.test(id)) return null;
  try {
    const res = await fetch(
      `${process.env.SUPABASE_URL}/rest/v1/appointments?select=id,slot_start,slot_end,name,address,status,closer,setter,job_id,notes&id=eq.${id}`,
      { headers: authHeaders(), cache: "no-store" },
    );
    if (!res.ok) return null;
    const rows = (await res.json()) as Array<Record<string, string>>;
    return rows[0] || null;
  } catch {
    return null;
  }
}

/**
 * Day-of reminders for booked inspections.
 *
 * Claims the row FIRST by stamping reminded_at, then sends. If the send then
 * fails we lose a reminder rather than sending the same homeowner four of
 * them, because the hourly cron would otherwise retry every hour until the
 * window passed. The failure is recorded by sendMail either way.
 *
 * Fires for windows starting in the next 2 to 8 hours, which on the hourly
 * cron means one reminder, the morning of, for a window later that day.
 */
export async function runAppointmentReminders(resendKey?: string) {
  if (!dbOn() || !resendKey) return { sent: 0, skipped: "not configured" };
  const from = new Date(Date.now() + 2 * 3600 * 1000).toISOString();
  const to = new Date(Date.now() + 8 * 3600 * 1000).toISOString();

  try {
    const res = await fetch(
      `${process.env.SUPABASE_URL}/rest/v1/appointments` +
        `?select=id,slot_start,name,email,address&status=eq.booked` +
        `&reminded_at=is.null&slot_start=gte.${from}&slot_start=lte.${to}&limit=50`,
      { headers: authHeaders(), cache: "no-store" },
    );
    if (!res.ok) return { sent: 0, error: "query failed" };
    const rows = (await res.json()) as Array<{
      id: string; slot_start: string; name: string;
      email: string | null; address: string | null;
    }>;

    let sent = 0;
    for (const r of rows) {
      if (!r.email) continue;

      const claim = await fetch(
        `${process.env.SUPABASE_URL}/rest/v1/appointments?id=eq.${r.id}&reminded_at=is.null`,
        {
          method: "PATCH",
          headers: { ...authHeaders(), Prefer: "return=representation" },
          body: JSON.stringify({ reminded_at: new Date().toISOString() }),
        },
      );
      if (!claim.ok) continue;
      const claimed = (await claim.json()) as unknown[];
      if (!Array.isArray(claimed) || claimed.length === 0) continue;

      const when = new Date(r.slot_start).toLocaleString("en-US", {
        timeZone: TZ, weekday: "long", hour: "numeric", minute: "2-digit",
      });
      await sendAppointmentReminder(resendKey, {
        id: r.id,
        name: r.name,
        email: r.email,
        address: r.address || "",
        when,
      });
      sent++;
    }
    return { sent, candidates: rows.length };
  } catch {
    return { sent: 0, error: "failed" };
  }
}


/**
 * A booking is a job. Matching on address keeps a homeowner who books twice,
 * or who was already knocked, on one record instead of spawning duplicates.
 */
export async function upsertJobForBooking(a: {
  name: string;
  phone: string;
  email?: string;
  address?: string;
  /** The appointment row. */
  id?: string;
  /** The closer the booking was assigned to. */
  closer?: string | null;
  /** The setter who booked it, when it came from the door. */
  setter?: string | null;
  /** A job already known to belong to this house. */
  jobId?: string;
  /** Shown on the job timeline. */
  when?: string;
}): Promise<string | null> {
  if (!dbOn()) return null;
  const { listJobs, getJob, createJob, updateJob, logEvent } = await import("@/lib/jobs");
  const source = a.setter ? `Set by ${a.setter}` : "Booked from the website";
  const detail = [a.when, a.closer ? `with ${a.closer}` : "closer not yet assigned", source]
    .filter(Boolean)
    .join(" · ");
  try {
    const addr = (a.address || "").trim();
    const existing = a.jobId
      ? await getJob(a.jobId)
      : addr
        ? (await listJobs({ limit: 500 })).find(
            (j) => j.address.trim().toLowerCase() === addr.toLowerCase(),
          ) ?? null
        : null;

    let jobId: string | null = null;
    if (existing) {
      jobId = existing.id;
      await updateJob(existing.id, {
        stage:
          existing.stage === "new" || existing.stage === "contacted" || existing.stage === "lost"
            ? "inspection_booked"
            : existing.stage,
        appointment_id: a.id ?? null,
        phone: existing.phone || a.phone,
        email: existing.email || a.email || null,
        // Only credit a setter who actually set it, and never overwrite one.
        ...(a.setter && !existing.setter ? { setter: a.setter } : {}),
        // The closer is whoever is driving to it, so it moves with the booking.
        ...(a.closer ? { closer: a.closer, rep: a.closer } : {}),
      });
    } else {
      if (!addr) return null;
      const job = await createJob({
        address: addr,
        owner_name: a.name,
        phone: a.phone,
        email: a.email || null,
        stage: "inspection_booked",
        appointment_id: a.id ?? null,
        setter: a.setter ?? null,
        closer: a.closer ?? null,
        rep: a.closer ?? a.setter ?? null,
        // Credit the creation to whoever booked it; it read "Job created" with
        // no name, so the first line of the record said nobody made it.
      }, a.setter ?? "Website");
      jobId = job?.id ?? null;
    }
    if (jobId) {
      await logEvent(jobId, "appointment", detail, a.setter ?? undefined);
      // Tie the inspection back to the job by id, not by matching addresses.
      if (a.id) {
        await fetch(`${process.env.SUPABASE_URL}/rest/v1/appointments?id=eq.${a.id}`, {
          method: "PATCH",
          headers: { ...authHeaders(), Prefer: "return=minimal" },
          body: JSON.stringify({ job_id: jobId }),
        });
      }
    }
    return jobId;
  } catch {
    /* a CRM write must never cost the booking */
    return null;
  }
}

/** A team member's email by name, for telling a closer about their booking. */
export async function memberEmail(name?: string | null): Promise<string | null> {
  if (!dbOn() || !name) return null;
  try {
    const res = await fetch(
      `${process.env.SUPABASE_URL}/rest/v1/team_members?select=email&active=is.true&name=eq.${encodeURIComponent(name)}&limit=1`,
      { headers: authHeaders(), cache: "no-store" },
    );
    if (!res.ok) return null;
    const rows = (await res.json()) as Array<{ email: string }>;
    return rows[0]?.email ?? null;
  } catch {
    return null;
  }
}

/**
 * Tell the assigned closer, best effort. Shared by the public booking form and
 * the setter's door booking so the closer hears about it either way.
 */
export async function notifyCloser(a: {
  closer?: string | null;
  name: string;
  phone: string;
  address: string;
  dayLabel: string;
  timeLabel: string;
  setter?: string | null;
  note?: string;
  jobId?: string | null;
}) {
  const key = process.env.RESEND_API_KEY;
  if (!key || !a.closer) return false;
  const to = await memberEmail(a.closer);
  if (!to) return false;
  try {
    const { sendCloserAssignment } = await import("@/lib/emails");
    const r = await sendCloserAssignment(key, to, { ...a, closer: a.closer });
    return !!(r as { ok?: boolean } | undefined)?.ok;
  } catch {
    return false;
  }
}

/**
 * Inspections a setter put on the calendar since a date, whatever became of
 * them.
 *
 * Today counted a setter's sets from the booked list, so the moment a closer
 * inspected one it dropped out of the setter's "set this week". A setter whose
 * five sets were all inspected saw zero, and sets are what setters are paid
 * on. Cancelled ones do not count; completed and no-shows do, because the set
 * was made either way.
 */
export async function setsSince(setter: string, sinceIso: string) {
  if (!dbOn() || !setter) return [] as Array<{ id: string; status: string; slot_start: string }>;
  try {
    const res = await fetch(
      `${process.env.SUPABASE_URL}/rest/v1/appointments?select=id,status,slot_start&setter=eq.${encodeURIComponent(setter)}&created_at=gte.${sinceIso}&status=not.like.cancel*`,
      { headers: authHeaders(), cache: "no-store" },
    );
    if (!res.ok) return [];
    return (await res.json()) as Array<{ id: string; status: string; slot_start: string }>;
  } catch {
    return [];
  }
}
