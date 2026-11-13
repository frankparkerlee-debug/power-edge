import { NextResponse } from "next/server";
import { apiUser } from "@/lib/auth";
import { fieldReady, notReadyMessage } from "@/lib/fieldReady";
import { availableSlots, bookSlot, upsertJobForBooking, notifyCloser } from "@/lib/scheduling";
import { sendAppointmentConfirmation } from "@/lib/emails";

/**
 * A setter books an inspection at the door.
 *
 * Before this, tapping "Appt set" on the knock map wrote the word to a knocks
 * table and nothing else: no time, no appointment, no job, no closer told. The
 * only real booking path was the public homeowner form, which also limited
 * each IP to three bookings a day, so a setter working from their own phone
 * was cut off after the third set with a message written for a homeowner.
 *
 * One call now does the whole handoff:
 *   books a window and assigns a closer who is free in it
 *   creates or updates the job, credits the setter, puts it at
 *     inspection_booked
 *   records the door as appointment set, so no other setter knocks it
 *   emails the homeowner a confirmation, when there is an address to send to
 *   leaves the setter's note where the closer will read it
 *
 *   GET  /api/admin/book              open windows, for the picker
 *   POST /api/admin/book              { slot_start, name, phone, email?,
 *                                       address, note?, target_id?, job_id? }
 */
export const dynamic = "force-dynamic";

function db() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
  return { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
}

export async function GET(req: Request) {
  const u = await apiUser(req);
  if (!u) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ ok: true, days: await availableSlots() });
}

export async function POST(req: Request) {
  const u = await apiUser(req);
  if (!u) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const fr = await fieldReady(u);
  if (!fr.ready) return NextResponse.json({ ok: false, error: notReadyMessage(fr.missing) }, { status: 403 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
  }

  const str = (k: string) => String(body[k] ?? "").trim();
  const targetId = str("target_id");
  const address = str("address");
  if (!address) {
    return NextResponse.json(
      { ok: false, error: "Add the property address." },
      { status: 400 },
    );
  }

  const result = await bookSlot({
    slot_start: str("slot_start"),
    name: str("name"),
    phone: str("phone"),
    email: str("email"),
    address,
    notes: str("note"),
    source: "setter",
    setter: u.name,
    job_id: str("job_id") || undefined,
  });
  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.error, code: result.code },
      { status: result.code === "taken" ? 409 : 400 },
    );
  }

  const when = `${result.slot.dayLabel}, ${result.slot.timeLabel}`;
  const jobId = await upsertJobForBooking({
    name: str("name"),
    phone: str("phone"),
    email: str("email"),
    address,
    id: result.id,
    closer: result.closer ?? null,
    setter: u.name,
    jobId: str("job_id") || undefined,
    when,
  });

  // The setter's note goes on the job, where the closer reads before driving
  // over: who decides, the dog, the gate code, what the roof looked like.
  const note = str("note");
  if (jobId && note) {
    const { logEvent } = await import("@/lib/jobs");
    await logEvent(jobId, "note", `From the setter: ${note}`, u.name);
  }

  // The door is spoken for. Without this the next setter down the street
  // knocks a house that already has an inspection booked.
  if (/^[0-9a-f-]{36}$/i.test(targetId) && process.env.SUPABASE_URL) {
    const { settleComeBacks } = await import("@/lib/knocks");
    await settleComeBacks(targetId);
    try {
      await fetch(`${process.env.SUPABASE_URL}/rest/v1/knocks`, {
        method: "POST",
        headers: { ...db(), Prefer: "return=minimal" },
        body: JSON.stringify({
          target_id: targetId,
          outcome: "appointment_set",
          rep: u.name,
          note: when,
        }),
      });
      await fetch(`${process.env.SUPABASE_URL}/rest/v1/storm_targets?id=eq.${targetId}`, {
        method: "PATCH",
        headers: { ...db(), Prefer: "return=minimal" },
        body: JSON.stringify({ status: "converted" }),
      });
      if (jobId) {
        await fetch(`${process.env.SUPABASE_URL}/rest/v1/jobs?id=eq.${jobId}`, {
          method: "PATCH",
          headers: { ...db(), Prefer: "return=minimal" },
          body: JSON.stringify({ storm_target_id: targetId }),
        });
      }
    } catch {
      /* the booking and the job are what matter */
    }
  }

  // Confirmation to the homeowner, best effort. A mail hiccup never loses the
  // booking, and the setter is told whether it went.
  let emailed = false;
  const email = str("email");
  if (email && process.env.RESEND_API_KEY) {
    try {
      const r = await sendAppointmentConfirmation(process.env.RESEND_API_KEY, {
        name: str("name"),
        phone: str("phone"),
        email,
        address,
        notes: "",
        dayLabel: result.slot.dayLabel,
        timeLabel: result.slot.timeLabel,
        id: result.id,
        closer: result.closer ?? null,
        setter: u.name,
      });
      emailed = !!r?.ok;
    } catch {
      /* booking already persisted */
    }
  }

  const closerTold = await notifyCloser({
    closer: result.closer ?? null,
    name: str("name"),
    phone: str("phone"),
    address,
    dayLabel: result.slot.dayLabel,
    timeLabel: result.slot.timeLabel,
    setter: u.name,
    note,
    jobId,
  });

  return NextResponse.json({
    ok: true,
    closerTold,
    jobId,
    appointmentId: result.id,
    closer: result.closer ?? null,
    when,
    emailed,
  });
}
