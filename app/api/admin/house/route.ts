import { NextResponse } from "next/server";

/**
 * House dossier for the knock tools: given a target's coordinates, return
 *   • roof measurement from Google Solar satellite data (squares + pitch)
 *   • every storm report near the house (what "could have impacted them")
 * GET /api/admin/house?key=<ADMIN_TOKEN>&lat=..&lon=..
 * Solar responses cache 30d (roofs don't change; controls API cost).
 */

const STORM_RADIUS_MI = 10;

function haversineMi(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 3958.8;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function measureRoof(lat: number, lon: number) {
  const key = process.env.GOOGLE_SOLAR_API_KEY || process.env.GOOGLE_MAPS_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch(
      `https://solar.googleapis.com/v1/buildingInsights:findClosest?location.latitude=${lat}&location.longitude=${lon}&requiredQuality=LOW&key=${key}`,
      { signal: AbortSignal.timeout(9000), next: { revalidate: 2592000 } },
    );
    if (!res.ok) return null;
    const data = await res.json();
    const m2 = data?.solarPotential?.wholeRoofStats?.areaMeters2;
    if (!m2 || m2 < 30) return null;
    const roofSqft = Math.round(m2 * 10.7639);
    // Same math the public estimator shows: area ÷ 100 = squares, +10% waste.
    const squares = Math.round((roofSqft / 100) * 1.1 * 10) / 10;
    const segs: Array<{ pitchDegrees?: number; stats?: { areaMeters2?: number } }> =
      data?.solarPotential?.roofSegmentStats || [];
    let wsum = 0;
    let asum = 0;
    for (const s of segs) {
      const a = s?.stats?.areaMeters2 || 0;
      if (a && typeof s.pitchDegrees === "number") {
        wsum += s.pitchDegrees * a;
        asum += a;
      }
    }
    return {
      roofSqft,
      squares,
      pitchDeg: asum ? Math.round(wsum / asum) : null,
    };
  } catch {
    return null;
  }
}

async function stormsNear(lat: number, lon: number) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
  if (!url || !key) return [];
  const dLat = STORM_RADIUS_MI / 69;
  const dLon = STORM_RADIUS_MI / (69 * Math.cos((lat * Math.PI) / 180));
  const res = await fetch(
    `${url}/rest/v1/storm_events?select=valid_at,type,magnitude,city,lat,lon` +
      `&lat=gte.${(lat - dLat).toFixed(5)}&lat=lte.${(lat + dLat).toFixed(5)}` +
      `&lon=gte.${(lon - dLon).toFixed(5)}&lon=lte.${(lon + dLon).toFixed(5)}` +
      `&order=valid_at.desc&limit=200`,
    { headers: { apikey: key, Authorization: `Bearer ${key}` }, cache: "no-store" },
  );
  if (!res.ok) return [];
  const rows = (await res.json()) as Array<{
    valid_at: string;
    type: string;
    magnitude: number | null;
    city: string;
    lat: number;
    lon: number;
  }>;
  return rows
    .map((r) => ({
      date: r.valid_at.slice(0, 10),
      type: r.type,
      magnitude: r.magnitude,
      city: r.city,
      mi: Math.round(haversineMi(lat, lon, r.lat, r.lon) * 10) / 10,
    }))
    .filter((r) => r.mi <= STORM_RADIUS_MI);
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  if (
    !process.env.ADMIN_TOKEN ||
    url.searchParams.get("key") !== process.env.ADMIN_TOKEN
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const lat = parseFloat(url.searchParams.get("lat") || "");
  const lon = parseFloat(url.searchParams.get("lon") || "");
  if (!(lat > 25 && lat < 37 && lon > -107 && lon < -93)) {
    return NextResponse.json({ error: "Bad coordinates" }, { status: 400 });
  }
  const [roof, storms] = await Promise.all([measureRoof(lat, lon), stormsNear(lat, lon)]);
  return NextResponse.json({ ok: true, roof, storms });
}
