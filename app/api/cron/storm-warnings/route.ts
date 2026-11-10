import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { runStormWarnings } from "@/lib/stormWarnings";

export const dynamic = "force-dynamic";

/**
 * Storm-warning check. Meant to run every 2 minutes (Supabase pg_cron).
 *
 *   POST /api/cron/storm-warnings     header x-admin-token: <ADMIN_TOKEN>
 *       live run: records warnings and hits, emails the team and homeowners
 *
 *   GET  /api/cron/storm-warnings?key=...&sts=2026-04-26T00:00Z&ets=2026-04-26T08:00Z
 *       replay a past window. Always a dry run: nothing is written or sent.
 */
export async function POST(req: Request) {
  const token = req.headers.get("x-admin-token");
  if (!process.env.ADMIN_TOKEN || token !== process.env.ADMIN_TOKEN) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const result = await runStormWarnings();
  return NextResponse.json(result, { status: result.ok ? 200 : 502 });
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const admin = await requireAdmin(url.searchParams.get("key") ?? undefined);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const sts = url.searchParams.get("sts");
  const ets = url.searchParams.get("ets");
  // ?points=lat,lon;lat,lon to check "would these spots have been inside?"
  const testPoints = (url.searchParams.get("points") || "")
    .split(";")
    .map((s) => s.split(",").map(Number))
    .filter(([lat, lon]) => Number.isFinite(lat) && Number.isFinite(lon))
    .map(([lat, lon]) => ({ lat, lon, label: `${lat},${lon}` }));
  const result = await runStormWarnings({
    dry: true,
    window: sts && ets ? { sts, ets } : undefined,
    testPoints,
  });
  return NextResponse.json(result, { status: result.ok ? 200 : 502 });
}
