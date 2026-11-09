import { NextResponse } from "next/server";
import { availableSlots, bookSlot } from "@/lib/scheduling";
import { sendAppointmentConfirmation } from "@/lib/emails";

export const dynamic = "force-dynamic";

/** GET /api/appointments — open inspection windows, grouped by day. */
export async function GET() {
  const days = await availableSlots();
  return NextResponse.json({ ok: true, days });
}

/** POST /api/appointments — book one window. */
export async function POST(req: Request) {
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

  const result = await bookSlot({
    slot_start: String(body.slot_start || ""),
    name: String(body.name || ""),
    phone: String(body.phone || ""),
    email: String(body.email || ""),
    address: String(body.address || ""),
    notes: String(body.notes || ""),
    source: String(body.source || "web"),
    claim_intake_id: String(body.claim_intake_id || "") || undefined,
  });

  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.error, code: result.code },
      { status: result.code === "taken" ? 409 : 400 },
    );
  }

  // Confirmations are best-effort — a mail hiccup must never lose the booking.
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
