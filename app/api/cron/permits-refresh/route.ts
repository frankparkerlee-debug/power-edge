import { NextResponse } from "next/server";
import { refreshPermits } from "@/lib/stormDataRefresh";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * New City of Dallas re-roof permits for Best doors and the Knock map's blue
 * pins (Supabase pg_cron, Mondays 15:30 UTC; see supabase/radar_refresh.sql):
 *
 *   POST /api/cron/permits-refresh                 header x-admin-token: <ADMIN_TOKEN>
 *   POST /api/cron/permits-refresh?lookback=120    look further back (days)
 *
 * Permits are geocoded with the free Census geocoder; the few it cannot place
 * are skipped, as in the original load.
 */
export async function POST(req: Request) {
  const token = req.headers.get("x-admin-token");
  if (!process.env.ADMIN_TOKEN || token !== process.env.ADMIN_TOKEN) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const lookback = Number(new URL(req.url).searchParams.get("lookback") || "") || undefined;
  try {
    return NextResponse.json({ ok: true, permits: await refreshPermits({ lookbackDays: lookback }) });
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    console.error("[permits-refresh]", error);
    return NextResponse.json({ ok: false, error }, { status: 502 });
  }
}
