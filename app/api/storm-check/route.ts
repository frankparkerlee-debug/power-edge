import { NextResponse } from "next/server";
import { geocode } from "@/lib/geocode";

/**
 * Storm check: given a street address, returns reported hail activity near it.
 *
 * Pipeline (all free, no API keys):
 *   1. Geocode the address via the US Census geocoder -> lat/lon.
 *   2. Pull NWS Local Storm Reports (hail) for the Fort Worth/Dallas (FWD)
 *      weather office over the last ~24 months, via Iowa Environmental Mesonet.
 *      Cached daily (revalidate) so we hit IEM once a day, not once a request.
 *   3. Keep hail reports within RADIUS_MI of the address; summarize.
 *
 * Honest by design: we report hail "near this address," never "your roof is
 * damaged." Only an inspection confirms damage to a specific roof.
 */

const RADIUS_MI = 15;
const WFO = "FWD"; // Fort Worth / Dallas — covers PowerEdge's service area

type Nearby = {
  size: number; // inches
  date: string; // ISO
  city: string;
  county: string;
  miles: number;
  bearing: number; // degrees from the address (for the proximity map)
  lat: number;
  lon: number;
};

function haversineMi(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 3958.8;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Compass bearing in degrees from point 1 to point 2 (for the proximity map). */
function bearing(lat1: number, lon1: number, lat2: number, lon2: number) {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLon = toRad(lon2 - lon1);
  const y = Math.sin(dLon) * Math.cos(toRad(lat2));
  const x =
    Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
    Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLon);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}


async function fetchHailReports() {
  // Date-only bounds keep the URL stable within a day so the cache works.
  const now = new Date();
  const ets = now.toISOString().slice(0, 10);
  const start = new Date(now);
  start.setFullYear(now.getFullYear() - 2);
  const sts = start.toISOString().slice(0, 10);
  const url = `https://mesonet.agron.iastate.edu/geojson/lsr.geojson?sts=${sts}T00:00Z&ets=${ets}T23:59Z&wfos=${WFO}`;
  const res = await fetch(url, {
    signal: AbortSignal.timeout(12000),
    next: { revalidate: 86400 }, // cache for a day
  });
  if (!res.ok) throw new Error("storm data failed");
  const data = await res.json();
  return (data?.features ?? []) as Array<{
    properties: {
      typetext?: string;
      magf?: number | null;
      city?: string;
      county?: string;
      valid?: string;
    };
    geometry?: { coordinates?: [number, number] };
  }>;
}

export async function POST(req: Request) {
  let body: { address?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const address = (body.address || "").trim();
  if (!address) {
    return NextResponse.json({ error: "Address required" }, { status: 422 });
  }

  // 1. Geocode — if this fails, tell the UI so it can fall back gracefully.
  let geo;
  try {
    geo = await geocode(address);
  } catch {
    return NextResponse.json({ ok: true, soft: true, matched: null });
  }
  if (!geo) {
    return NextResponse.json({ ok: true, found: false, matched: null });
  }

  // 2 + 3. Pull hail reports and keep the ones near the address.
  try {
    const feats = await fetchHailReports();
    const nearby: Nearby[] = [];
    for (const f of feats) {
      const p = f.properties;
      const size = p.magf ?? 0;
      if (!/HAIL/i.test(p.typetext || "") || !size) continue;
      const coords = f.geometry?.coordinates;
      if (!coords) continue;
      const [lon, lat] = coords;
      const miles = haversineMi(geo.lat, geo.lon, lat, lon);
      if (miles <= RADIUS_MI) {
        nearby.push({
          size,
          date: p.valid || "",
          city: p.city || "",
          county: p.county || "",
          miles: Math.round(miles),
          bearing: Math.round(bearing(geo.lat, geo.lon, lat, lon)),
          lat,
          lon,
        });
      }
    }

    nearby.sort((a, b) => (a.date < b.date ? 1 : -1)); // most recent first
    const bySize = [...nearby].sort((a, b) => b.size - a.size);
    const largest = bySize[0] || null;
    const mostRecent = nearby[0] || null;
    const significantCount = nearby.filter((n) => n.size >= 1).length;

    return NextResponse.json({
      ok: true,
      found: true,
      matched: geo.matched,
      approximate: geo.approximate,
      radiusMi: RADIUS_MI,
      count: nearby.length,
      significantCount,
      largest,
      mostRecent,
      recent: nearby.slice(0, 6),
      home: { lat: geo.lat, lon: geo.lon },
      // a compact set for the proximity map (size + where it hit)
      map: nearby.slice(0, 60).map((n) => ({
        size: n.size,
        miles: n.miles,
        bearing: n.bearing,
        lat: n.lat,
        lon: n.lon,
      })),
    });
  } catch {
    // Data source hiccup — still let the UI capture the lead.
    return NextResponse.json({ ok: true, soft: true, matched: geo.matched });
  }
}
