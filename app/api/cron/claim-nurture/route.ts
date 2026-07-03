import { NextResponse } from "next/server";
import { listIncompleteIntakes, markIntakeNurtured } from "@/lib/db";
import { sendClaimNurture } from "@/lib/emails";

/**
 * Drop-off nurture for claim-prep. Run on a schedule (e.g. hourly) — a Render
 * Cron Job or any external cron hitting:
 *   POST /api/cron/claim-nurture   header: x-admin-token: <ADMIN_TOKEN>
 *
 * Two touches for homeowners who started but didn't book (completed=false):
 *   • touch 1 (~2h after last activity): "Your roof claim, made easy"
 *   • touch 2 (~2 days later, if still not booked): "You're almost there"
 * Booked homeowners (completed=true) are excluded and get the confirmation email.
 */

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function POST(req: Request) {
  const token = req.headers.get("x-admin-token");
  if (!process.env.ADMIN_TOKEN || token !== process.env.ADMIN_TOKEN) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) {
    return NextResponse.json({ error: "RESEND_API_KEY not set" }, { status: 500 });
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

  return NextResponse.json({ ok: true, candidates: candidates.length, touch1, touch2 });
}
