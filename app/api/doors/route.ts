import { NextResponse } from "next/server";
import { apiUser } from "@/lib/auth";
import { geocode } from "@/lib/geocode";

export const dynamic = "force-dynamic";

/**
 * Best doors around a point: every house we can place, ranked by radar hail
 * at the house, wind or tornado reports nearby, an estimated roof age and
 * whether the owner lives there. The ranking itself lives in the database
 * (public.doors_near) so the page, a script and the knock map can all share it.
 *
 * GET  ?near=lat,lon | ?q=address  [&mi=1]
 * POST { lat, lon, address }  adds that door to the knock list (storm_targets)
 */

// The scoring grid covers the 11 counties; anything outside has no signals.
const BOX = { south: 31.9, north: 33.55, west: -98.15, east: -95.75 };
const inBox = (lat: number, lon: number) =>
  lat >= BOX.south && lat <= BOX.north && lon >= BOX.west && lon <= BOX.east;

export type Door = {
  src: "target" | "parcel";
  target_id: string | null;
  county: string;
  address: string;
  street: string;
  city: string;
  zip: string | null;
  owner_name: string | null;
  mailing: string | null;
  absentee: boolean;
  lat: number;
  lon: number;
  dist_mi: number;
  year_built: number | null;
  value: number | null;
  hail_in: number | null;
  hail_date: string | null;
  wind_kind: string | null;
  wind_date: string | null;
  wind_mph: number | null;
  wind_roof: boolean | null;
  wind_dist_mi: number | null;
  roof_year: number | null;
  roof_basis: "built" | "hail" | null;
  last_outcome: string | null;
  last_knock_at: string | null;
  score: number;
  reasons: string[];
};

function db() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
  return { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
}

async function doorsNear(lat: number, lon: number, miles: number, limit: number): Promise<Door[] | null> {
  const res = await fetch(`${process.env.SUPABASE_URL}/rest/v1/rpc/doors_near`, {
    method: "POST",
    headers: db(),
    body: JSON.stringify({ p_lat: lat, p_lon: lon, p_miles: miles, p_limit: limit }),
    cache: "no-store",
  });
  if (!res.ok) return null;
  return (await res.json()) as Door[];
}

export async function GET(req: Request) {
  const u = await apiUser(req);
  if (!u) return NextResponse.json({ error: "Sign in to see doors." }, { status: 401 });
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Database is not connected." }, { status: 503 });
  }

  const url = new URL(req.url);
  const mi = Math.min(2, Math.max(0.25, Number(url.searchParams.get("mi")) || 1));
  let lat: number, lon: number, label: string;

  const near = (url.searchParams.get("near") || "").match(/^(-?\d+\.?\d*),(-?\d+\.?\d*)$/);
  const q = (url.searchParams.get("q") || "").trim();
  if (near) {
    lat = Number(near[1]);
    lon = Number(near[2]);
    label = "Your location";
  } else if (q) {
    const g = await geocode(q);
    if (!g) return NextResponse.json({ error: `Couldn't find "${q}".` }, { status: 404 });
    lat = g.lat;
    lon = g.lon;
    label = g.matched;
  } else {
    return NextResponse.json({ error: "Give a location or an address." }, { status: 400 });
  }

  if (!inBox(lat, lon)) {
    return NextResponse.json(
      { error: "That spot is outside the 11 counties we score." },
      { status: 400 },
    );
  }

  const doors = await doorsNear(lat, lon, mi, 400);
  if (!doors) return NextResponse.json({ error: "Couldn't load doors. Try again." }, { status: 502 });
  return NextResponse.json({ ok: true, center: { lat, lon, label }, mi, doors });
}

/** Today's date in Central time, which is the date a homeowner would use. */
function centralToday() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago" }).format(new Date());
}

export async function POST(req: Request) {
  const u = await apiUser(req);
  if (!u) return NextResponse.json({ error: "Sign in to add doors." }, { status: 401 });
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Database is not connected." }, { status: 503 });
  }

  let body: { lat?: number; lon?: number; address?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const lat = Number(body.lat);
  const lon = Number(body.lon);
  const address = String(body.address || "").toUpperCase().trim();
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || !address || !inBox(lat, lon)) {
    return NextResponse.json({ error: "Missing door" }, { status: 400 });
  }

  // Look the door up again rather than trusting what the browser sent.
  const near = await doorsNear(lat, lon, 0.05, 100);
  const d = near?.find((x) => x.address === address);
  if (!d) return NextResponse.json({ error: "Couldn't find that door." }, { status: 404 });
  if (d.src === "target" && d.target_id) {
    return NextResponse.json({ ok: true, target_id: d.target_id, already: true });
  }

  const row = {
    storm_date: centralToday(),
    address: d.address.slice(0, 120),
    city: d.city.endsWith(" County") ? "" : d.city,
    county: d.county,
    zip: (d.zip || "").slice(0, 10),
    lat: d.lat,
    lon: d.lon,
    owner_name: (d.owner_name || "").slice(0, 120),
    owner_mailing: (d.mailing || "").slice(0, 160),
    property_type: "Unknown",
    year_built: d.year_built,
    value: d.value,
    // The knock card shows hail_size_in as a reported size. A radar estimate
    // is not that, so it stays empty and the reasons go in the note instead.
    hail_size_in: null,
    absentee: d.absentee,
    score: d.score,
    notes: `Added from Best doors by ${u.name}: ${d.reasons.join("; ")}`.slice(0, 500),
  };
  const ins = await fetch(`${process.env.SUPABASE_URL}/rest/v1/storm_targets?on_conflict=storm_date,address`, {
    method: "POST",
    headers: { ...db(), Prefer: "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify([row]),
  });
  if (!ins.ok) return NextResponse.json({ error: `Couldn't add (${ins.status})` }, { status: 502 });
  const created = ((await ins.json()) as Array<{ id: string }>)[0];
  return NextResponse.json({ ok: true, target_id: created?.id ?? null });
}
