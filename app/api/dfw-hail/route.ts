import { NextResponse } from "next/server";

/**
 * Hail activity for the homepage "live storm intelligence" band.
 *
 * Free NWS/IEM Local Storm Reports (FWD office), last 12 months (an
 * insurance-relevant window ≈ the Texas filing period). The hail dataset is
 * cached daily; we then localize per request:
 *   - Geolocate the visitor's IP (coarse, city-level — not stored).
 *   - If they're in/near DFW, count hail within ~25mi of them ("near {city}").
 *   - Otherwise (or if a local area is sparse) fall back to metro-wide so the
 *     number is always meaningful and never zero.
 */

const WFO = "FWD";
const DFW = { lat: 32.9, lon: -97.04 };
const METRO_MI = 55;
const LOCAL_MI = 25;
const MIN_LOCAL = 12; // widen to metro if a local area is thinner than this

type Feat = { lat: number; lon: number; size: number; city: string; date: string };

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
  return raw
    .replace(/^\s*\d+\s+[NSEW]{1,4}\s+/i, "")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

async function fetchHail(): Promise<Feat[]> {
  const now = new Date();
  const ets = now.toISOString().slice(0, 10);
  const start = new Date(now);
  start.setFullYear(now.getFullYear() - 1);
  const sts = start.toISOString().slice(0, 10);
  const url = `https://mesonet.agron.iastate.edu/geojson/lsr.geojson?sts=${sts}T00:00Z&ets=${ets}T23:59Z&wfos=${WFO}`;
  const res = await fetch(url, {
    signal: AbortSignal.timeout(12000),
    next: { revalidate: 86400 },
  });
  if (!res.ok) throw new Error("storm data failed");
  const data = await res.json();
  const feats = (data?.features ?? []) as Array<{
    properties: { typetext?: string; magf?: number | null; city?: string; valid?: string };
    geometry?: { coordinates?: [number, number] };
  }>;
  const out: Feat[] = [];
  for (const f of feats) {
    const p = f.properties;
    const size = p.magf ?? 0;
    const coords = f.geometry?.coordinates;
    if (!/HAIL/i.test(p.typetext || "") || !size || !coords) continue;
    out.push({ lon: coords[0], lat: coords[1], size, city: cleanCity(p.city || ""), date: p.valid || "" });
  }
  return out;
}

async function geoFromIp(ip: string) {
  if (!ip || /^(127\.|10\.|192\.168\.|::1|172\.(1[6-9]|2\d|3[01])\.)/.test(ip)) return null;
  try {
    const r = await fetch(`https://ipwho.is/${ip}`, { signal: AbortSignal.timeout(3000) });
    const j = await r.json();
    if (j && j.success && typeof j.latitude === "number" && typeof j.longitude === "number") {
      return { lat: j.latitude, lon: j.longitude, city: (j.city as string) || "" };
    }
  } catch {
    /* fall back to metro */
  }
  return null;
}

function summarize(feats: Feat[], center: { lat: number; lon: number }, radius: number) {
  const near = feats.filter((f) => haversineMi(center.lat, center.lon, f.lat, f.lon) <= radius);
  let largest = 0;
  const cityCounts = new Map<string, number>();
  for (const f of near) {
    if (f.size > largest) largest = f.size;
    if (f.city) cityCounts.set(f.city, (cityCounts.get(f.city) || 0) + 1);
  }
  const topCities = [...cityCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([city, count]) => ({ city, count }));
  const recent = [...near]
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .slice(0, 5)
    .map((e) => ({ city: e.city, size: e.size, date: e.date }));
  return { count: near.length, largest, topCities, recent };
}

export async function GET(req: Request) {
  try {
    const xff = req.headers.get("x-forwarded-for") || "";
    const ip = xff.split(",")[0].trim();
    const [feats, geo] = await Promise.all([fetchHail(), geoFromIp(ip)]);

    const nearDfw = geo && haversineMi(DFW.lat, DFW.lon, geo.lat, geo.lon) < 90;
    if (nearDfw && geo) {
      const local = summarize(feats, geo, LOCAL_MI);
      if (local.count >= MIN_LOCAL) {
        return NextResponse.json({
          ok: true,
          scope: "local",
          city: geo.city || null,
          radiusMi: LOCAL_MI,
          sinceMonths: 12,
          ...local,
        });
      }
    }
    // Metro fallback — always meaningful, never zero.
    const metro = summarize(feats, DFW, METRO_MI);
    return NextResponse.json({
      ok: true,
      scope: "metro",
      city: null,
      radiusMi: METRO_MI,
      sinceMonths: 12,
      ...metro,
    });
  } catch {
    return NextResponse.json({ ok: false, scope: "metro", count: 0, topCities: [], recent: [] });
  }
}
