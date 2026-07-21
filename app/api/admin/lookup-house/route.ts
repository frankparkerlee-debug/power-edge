import { NextResponse } from "next/server";
import {
  queryDallasParcels,
  queryTarrantParcels,
  queryDbParcels,
  type ParcelHit,
} from "@/lib/parcels";
import { haversineMi } from "@/lib/storm";

/**
 * Ad-hoc house capture for reps: a bad roof that isn't in the storm targets.
 *   GET  /api/admin/lookup-house?key=..&near=lat,lon
 *        → nearest parcels (owner + details) from all 11 counties
 *   POST /api/admin/lookup-house  { key, parcel: {...} }
 *        → inserts it as a manual storm_target (storm_date = today,
 *          solar-permit matched) so the normal Convert-to-lead flow applies.
 */

function db() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  };
}

const normAddr = (s: string) =>
  s.toUpperCase().replace(/[^A-Z0-9 ]/g, "").replace(/\s+/g, " ").trim();

export async function GET(req: Request) {
  const url = new URL(req.url);
  if (!process.env.ADMIN_TOKEN || url.searchParams.get("key") !== process.env.ADMIN_TOKEN) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const m = (url.searchParams.get("near") || "").match(/^(-?\d+\.?\d*),(-?\d+\.?\d*)$/);
  if (!m) return NextResponse.json({ error: "Bad coordinates" }, { status: 400 });
  const lat = parseFloat(m[1]);
  const lon = parseFloat(m[2]);
  if (!(lat > 25 && lat < 37 && lon > -107 && lon < -93)) {
    return NextResponse.json({ error: "Out of area" }, { status: 400 });
  }

  // ~600ft box across every source; nearest first.
  const half = 0.12;
  const [dallas, tarrant, dbc] = await Promise.all([
    queryDallasParcels(lat, lon, half).catch(() => [] as ParcelHit[]),
    queryTarrantParcels(lat, lon, half).catch(() => [] as ParcelHit[]),
    queryDbParcels(lat, lon, half).catch(() => [] as ParcelHit[]),
  ]);
  const seen = new Set<string>();
  const candidates = [...dallas, ...tarrant, ...dbc]
    .filter((p) => {
      const k = normAddr(p.address);
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .map((p) => ({
      ...p,
      distance_mi:
        p.lat != null && p.lon != null
          ? Math.round(haversineMi(lat, lon, p.lat, p.lon) * 1000) / 1000
          : null,
    }))
    .sort((a, b) => (a.distance_mi ?? 9) - (b.distance_mi ?? 9))
    .slice(0, 8);

  return NextResponse.json({ ok: true, candidates });
}

export async function POST(req: Request) {
  let body: { key?: string; parcel?: ParcelHit };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  if (!process.env.ADMIN_TOKEN || body.key !== process.env.ADMIN_TOKEN) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const p = body.parcel;
  if (!p?.address || !p?.owner_name) {
    return NextResponse.json({ error: "Missing parcel" }, { status: 400 });
  }

  // Solar check against the permit inventory.
  let solar = false;
  if (p.zip && /^\d{5}$/.test(p.zip)) {
    try {
      const sres = await fetch(
        `${process.env.SUPABASE_URL}/rest/v1/solar_permits?select=address&zip=eq.${p.zip}&limit=2000`,
        { headers: db(), cache: "no-store" },
      );
      if (sres.ok) {
        const rows = (await sres.json()) as Array<{ address: string }>;
        const target = normAddr(p.address);
        solar = rows.some((r) => r.address && normAddr(r.address) === target);
      }
    } catch {
      /* best-effort */
    }
  }

  const today = new Date().toISOString().slice(0, 10);
  const mailing = (p.mailing || "").trim();
  const absentee =
    !!mailing && !normAddr(mailing).startsWith(normAddr(p.address).split(" ").slice(0, 2).join(" "));
  const row = {
    storm_date: today,
    address: String(p.address).toUpperCase().slice(0, 120),
    city: p.city || "",
    county: p.county || "",
    zip: (p.zip || "").slice(0, 10),
    lat: p.lat,
    lon: p.lon,
    owner_name: p.owner_name.slice(0, 120),
    owner_mailing: mailing.slice(0, 160),
    property_type: p.property_type || "Unknown",
    year_built: p.year_built,
    value: p.value,
    hail_size_in: null,
    solar,
    solar_source: solar ? "permit" : "rep_flag_candidate",
    absentee,
    score: 5,
    notes: "Manually added by rep in the field (visual roof condition)",
  };
  const ins = await fetch(
    `${process.env.SUPABASE_URL}/rest/v1/storm_targets?on_conflict=storm_date,address`,
    {
      method: "POST",
      headers: { ...db(), Prefer: "resolution=merge-duplicates,return=representation" },
      body: JSON.stringify([row]),
    },
  );
  if (!ins.ok) {
    return NextResponse.json({ error: `Insert failed (${ins.status})` }, { status: 502 });
  }
  const created = ((await ins.json()) as Array<Record<string, unknown>>)[0];
  return NextResponse.json({ ok: true, target: created });
}
