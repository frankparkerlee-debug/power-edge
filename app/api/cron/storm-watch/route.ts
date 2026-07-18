import { NextResponse } from "next/server";
import { runStormWatch } from "@/lib/storm";
import { runSolarPermitSync } from "@/lib/solarPermits";

/**
 * Storm engine ingest. The hourly claim-nurture cron chains this automatically,
 * so no separate cron is required — this route exists for manual runs/backfill:
 *   POST /api/cron/storm-watch            header: x-admin-token: <ADMIN_TOKEN>
 *   POST /api/cron/storm-watch?days=365   backfill a year of storm reports
 *   POST /api/cron/storm-watch?solar=1    force a solar-permit sync page-pull
 */
export async function POST(req: Request) {
  const token = req.headers.get("x-admin-token");
  if (!process.env.ADMIN_TOKEN || token !== process.env.ADMIN_TOKEN) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const url = new URL(req.url);
  const days = Math.min(730, Math.max(1, parseInt(url.searchParams.get("days") || "3", 10)));
  const storm = await runStormWatch(days);
  const solar = url.searchParams.get("solar")
    ? await runSolarPermitSync()
    : { fetched: 0, ok: true };
  return NextResponse.json({ ok: storm.ok && solar.ok, storm, solar });
}
