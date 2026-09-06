import { NextResponse } from "next/server";
import { runStormWatch } from "@/lib/storm";
import { generateStormTargets } from "@/lib/parcels";

/**
 * Storm engine ingest. The hourly claim-nurture cron chains this automatically,
 * so no separate cron is required — this route exists for manual runs/backfill:
 *   POST /api/cron/storm-watch                     header: x-admin-token: <ADMIN_TOKEN>
 *   POST /api/cron/storm-watch?days=365            backfill a year of storm reports
 *   POST /api/cron/storm-watch?targets=2026-04-28  parcel-intersect a storm day →
 *                                                  homeowner targets (storm_targets)
 */
export async function POST(req: Request) {
  const token = req.headers.get("x-admin-token");
  if (!process.env.ADMIN_TOKEN || token !== process.env.ADMIN_TOKEN) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const url = new URL(req.url);
  const days = Math.min(730, Math.max(1, parseInt(url.searchParams.get("days") || "3", 10)));
  const storm = await runStormWatch(days);
  const targetDate = url.searchParams.get("targets");
  const targets = targetDate && /^\d{4}-\d{2}-\d{2}$/.test(targetDate)
    ? await generateStormTargets(targetDate)
    : null;
  return NextResponse.json({ ok: storm.ok, storm, targets });
}
