import { NextResponse } from "next/server";
import { runOnboardingSequence } from "@/lib/onboardingSequence";

/**
 * Run the onboarding sequence now. The hourly claim-nurture cron already does
 * this; this route is for running it by hand.
 *   POST /api/cron/onboarding   header: x-admin-token: <ADMIN_TOKEN>
 *
 * Off production, x-now (an ISO time) pretends it's that moment, so the whole
 * sequence can be walked through day by day on the local test copy.
 */
export async function POST(req: Request) {
  const token = req.headers.get("x-admin-token");
  if (!process.env.ADMIN_TOKEN || token !== process.env.ADMIN_TOKEN) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const test = process.env.NODE_ENV !== "production";
  const at = test ? Date.parse(req.headers.get("x-now") || "") : NaN;
  const result = await runOnboardingSequence({ now: Number.isNaN(at) ? undefined : at, anyHour: test && req.headers.get("x-any-hour") === "1" });
  return NextResponse.json(result);
}
