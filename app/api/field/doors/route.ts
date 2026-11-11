import { NextResponse } from "next/server";
import { apiUser } from "@/lib/auth";
import { geocode } from "@/lib/geocode";
import { localDay } from "@/lib/day";

export const dynamic = "force-dynamic";

/**
 * The knock map's doors.
 *
 *   GET  /api/field/doors?near=lat,lon[&mi=0.5][&big=0]
 *   GET  /api/field/doors?zip=76135[&big=0]
 *   POST /api/field/doors { lat, lon, address }   puts a door on the knock list
 *
 * Every house Best doors can place (storm targets, county records, Dallas
 * permit addresses), with radar hail at the house, plus what the CRM knows:
 * the date of loss, a callable phone, the last knock and who made it, an open
 * come-back, and the job and its booked inspection. The work is in
 * public.field_doors; this route checks the caller, shapes the rows, and adds
 * a door to the knock list the first time someone acts on it.
 *
 * big=0 widens to 1 in+ hail. The default is 2 in+, the level that showed
 * real re-roofing in the Dallas permit test (scope doc, 2026-11-11).
 */

const DFW = { south: 31.9, north: 33.6, west: -98.2, east: -95.7 };
const inDfw = (lat: number, lon: number) =>
  lat >= DFW.south && lat <= DFW.north && lon >= DFW.west && lon <= DFW.east;

function db() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
  return { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
}

type Row = {
  src: string;
  target_id: string | null;
  county: string;
  address: string;
  city: string | null;
  zip: string | null;
  owner_name: string | null;
  absentee: boolean | null;
  lat: number;
  lon: number;
  dist_mi: number;
  year_built: number | null;
  value: number | null;
  hail_in: number | null;
  hail_date: string | null;
  storm_date: string | null;
  wind_kind: string | null;
  wind_date: string | null;
  wind_roof: boolean | null;
  wind_dist_mi: number | null;
  roof_year: number | null;
  roof_basis: string | null;
  permit_date: string | null;
  roofer: string | null;
  recent_roof: boolean | null;
  reasons: string[] | null;
  phone: string | null;
  phone_dnc: boolean | null;
  last_outcome: string | null;
  last_knock_at: string | null;
  last_rep: string | null;
  last_note: string | null;
  follow_up_at: string | null;
  job_id: string | null;
  job_stage: string | null;
  appt_at: string | null;
  appt_status: string | null;
};

