import { NextResponse } from "next/server";
import { listStormTargets } from "@/lib/parcels";

const NEAR_RADIUS_MI = 15;

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

/** Targets in a bbox around a point, straight from the DB. */
async function bboxTargets(lat: number, lon: number, halfMi: number, days?: number) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
  const dLat = halfMi / 69;
  const dLon = halfMi / (69 * Math.cos((lat * Math.PI) / 180));
  let q =
    `&lat=gte.${(lat - dLat).toFixed(5)}&lat=lte.${(lat + dLat).toFixed(5)}` +
    `&lon=gte.${(lon - dLon).toFixed(5)}&lon=lte.${(lon + dLon).toFixed(5)}`;
  if (days) {
    const from = new Date(Date.now() - days * 86400 * 1000).toISOString().slice(0, 10);
    q += `&storm_date=gte.${from}`;
  }
  const res = await fetch(
    `${url}/rest/v1/storm_targets?select=id,owner_name,address,city,zip,hail_size_in,solar,absentee,year_built,value,score,storm_date,lat,lon${q}&limit=3000`,
    { headers: { apikey: key, Authorization: `Bearer ${key}` }, cache: "no-store" },
  );
  if (!res.ok) return [];
  return (await res.json()) as Array<{
    id: string;
    owner_name: string;
    address: string;
    city: string;
    zip: string;
    hail_size_in: number | null;
    solar: boolean;
    absentee: boolean;
    year_built: number | null;
    value: number | null;
    score: number;
    storm_date: string;
    lat: number;
    lon: number;
  }>;
}

/**
 * Storm-target export for dialing / skip trace / direct mail.
 *   GET /api/admin/storm-targets?key=<ADMIN_TOKEN>&date=2026-04-28&format=csv
 * Omit `date` for the latest 1000 across all storm days. CSV columns match
 * what batch skip-trace vendors (BatchData etc.) expect: owner + address.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const key = url.searchParams.get("key");
  if (!process.env.ADMIN_TOKEN || key !== process.env.ADMIN_TOKEN) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  // Near-me mode: ?near=lat,lon → everything within 15mi sorted by distance;
  // if empty, report the nearest cluster beyond so the UI can say so honestly.
  const near = url.searchParams.get("near") || "";
  const daysRawNear = url.searchParams.get("days") || "";
  const nearDays = ["10", "30", "90"].includes(daysRawNear) ? Number(daysRawNear) : undefined;
  const m = near.match(/^(-?\d+\.?\d*),(-?\d+\.?\d*)$/);
  if (m) {
    const lat = parseFloat(m[1]);
    const lon = parseFloat(m[2]);
    if (!(lat > 25 && lat < 37 && lon > -107 && lon < -93)) {
      return NextResponse.json({ ok: false, error: "Bad coordinates" }, { status: 400 });
    }
    const rows = await bboxTargets(lat, lon, NEAR_RADIUS_MI, nearDays);
    const withMi = rows
      .map((r) => ({ ...r, distance_mi: haversineMi(lat, lon, r.lat, r.lon) }))
      .filter((r) => r.distance_mi <= NEAR_RADIUS_MI)
      .sort((a, b) => a.distance_mi - b.distance_mi)
      .slice(0, 150);
    let nearestBeyond: { city: string; mi: number; storm_date: string } | null = null;
    if (withMi.length === 0) {
      const wide = await bboxTargets(lat, lon, 75, nearDays);
      let best: (typeof wide)[number] | null = null;
      let bestMi = Infinity;
      for (const r of wide) {
        const mi = haversineMi(lat, lon, r.lat, r.lon);
        if (mi < bestMi) {
          bestMi = mi;
          best = r;
        }
      }
      if (best) {
        nearestBeyond = {
          city: best.city || best.zip || "unknown area",
          mi: Math.round(bestMi),
          storm_date: best.storm_date,
        };
      }
    }
    return NextResponse.json({
      ok: true,
      radius_mi: NEAR_RADIUS_MI,
      count: withMi.length,
      targets: withMi.map((r) => ({ ...r, distance_mi: Math.round(r.distance_mi * 100) / 100 })),
      nearest_beyond: nearestBeyond,
    });
  }

  const date = url.searchParams.get("date") || undefined;
  const county = url.searchParams.get("county") || undefined;
  const city = url.searchParams.get("city") || undefined;
  const daysRaw = url.searchParams.get("days") || "";
  const targets = await listStormTargets(
    {
      date: date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : undefined,
      county,
      city,
      days: ["10", "30", "90"].includes(daysRaw) ? Number(daysRaw) : undefined,
    },
    1000,
  );

  if (url.searchParams.get("format") === "csv") {
    const esc = (v: unknown) => {
      const s = String(v ?? "");
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const header =
      "storm_date,score,owner_name,address,city,county,zip,owner_mailing,property_type,year_built,value,hail_size_in,solar,absentee,status";
    const lines = targets.map((t) =>
      [
        t.storm_date,
        t.score,
        t.owner_name,
        t.address,
        t.city,
        t.county,
        t.zip,
        t.owner_mailing,
        t.property_type,
        t.year_built ?? "",
        t.value ?? "",
        t.hail_size_in ?? "",
        t.solar ? "yes" : "",
        t.absentee ? "yes" : "",
        t.status,
      ]
        .map(esc)
        .join(","),
    );
    return new NextResponse([header, ...lines].join("\n"), {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="storm-targets${date ? `-${date}` : ""}.csv"`,
      },
    });
  }
  return NextResponse.json({ ok: true, count: targets.length, targets });
}
