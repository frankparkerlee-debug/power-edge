import { NextResponse } from "next/server";
import { apiUser, canSell } from "@/lib/auth";
import { getJob, updateJob, logEvent } from "@/lib/jobs";
import { sendInspectionAssessment } from "@/lib/emails";

/**
 * Record what an inspection found.
 *
 * The `inspected` stage existed and nothing ever wrote it, so a job jumped
 * from "inspection booked" straight to "agreement sent" with no record of the
 * visit, and the written assessment every booking confirmation promises had
 * no moment to come from.
 *
 *   qualifies  storm damage found      -> inspected, homeowner gets findings
 *   fine       no claimable damage     -> lost (roof is fine), homeowner gets
 *                                         the good news in writing
 *   no_show    nobody home / postponed -> back to contacted, to rebook
 *
 *   POST /api/admin/jobs/:id/inspection { verdict, findings?, squares?, homeownerPresent }
 *
 * homeownerPresent is required for qualifies and fine: whether the homeowner
 * was there is part of what makes it a held inspection, which pays the
 * knocker's $50 (lib/held.ts). It is stored on the appointment.
 */
export const dynamic = "force-dynamic";

function db() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
  return { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
}

function today() {
  return new Date().toLocaleDateString("en-US", {
    timeZone: "America/Chicago",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const u = await apiUser(req);
  if (!u) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  // Inspections are the closer's. A setter recording a verdict would be
  // telling a homeowner something about a roof they never looked at.
  if (!canSell(u.role)) {
    return NextResponse.json(
      { ok: false, error: "Inspections are recorded by the closer." },
      { status: 403 },
    );
  }

  const { id } = await ctx.params;
  const job = await getJob(id);
  if (!job) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });

  let body: { verdict?: string; findings?: string; squares?: string | number; homeownerPresent?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
  }

  const verdict = String(body.verdict || "");
  if (!["qualifies", "fine", "no_show"].includes(verdict)) {
    return NextResponse.json({ ok: false, error: "Pick what you found." }, { status: 400 });
  }
  const findings = String(body.findings || "").trim().slice(0, 1200);
  const sq = Number(String(body.squares ?? "").replace(/[^0-9.]/g, ""));
  const present = typeof body.homeownerPresent === "boolean" ? body.homeownerPresent : null;
  if (verdict !== "no_show" && present === null) {
    return NextResponse.json({ ok: false, error: "Say whether the homeowner was there." }, { status: 400 });
  }

  if (verdict === "no_show") {
    await updateJob(id, { stage: "contacted", appointment_id: null }, u.name);
    await logEvent(id, "note", `Inspection did not happen${findings ? `: ${findings}` : ""}. Needs rebooking.`, u.name);
    await closeAppointment(job.appointment_id, "no_show");
    return NextResponse.json({ ok: true, stage: "contacted", emailed: false });
  }

  const stage = verdict === "qualifies" ? "inspected" : "lost";
  await updateJob(
    id,
    {
      stage: stage as never,
      closer: job.closer ?? u.name,
      ...(Number.isFinite(sq) && sq > 0 ? { squares: sq } : {}),
      ...(verdict === "fine" ? { lost_reason: "Roof is fine, no claim" } : {}),
    },
    u.name,
  );
  await logEvent(
    id,
    "inspection",
    `${verdict === "qualifies" ? "Damage found" : "Roof is fine"}${findings ? `: ${findings}` : ""}. Homeowner ${present ? "was" : "was not"} there.`,
    u.name,
  );
  await closeAppointment(job.appointment_id, "completed", present);

  // The written assessment. Promised on every booking, sent for both answers.
  let emailed = false;
  if (job.email && process.env.RESEND_API_KEY) {
    try {
      const r = await sendInspectionAssessment(process.env.RESEND_API_KEY, {
        name: job.owner_name || "",
        email: job.email,
        address: job.address,
        inspectedOn: today(),
        closer: u.name,
        verdict: verdict as "qualifies" | "fine",
        findings,
        jobId: id,
      });
      emailed = !!r?.ok;
    } catch {
      /* the verdict is recorded either way */
    }
  }
  await logEvent(
    id,
    "note",
    emailed
      ? `Written assessment emailed to ${job.email}`
      : job.email
        ? `Written assessment did NOT send to ${job.email}. Resend or tell them.`
        : "No email on file, so the written assessment has to be handed over.",
    u.name,
  );

  return NextResponse.json({ ok: true, stage, emailed });
}

async function closeAppointment(apptId: string | null, status: string, homeownerPresent?: boolean | null) {
  if (!apptId || !process.env.SUPABASE_URL) return;
  try {
    await fetch(`${process.env.SUPABASE_URL}/rest/v1/appointments?id=eq.${apptId}`, {
      method: "PATCH",
      headers: { ...db(), Prefer: "return=minimal" },
      body: JSON.stringify(
        typeof homeownerPresent === "boolean" ? { status, homeowner_present: homeownerPresent } : { status },
      ),
    });
  } catch {
    /* the job carries the truth */
  }
}
