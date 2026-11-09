import { NextResponse } from "next/server";
import { availableSlots, bookSlot, bookingsFromIpToday } from "@/lib/scheduling";
import { burst, clientIp, tooMany } from "@/lib/rateLimit";
import { sendAppointmentConfirmation } from "@/lib/emails";

export const dynamic = "force-dynamic";

/** GET /api/appointments: open inspection windows, grouped by day. */
export async function GET(req: Request) {
  const wait = burst(`slots:${clientIp(req)}`, 60, 60_000);
  if (wait) return tooMany(wait);
  const days = await availableSlots();
  return NextResponse.json({ ok: true, days });
}

/** POST /api/appointments: book one window. */
/** One source may hold this many live windows in a 24h period. */
const MAX_BOOKINGS_PER_IP_PER_DAY = 3;

export async function POST(req: Request) {
  const ip = clientIp(req);
  // Burst gate first: cheap, and it absorbs a script before it touches the DB.
  const wait = burst(`book:${ip}`, 8, 10 * 60_000);
  if (wait) return tooMany(wait, "Too many booking attempts. Call us and we'll set it up.");

  let body: Record<string, string>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
  }

  // Same honeypot + speed trap the other forms use.
  if (String(body.company_website || "").trim()) {
    return NextResponse.json({ ok: true, booked: true });
  }

  // Durable cap. Every slot taken is one a real homeowner can no longer have,
  // so this has to survive restarts and hold across instances.
  const already = await bookingsFromIpToday(ip);
  if (already >= MAX_BOOKINGS_PER_IP_PER_DAY) {
    return NextResponse.json(
      {
        ok: false,
        error: "You already have inspections booked. Call us to add another.",
        code: "limit",
      },
      { status: 429 },
    );
  }

  const result = await bookSlot({
    slot_start: String(body.slot_start || ""),
    name: String(body.name || ""),
    phone: String(body.phone || ""),
    email: String(body.email || ""),
    address: String(body.address || ""),
    notes: String(body.notes || ""),
    source: String(body.source || "web"),
    claim_intake_id: String(body.claim_intake_id || "") || undefined,
    ip,
  });

  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.error, code: result.code },
      { status: result.code === "taken" ? 409 : 400 },
    );
  }

  // Confirmations are best-effort. A mail hiccup must never lose the booking.
  try {
    const key = process.env.RESEND_API_KEY;
    if (key) {
      await sendAppointmentConfirmation(key, {
        name: String(body.name || ""),
        phone: String(body.phone || ""),
        email: String(body.email || ""),
        address: String(body.address || ""),
        notes: String(body.notes || ""),
        dayLabel: result.slot.dayLabel,
        timeLabel: result.slot.timeLabel,
        id: result.id,
      });
    }
  } catch {
    /* booking already persisted */
  }

  return NextResponse.json({
    ok: true,
    booked: true,
    slot: { dayLabel: result.slot.dayLabel, timeLabel: result.slot.timeLabel },
  });
}
