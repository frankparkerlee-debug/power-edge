import { NextResponse } from "next/server";
import { geocode } from "@/lib/geocode";

/**
 * Instant roof estimate. Geocodes the address, measures the building footprint
 * from OpenStreetMap building polygons, converts footprint → roof squares
 * (× pitch × waste), and prices at the company's $/square. Falls back to a
 * manual square-footage entry when a home isn't mapped.
 *
 * Honest by design: always a RANGE, always "exact price after a free on-site
 * measurement." A wrong precise number would hurt the brand more than help.
 */

// Sell price per roofing square (100 sq ft of roof). Edit here.
const RATE_LOW = 400;
const RATE_HIGH = 450;
// Footprint → roof-area assumptions (pitch + waste/overhang).
const PITCH_LOW = 1.12; // ~5/12
const PITCH_HIGH = 1.25; // ~8/12
const WASTE = 1.1;

type LatLon = { lat: number; lon: number };

function polygonAreaSqft(geom: LatLon[]): number {
  if (!geom || geom.length < 3) return 0;
  const lat0 = geom.reduce((s, p) => s + p.lat, 0) / geom.length;
  const mLat = 111320;
  const mLon = 111320 * Math.cos((lat0 * Math.PI) / 180);
  const pts = geom.map((p) => [p.lon * mLon, p.lat * mLat]);
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x1, y1] = pts[i];
    const [x2, y2] = pts[(i + 1) % pts.length];
    a += x1 * y2 - x2 * y1;
  }
  return (Math.abs(a) / 2) * 10.7639; // m² → ft²
}

function pointInPolygon(lat: number, lon: number, geom: LatLon[]): boolean {
  let inside = false;
  for (let i = 0, j = geom.length - 1; i < geom.length; j = i++) {
    const xi = geom[i].lon,
      yi = geom[i].lat,
      xj = geom[j].lon,
      yj = geom[j].lat;
    const intersect =
      yi > lat !== yj > lat &&
      lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

async function footprintSqft(lat: number, lon: number): Promise<number | null> {
  const q = `[out:json][timeout:20];way(around:90,${lat},${lon})["building"];out geom;`;
  try {
    const res = await fetch("https://overpass-api.de/api/interpreter", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "poweredgetx.com/1.0 (info@poweredgetx.com)",
      },
      body: "data=" + encodeURIComponent(q),
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const centroid = (g: LatLon[]) => ({
      lat: g.reduce((s, p) => s + p.lat, 0) / g.length,
      lon: g.reduce((s, p) => s + p.lon, 0) / g.length,
    });
    // Build candidates, keeping only residential-sized footprints (filters out
    // large commercial buildings near arterial roads, etc.).
    const candidates = (data?.elements ?? [])
      .filter(
        (e: { type: string; geometry?: LatLon[] }) =>
          e.type === "way" &&
          Array.isArray(e.geometry) &&
          e.geometry.length >= 3,
      )
      .map((e: { geometry: LatLon[] }) => ({
        geom: e.geometry,
        sqft: polygonAreaSqft(e.geometry),
      }))
      .filter((c: { sqft: number }) => c.sqft > 250 && c.sqft < 12000);
    if (!candidates.length) return null;
    // Prefer the building that contains the geocoded point; else the nearest.
    const containing = candidates.find((c: { geom: LatLon[] }) =>
      pointInPolygon(lat, lon, c.geom),
    );
    const chosen =
      containing ||
      candidates.sort((a: { geom: LatLon[] }, b: { geom: LatLon[] }) => {
        const ca = centroid(a.geom),
          cb = centroid(b.geom);
        const d = (p: LatLon) => (p.lat - lat) ** 2 + (p.lon - lon) ** 2;
        return d(ca) - d(cb);
      })[0];
    return chosen.sqft;
  } catch {
    return null;
  }
}

function estimateFromFootprint(footprint: number) {
  const sqLow = (footprint * PITCH_LOW * WASTE) / 100;
  const sqHigh = (footprint * PITCH_HIGH * WASTE) / 100;
  const round = (n: number) => Math.round(n / 250) * 250;
  return {
    squaresLow: Math.round(sqLow * 10) / 10,
    squaresHigh: Math.round(sqHigh * 10) / 10,
    low: round(sqLow * RATE_LOW),
    high: round(sqHigh * RATE_HIGH),
  };
}

export async function POST(req: Request) {
  let body: {
    address?: string;
    manualSqft?: number;
    stories?: number;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const address = (body.address || "").trim();
  if (!address) {
    return NextResponse.json({ error: "Address required" }, { status: 422 });
  }

  // Manual path: caller supplied home square footage.
  if (body.manualSqft && body.manualSqft > 300) {
    const stories = body.stories && body.stories > 0 ? body.stories : 1;
    const footprint = body.manualSqft / stories;
    const geo = await geocode(address).catch(() => null);
    return NextResponse.json({
      ok: true,
      source: "manual",
      matched: geo?.matched || address,
      home: geo ? { lat: geo.lat, lon: geo.lon } : null,
      footprintSqft: Math.round(footprint),
      rate: { low: RATE_LOW, high: RATE_HIGH },
      ...estimateFromFootprint(footprint),
    });
  }

  const geo = await geocode(address).catch(() => null);
  if (!geo) {
    return NextResponse.json({ ok: true, source: "need_manual", matched: null });
  }

  const looksLikeStreet = /\d{1,6}\s+\S+/.test(address);
  if (!geo.approximate || looksLikeStreet) {
    const footprint = await footprintSqft(geo.lat, geo.lon);
    if (footprint) {
      return NextResponse.json({
        ok: true,
        source: "measured",
        matched: geo.matched,
        approximate: geo.approximate,
        home: { lat: geo.lat, lon: geo.lon },
        footprintSqft: Math.round(footprint),
        rate: { low: RATE_LOW, high: RATE_HIGH },
        ...estimateFromFootprint(footprint),
      });
    }
  }

  // Couldn't measure automatically — ask for square footage.
  return NextResponse.json({
    ok: true,
    source: "need_manual",
    matched: geo.matched,
    home: { lat: geo.lat, lon: geo.lon },
  });
}
