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

export type BookingInput = {
  slot_start: string;
  name: string;
  phone: string;
  email?: string;
  address?: string;
  notes?: string;
  source?: string;
  claim_intake_id?: string;
};

export type BookingResult =
  | { ok: true; slot: Slot }
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
  if (!dbOn()) return { ok: false, error: "Scheduling is not configured.", code: "db" };

  try {
    const res = await fetch(`${process.env.SUPABASE_URL}/rest/v1/appointments`, {
      method: "POST",
      headers: { ...authHeaders(), Prefer: "return=minimal" },
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
      }),
    });
    if (res.status === 409)
      return { ok: false, error: "Someone just took that window. Pick another.", code: "taken" };
    if (!res.ok) return { ok: false, error: "Could not save that booking.", code: "db" };
    return { ok: true, slot };
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
