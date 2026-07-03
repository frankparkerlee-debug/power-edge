import { NextResponse } from "next/server";

/**
 * DFW-wide hail activity for the homepage "live storm intelligence" band.
 * Same free NWS/IEM source as the address-level storm check, but metro-wide over
 * the last 12 months (no geocode). Cached daily. Powers a dynamic, proprietary-
 * feeling proof point that funnels into the per-address claim check.
 */

const WFO = "FWD"; // Fort Worth / Dallas weather office
// The FWD office covers far more than the metroplex, so filter to a radius
// around the DFW center — otherwise rural towns dominate the "DFW" stats.
const DFW = { lat: 32.9, lon: -97.04 };
const METRO_MI = 55;

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

function cleanCity(raw: string) {
  // LSR names look like "10 NNE STEPHENVILLE" / "3 SSW PARIS" — strip the
  // distance/direction prefix, then title-case.
  return raw
    .replace(/^\s*\d+\s+[NSEW]{1,4}\s+/i, "")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

export async function GET() {
  const now = new Date();
  const ets = now.toISOString().slice(0, 10);
  const start = new Date(now);
  start.setFullYear(now.getFullYear() - 1);
  const sts = start.toISOString().slice(0, 10);
  const url = `https://mesonet.agron.iastate.edu/geojson/lsr.geojson?sts=${sts}T00:00Z&ets=${ets}T23:59Z&wfos=${WFO}`;

  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(12000),
      next: { revalidate: 86400 },
    });
    if (!res.ok) throw new Error("storm data failed");
    const data = await res.json();
    const feats = (data?.features ?? []) as Array<{
      properties: {
        typetext?: string;
        magf?: number | null;
        city?: string;
        valid?: string;
      };
      geometry?: { coordinates?: [number, number] };
    }>;

    let count = 0;
    let largest = 0;
    const cityCounts = new Map<string, number>();
    const events: { city: string; size: number; date: string }[] = [];

    for (const f of feats) {
      const p = f.properties;
      const size = p.magf ?? 0;
      if (!/HAIL/i.test(p.typetext || "") || !size) continue;
      const coords = f.geometry?.coordinates;
      if (!coords) continue;
      const [lon, lat] = coords;
      if (haversineMi(DFW.lat, DFW.lon, lat, lon) > METRO_MI) continue; // metro only
      count++;
      if (size > largest) largest = size;
      const city = cleanCity(p.city || "");
      if (city) cityCounts.set(city, (cityCounts.get(city) || 0) + 1);
      events.push({ city, size, date: p.valid || "" });
    }

    events.sort((a, b) => (a.date < b.date ? 1 : -1));
    const topCities = [...cityCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([city, n]) => ({ city, count: n }));

    return NextResponse.json({
      ok: true,
      count,
      largest,
      topCities,
      recent: events.slice(0, 5),
      sinceMonths: 12,
    });
  } catch {
    return NextResponse.json({ ok: false, count: 0, topCities: [], recent: [] });
  }
}
