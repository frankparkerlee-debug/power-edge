import { NextResponse } from "next/server";
import { refreshRadar, refreshWind } from "@/lib/stormDataRefresh";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * Daily storm data for Best doors and the Knock map (Supabase pg_cron,
 * 13:20 and 17:20 UTC; see supabase/radar_refresh.sql):
 *
 *   POST /api/cron/radar-refresh                header x-admin-token: <ADMIN_TOKEN>
 *       new radar hail days -> hail_days, last 3 days of wind reports -> wind_reports
 *   POST /api/cron/radar-refresh?from=2026-04-20&days=10&wind_days=760
 *       re-read a range of radar days, or backfill wind reports
 *
 * public.refresh_cell_signals() runs 30 minutes later and rebuilds what the
 * Map reads. Both halves are safe to re-run.
 */
export async function POST(req: Request) {
  const token = req.headers.get("x-admin-token");
  if (!process.env.ADMIN_TOKEN || token !== process.env.ADMIN_TOKEN) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const url = new URL(req.url);
  const from = url.searchParams.get("from");
  const days = Number(url.searchParams.get("days") || "") || undefined;
  const windDays = Number(url.searchParams.get("wind_days") || "") || undefined;
  const out: Record<string, unknown> = {};
  let ok = true;
  try {
    out.radar = await refreshRadar({ from: from && /^\d{4}-\d{2}-\d{2}$/.test(from) ? from : undefined, maxDays: days });
  } catch (e) {
    ok = false;
    out.radarError = e instanceof Error ? e.message : String(e);
  }
  try {
    out.wind = await refreshWind({ days: windDays });
  } catch (e) {
    ok = false;
    out.windError = e instanceof Error ? e.message : String(e);
  }
  if (!ok) console.error("[radar-refresh]", out);
  return NextResponse.json({ ok, ...out }, { status: ok ? 200 : 502 });
}
