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

/** Slots already taken in the booking window. */
async function bookedStarts(): Promise<Set<string>> {
  if (!dbOn()) return new Set();
  try {
    const since = new Date(Date.now() - 3600 * 1000).toISOString();
    const res = await fetch(
      `${process.env.SUPABASE_URL}/rest/v1/appointments?select=slot_start&status=eq.booked&slot_start=gte.${since}`,
      { headers: authHeaders(), cache: "no-store" },
    );
    if (!res.ok) return new Set();
    const rows: { slot_start: string }[] = await res.json();
    return new Set(rows.map((r) => new Date(r.slot_start).toISOString()));
  } catch {
    return new Set();
  }
}

/** Open slots, grouped by day, ready for the picker. */
export async function availableSlots() {
  const taken = await bookedStarts();
  const open = candidateSlots().filter((s) => !taken.has(s.start));
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
};

export type BookingResult =
  | { ok: true; slot: Slot; id?: string }
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
      }),
    });
    if (res.status === 409)
      return { ok: false, error: "Someone just took that window. Pick another.", code: "taken" };
    if (!res.ok) return { ok: false, error: "Could not save that booking.", code: "db" };
    const rows = (await res.json()) as Array<{ id?: string }>;
    return { ok: true, slot, id: rows?.[0]?.id };
  } catch {
    return { ok: false, error: "Could not save that booking.", code: "db" };
  }
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
    const rows = (await res.json()) as unknown[];
    if (!Array.isArray(rows) || rows.length === 0) {
      return { ok: false, error: "That booking is already cancelled." };
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
      `${process.env.SUPABASE_URL}/rest/v1/appointments?select=id,slot_start,slot_end,name,address,status&id=eq.${id}`,
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
