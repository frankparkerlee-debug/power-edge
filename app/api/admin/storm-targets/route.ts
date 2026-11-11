import { NextResponse } from "next/server";
import { listStormTargets, BIG_HAIL_IN } from "@/lib/parcels";
import { apiUser } from "@/lib/auth";

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
async function bboxTargets(lat: number, lon: number, halfMi: number, days?: number, bigHail?: boolean) {
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
  if (bigHail) q += `&radar_in=gte.${BIG_HAIL_IN}`;
  const res = await fetch(
    `${url}/rest/v1/storm_targets_radar?select=id,owner_name,address,city,county,zip,hail_size_in,absentee,year_built,value,score,storm_date,lat,lon,phone,phone_dnc,status,radar_in,radar_date${q}&limit=3000`,
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
    absentee: boolean;
    year_built: number | null;
    value: number | null;
    score: number;
    storm_date: string;
    lat: number;
    lon: number;
    phone: string | null;
    phone_dnc: boolean | null;
    status: string;
    county: string | null;
    radar_in: number | null;
    radar_date: string | null;
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
  const u = await apiUser(req);
  if (!u) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  // Near-me mode: ?near=lat,lon → everything within 15mi sorted by distance;
  // if empty, report the nearest cluster beyond so the UI can say so honestly.
  const near = url.searchParams.get("near") || "";
  const daysRawNear = url.searchParams.get("days") || "";
  const nearDays = ["10", "30", "90"].includes(daysRawNear) ? Number(daysRawNear) : undefined;
  // Same default as the map: 2 in+ radar hail only, unless big=0.
  const nearBig = url.searchParams.get("big") !== "0";
  const m = near.match(/^(-?\d+\.?\d*),(-?\d+\.?\d*)$/);
  if (m) {
    const lat = parseFloat(m[1]);
    const lon = parseFloat(m[2]);
    if (!(lat > 25 && lat < 37 && lon > -107 && lon < -93)) {
      return NextResponse.json({ ok: false, error: "Bad coordinates" }, { status: 400 });
    }
    const rows = await bboxTargets(lat, lon, NEAR_RADIUS_MI, nearDays, nearBig);
    const withMi = rows
      .map((r) => ({ ...r, distance_mi: haversineMi(lat, lon, r.lat, r.lon) }))
      .filter((r) => r.distance_mi <= NEAR_RADIUS_MI)
      .sort((a, b) => a.distance_mi - b.distance_mi)
      .slice(0, 150);
    let nearestBeyond: { city: string; mi: number; storm_date: string } | null = null;
    if (withMi.length === 0) {
      const wide = await bboxTargets(lat, lon, 75, nearDays, nearBig);
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

  // Everything below is the full homeowner export: office only. "Near me"
  // above is for every signed-in rep; it used to be admin-only too, so a
  // setter tapping Near me at the curb got an error.
  if (u.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
      "storm_date,score,owner_name,address,city,county,zip,phone,phone_dnc,phone2,owner_mailing,property_type,year_built,value,hail_size_in,absentee,status";
    const lines = targets.map((t) =>
      [
        t.storm_date,
        t.score,
        t.owner_name,
        t.address,
        t.city,
        t.county,
        t.zip,
        (t as unknown as { phone?: string }).phone ?? "",
        (t as unknown as { phone_dnc?: boolean }).phone_dnc ? "DNC" : "",
        (t as unknown as { phone2?: string }).phone2 ?? "",
        t.owner_mailing,
        t.property_type,
        t.year_built ?? "",
        t.value ?? "",
        t.hail_size_in ?? "",
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