async function fieldDoors(lat: number, lon: number, mi: number, minHail: number | null, zip: string | null) {
  const res = await fetch(`${process.env.SUPABASE_URL}/rest/v1/rpc/field_doors`, {
    method: "POST",
    headers: db(),
    body: JSON.stringify({ p_lat: lat, p_lon: lon, p_miles: mi, p_min_hail: minHail, p_zip: zip }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`field_doors ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return (await res.json()) as Row[];
}

const title = (s: string) => s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

/** "5629 AINSDALE DR, FORT WORTH, TX 76135" -> number 5629, street "Ainsdale Dr". */
function splitAddress(raw: string) {
  const line = String(raw || "").split(",")[0].trim().replace(/\s+/g, " ");
  const m = line.match(/^(\d+[A-Z]?)\s+(.*)$/i);
  return m ? { line, num: m[1], street: title(m[2]) } : { line, num: "", street: title(line) };
}

/** Where the door stands with us, in the order that decides what a rep does. */
function stateOf(r: Row) {
  const stage = r.job_stage;
  if (stage && stage !== "lost") {
    if (r.appt_at && r.appt_status !== "canceled" && new Date(r.appt_at).getTime() > Date.now() - 6 * 3600e3) {
      return { kind: "appointment", at: r.appt_at };
    }
    return { kind: "job", stage };
  }
  switch (r.last_outcome) {
    case "come_back":
      return { kind: "come_back", at: r.follow_up_at, by: r.last_rep, when: r.last_knock_at };
    case "not_interested":
    case "do_not_knock":
      return { kind: "no", by: r.last_rep, when: r.last_knock_at, note: r.last_note };
    case "not_home":
      return { kind: "not_home", by: r.last_rep, when: r.last_knock_at };
    case "appointment_set":
      return { kind: "appointment", at: null };
    default:
      return { kind: stage === "lost" ? "no" : "new", by: r.last_rep, when: r.last_knock_at };
  }
}

function shape(r: Row) {
  const a = splitAddress(r.address);
  const reasons = r.reasons ?? [];
  return {
    key: r.target_id ?? `${r.src}:${a.line}:${r.zip ?? ""}`,
    target_id: r.target_id,
    address: a.line,
    full_address: r.address,
    num: a.num,
    street: a.street,
    city: r.city && !/ County$/.test(r.city) ? title(r.city) : "",
    county: r.county,
    zip: (r.zip || "").slice(0, 5),
    owner_name: r.owner_name ? title(r.owner_name) : "",
    absentee: r.absentee,
    lat: r.lat,
    lon: r.lon,
    dist_mi: Math.round(r.dist_mi * 100) / 100,
    year_built: r.year_built,
    value: r.value,
    hail_in: r.hail_in != null ? Math.round(r.hail_in * 10) / 10 : null,
    // Date of loss: the knock list's date when the door is on it, else the
    // radar day (aligned to the nearest storm report).
    storm_date: r.storm_date ?? r.hail_date,
    roof_note: reasons.find((x) => /^(Re-roofed|Golf-ball|Built )/.test(x)) ?? null,
    wind_note: reasons.find((x) => /reported/.test(x)) ?? null,
    recent_roof: !!r.recent_roof,
    phone: r.phone,
    phone_dnc: !!r.phone_dnc,
    job_id: r.job_id,
    state: stateOf(r),
  };
}

export async function GET(req: Request) {
  const u = await apiUser(req);
  if (!u) return NextResponse.json({ ok: false, error: "Sign in to see doors." }, { status: 401 });

  const url = new URL(req.url);
  const big = url.searchParams.get("big") !== "0";
  const minHail = big ? 2 : 1;
  const zipRaw = (url.searchParams.get("zip") || "").trim();
  const near = (url.searchParams.get("near") || "").match(/^(-?\d+\.?\d*),(-?\d+\.?\d*)$/);

  let lat: number, lon: number, mi: number, zip: string | null = null;
  if (/^\d{5}$/.test(zipRaw)) {
    const g = await geocode(`${zipRaw}, TX`);
    if (!g || !inDfw(g.lat, g.lon)) {
      return NextResponse.json({ ok: false, error: `Couldn't find ZIP ${zipRaw} in North Texas.` }, { status: 404 });
    }
    lat = g.lat;
    lon = g.lon;
    mi = 3;
    zip = zipRaw;
  } else if (near) {
    lat = parseFloat(near[1]);
    lon = parseFloat(near[2]);
    if (!inDfw(lat, lon)) {
      return NextResponse.json({ ok: true, doors: [], outside: true });
    }
    const m = parseFloat(url.searchParams.get("mi") || "0.5");
    mi = Math.min(Math.max(Number.isFinite(m) ? m : 0.5, 0.2), 2);
  } else {
    return NextResponse.json({ ok: false, error: "Give a location or a ZIP." }, { status: 400 });
  }

  try {
    const rows = await fieldDoors(lat, lon, mi, minHail, zip);
    return NextResponse.json({
      ok: true,
      center: { lat, lon },
      mi,
      zip,
      big,
      doors: rows.map(shape),
    });
  } catch (err) {
    console.error("[field/doors]", err);
    return NextResponse.json({ ok: false, error: "Couldn't load doors. Try again." }, { status: 502 });
  }
}

/**
 * Put a door on the knock list, so a knock or a booking has something to
 * attach to. The door is looked up again server side rather than trusting the
 * browser, and it is dated by its hail (the date of loss), not by today.
 */
export async function POST(req: Request) {
  const u = await apiUser(req);
  if (!u) return NextResponse.json({ ok: false, error: "Sign in first." }, { status: 401 });

  let body: { lat?: number; lon?: number; address?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
  }
  const lat = Number(body.lat), lon = Number(body.lon);
  const address = String(body.address || "").trim().toUpperCase();
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || !inDfw(lat, lon) || !address) {
    return NextResponse.json({ ok: false, error: "Which door?" }, { status: 400 });
  }

  const rows = await fieldDoors(lat, lon, 0.2, null, null).catch(() => [] as Row[]);
  const d = rows.find((r) => r.address === address) ?? rows.find((r) => splitAddress(r.address).line === splitAddress(address).line);
  if (!d) return NextResponse.json({ ok: false, error: "Couldn't find that door." }, { status: 404 });
  if (d.target_id) return NextResponse.json({ ok: true, target_id: d.target_id, already: true });

  const a = splitAddress(d.address);
  const row = {
    storm_date: d.hail_date ?? localDay(new Date().toISOString()),
    address: a.line.slice(0, 120),
    city: d.city && !/ County$/.test(d.city) ? d.city : "",
    county: d.county,
    zip: (d.zip || "").slice(0, 10),
    lat: d.lat,
    lon: d.lon,
    owner_name: (d.owner_name || "").slice(0, 120),
    property_type: "Unknown",
    year_built: d.year_built,
    value: d.value,
    // hail_size_in is a reported size; radar hail lives in storm_targets_radar.
    hail_size_in: null,
    absentee: d.absentee ?? false,
    score: 0,
    notes: `Added from the knock map by ${u.name}: ${(d.reasons ?? []).join("; ")}`.slice(0, 500),
  };
  const ins = await fetch(`${process.env.SUPABASE_URL}/rest/v1/storm_targets?on_conflict=storm_date,address`, {
    method: "POST",
    headers: { ...db(), Prefer: "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify([row]),
  });
  if (!ins.ok) {
    console.error("[field/doors] add", ins.status, await ins.text());
    return NextResponse.json({ ok: false, error: "Couldn't add that door. Try again." }, { status: 502 });
  }
  const created = ((await ins.json()) as Array<{ id: string }>)[0];
  return NextResponse.json({ ok: true, target_id: created?.id ?? null });
}
