import { NextResponse } from "next/server";
import { listIncompleteIntakes, markIntakeNurtured } from "@/lib/db";
import { sendClaimNurture } from "@/lib/emails";
import { runStormWatch, localDay, addDays } from "@/lib/storm";
import { generateStormTargets } from "@/lib/parcels";
import { runStormJobAlerts } from "@/lib/stormAlerts";
import { runSkipTrace } from "@/lib/skiptrace";
import { runAppointmentReminders } from "@/lib/scheduling";

/**
 * Drop-off nurture for claim-prep. Run on a schedule (e.g. hourly), a Render
 * Cron Job or any external cron hitting:
 *   POST /api/cron/claim-nurture   header: x-admin-token: <ADMIN_TOKEN>
 *
 * Two touches for homeowners who started but didn't book (completed=false):
 *   • touch 1 (~2h after last activity): "Your roof claim, made easy"
 *   • touch 2 (~2 days later, if still not booked): "You're almost there"
 * Booked homeowners (completed=true) are excluded and get the confirmation email.
 */

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Stamp that this job ran.
 *
 * Health used to infer liveness from when a storm row was last inserted,
 * which meant a quiet week of weather looked identical to a dead cron. The
 * run itself is the thing that proves the job is alive; what it found is a
 * separate question.
 */
async function recordRun(detail: Record<string, unknown>, ok = true) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return;
  try {
    await fetch(`${url}/rest/v1/cron_runs`, {
      method: "POST",
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({ job: "claim-nurture", ok, detail }),
    });
  } catch {
    /* never fail the run over its own bookkeeping */
  }
}

export async function POST(req: Request) {
  const token = req.headers.get("x-admin-token");
  if (!process.env.ADMIN_TOKEN || token !== process.env.ADMIN_TOKEN) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  // Storm engine piggybacks on this hourly cron (also serves as the Supabase
  // free-tier keep-alive). Ingest is best-effort and never blocks nurture.
  const storm = await runStormWatch();
  // Auto-generate homeowner targets for fresh hail: the storm night that
  // started this morning and the one that started yesterday morning (local
  // 7am to 7am). Idempotent (unique storm_date+address), no-op on hail-free days.
  const today = localDay(new Date().toISOString());
  const yesterday = addDays(today, -1);
  const targetsToday = await generateStormTargets(today);
  const targetsYday = await generateStormTargets(yesterday);
  // Fresh hail near an open job lands on that job's timeline, which is
  // where the office and the rep already look.
  const stormAlerts = await runStormJobAlerts();
  // Skip-trace the highest-score untraced targets (no-op until BATCHDATA_API_KEY).
  const skiptrace = await runSkipTrace();
  // Day-of reminders for inspections booked through the site.
  const reminders = await runAppointmentReminders(process.env.RESEND_API_KEY);

  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) {
    await recordRun({ error: "RESEND_API_KEY not set", storm }, false);
    return NextResponse.json({ ok: false, error: "RESEND_API_KEY not set", storm });
  }

  const now = Date.now();
  const twoHoursAgo = new Date(now - 2 * 3600 * 1000).toISOString();
  const twoDaysAgo = now - 2 * 86400 * 1000;

  const candidates = await listIncompleteIntakes(twoHoursAgo);
  let touch1 = 0;
  let touch2 = 0;

  for (const c of candidates) {
    if (!c.email || !c.id) continue;
    const nurtured = c.nurtured_stage ?? 0;
    const updatedMs = c.updated_at ? new Date(c.updated_at).getTime() : 0;

    if (nurtured === 0) {
      await sendClaimNurture(resendKey, c, 1);
      await markIntakeNurtured(c.id, 1);
      touch1++;
      await sleep(600);
    } else if (nurtured === 1 && updatedMs < twoDaysAgo) {
      await sendClaimNurture(resendKey, c, 2);
      await markIntakeNurtured(c.id, 2);
      touch2++;
      await sleep(600);
    }
  }

  const summary = {
    candidates: candidates.length,
    touch1,
    touch2,
    storm,
    targets: { today: targetsToday, yesterday: targetsYday },
    stormAlerts,
    skiptrace,
    reminders,
  };
  await recordRun(summary);

  return NextResponse.json({
    ok: true,
    candidates: candidates.length,
    touch1,
    touch2,
    storm,
    targets: { today: targetsToday, yesterday: targetsYday },
    stormAlerts,
    skiptrace,
    reminders,
  });
}
