import { NextResponse } from "next/server";
import { apiUser } from "@/lib/auth";
import { geocode } from "@/lib/geocode";
import { localDay } from "@/lib/day";

export const dynamic = "force-dynamic";

/**
 * The knock map's doors.
 *
 *   GET  /api/field/doors?near=lat,lon[&mi=0.5][&view=hail2|hail1|older]
 *   GET  /api/field/doors?zip=76135[&view=...]
 *   POST /api/field/doors { lat, lon, address }   puts a door on the knock list
 *
 * Every house Best doors can place (storm targets, county records, Dallas
 * permit addresses), with radar hail at the house, plus what the CRM knows:
 * the date of loss, a callable phone, the last knock and who made it, an open
 * come-back, and the job and its booked inspection. The work is in
 * public.field_doors; this route checks the caller, shapes the rows, and adds
 * a door to the knock list the first time someone acts on it.
 *
 * view: priority is old roofs or repeat storms with a storm inside the 1-year
 * claim window (see public.field_doors); hail2 (default) is 2 in+ radar hail, the level that showed real
 * re-roofing in the Dallas permit test (scope doc, 2026-11-11); hail1 widens
 * to 1 in+; older is homes built 15 to 30 years ago with no sign of a newer
 * roof, hail or not. Doors we have worked show in every view. The old big=0
 * still means hail1.
 */

type View = "priority" | "hail2" | "hail1" | "older";

/** A Dallas re-roof permit this recent marks the door blue on the map. */
const RECENT_PERMIT_MS = 10 * 365.25 * 86400e3;

/**
 * Tex. Ins. Code 2301.010(c) lets a homeowner policy require a claim within one
 * year of the loss (late filing allowed for good cause; some carriers give two).
 * A storm older than this is treated as a likely cash job, not an insurance one.
 */
const CLAIM_WINDOW_DAYS = 365;

const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const thisYear = new Date().getFullYear();
/** "2026-05-25" -> "May 25", or "Aug 3 '25" outside this year. */
function day(iso: string, withYear = false) {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return `${MON[m - 1]} ${d}${withYear ? `, ${y}` : y !== thisYear ? ` '${String(y).slice(2)}` : ""}`;
}
const daysAgo = (iso: string) => (Date.now() - new Date(`${iso.slice(0, 10)}T12:00:00`).getTime()) / 86400e3;

/** Short signals a rep reads at a glance: storms, wind, permits, the claim window. */
function signals(r: Row) {
  const tags: string[] = [];
  const storms = r.storm_days ?? [];
  if (storms.length >= 2) tags.push(`${storms.length} storms since the roof: ${storms.map((d) => day(d)).join(", ")}`);

  if (r.wind_date && daysAgo(r.wind_date) <= 365 && r.wind_dist_mi != null) {
    const what =
      r.wind_kind === "tornado"
        ? "Tornado"
        : r.wind_roof
          ? "Roof damage reported"
          : r.wind_kind === "wind_damage"
            ? "Wind damage reported"
            : r.wind_mph
              ? `${Math.round(r.wind_mph)} mph gust`
              : "Wind report";
    tags.push(`${what} ${r.wind_dist_mi.toFixed(1)} mi away, ${day(r.wind_date)}`);
  }

  if (r.no_permit_since) tags.push(`No roof permit filed since the ${day(r.no_permit_since)} storm`);

  // The claim window runs from the latest storm the current roof has seen.
  const roofNewer = (d: string) => !!r.permit_date && r.permit_date >= d.slice(0, 10);
  const candidates = [...storms];
  if ((r.hail_in ?? 0) >= 1 && r.hail_date && !roofNewer(r.hail_date)) candidates.push(r.hail_date);
  const last = candidates.sort().at(-1);
  let claim: "open" | "cash" | null = null;
  if (last) {
    if (daysAgo(last) <= CLAIM_WINDOW_DAYS) {
      claim = "open";
      const until = new Date(`${last.slice(0, 10)}T12:00:00`);
      until.setFullYear(until.getFullYear() + 1);
      tags.push(`Claim window open to ${day(until.toISOString(), true)}`);
    } else {
      claim = "cash";
      tags.push(`Last storm ${day(last)}: past the 1-year claim window, likely cash`);
    }
  }
  return { tags, claim };
}

/** Why a door is a priority knock, in a few words. */
function priorityWhy(r: Row) {
  if (!r.priority) return null;
  const storms = r.storm_days ?? [];
  const latest = [...storms, ...(r.hail_date && (r.hail_in ?? 0) >= 1.25 ? [r.hail_date] : [])].sort().at(-1);
  const storm =
    (r.hail_in ?? 0) >= 1.25 && r.hail_date
      ? `${(Math.round((r.hail_in ?? 0) * 10) / 10).toFixed(1)}″ hail ${day(r.hail_date)}`
      : latest
        ? `storm ${day(latest)}`
        : "a storm this year";
  if (r.roof_original) return `Roof may be original + ${storm}`;
  return `${storms.length} storms since the roof, latest ${day(storms.at(-1) ?? latest ?? "")}`;
}

/** Most doors one load sends: the API's per-call ceiling, and plenty for a day. */
const MAX_DOORS = 1000;

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
  score: number | null;
  wind_mph: number | null;
  big_hail_old_date: string | null;
  /** Storms since the roof was last replaced (as far as we know), last 24 months. */
  storm_days: string[] | null;
  roof_original: boolean | null;
  /** City of Dallas: the storm date when no re-roof permit has been filed since. */
  no_permit_since: string | null;
  priority: boolean | null;
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
  /** Doors matching before the 1,000-row cap. */
  total: number;
};

async function fieldDoors(
  lat: number,
  lon: number,
  mi: number,
  minHail: number | null,
  zip: string | null,
  order: "dist" | "hail" | "score" = "dist",
  view: "hail" | "older" | "priority" = "hail",
) {
  const res = await fetch(`${process.env.SUPABASE_URL}/rest/v1/rpc/field_doors`, {
    method: "POST",
    headers: db(),
    body: JSON.stringify({
      p_lat: lat,
      p_lon: lon,
      p_miles: mi,
      p_min_hail: minHail,
      p_zip: zip,
      p_order: order,
      p_limit: MAX_DOORS,
      p_view: view,
    }),
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
  if (stage === "lost") return { kind: "no", by: r.last_rep, when: r.last_knock_at, note: r.last_note };
  if (stage) {
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
    // Logged from the office tools: a roof already done is a no (red); an
    // inspection with no job yet is still being worked (yellow).
    case "already_done":
      return { kind: "no", by: r.last_rep, when: r.last_knock_at, note: r.last_note || "Reason: Already done" };
    case "inspected":
      return { kind: "job", stage: "inspected" };
    case "not_home":
      return { kind: "not_home", by: r.last_rep, when: r.last_knock_at };
    case "appointment_set":
      return { kind: "appointment", at: null };
    default:
      return { kind: "new", by: r.last_rep, when: r.last_knock_at };
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
    // "Built 1999, no big hail here since 2020: roof may be original" read as
    // a contradiction beside this April's 2.5 in; it means no golf-ball hail
    // before this past year. Say only what a rep can use.
    // A bare "Built 1953" repeats the year-built line; keep only notes that add something.
    // In the City of Dallas a re-roof needs a permit, so golf-ball hail with no
    // permit since means the roof was likely NOT replaced.
    roof_note:
      r.no_permit_since && r.big_hail_old_date && r.no_permit_since === r.big_hail_old_date
        ? `Golf-ball+ hail on radar ${day(r.big_hail_old_date)} and no Dallas roof permit since`
        : (reasons
            .find((x) => /^(Re-roofed|Golf-ball|Built )/.test(x))
            ?.replace(/, no big hail here since 2020/, "") ?? "")
            .replace(/^Built \d{4}$/, "") || null,
    wind_note: reasons.find((x) => /reported/.test(x)) ?? null,
    recent_roof: !!r.recent_roof,
    // Re-roofed under a Dallas permit in the last 10 years: pitch repairs,
    // gutters, fence or siding rather than a whole roof.
    recent_permit: !!r.permit_date && Date.now() - new Date(r.permit_date).getTime() <= RECENT_PERMIT_MS,
    score: r.score ?? 0,
    priority: !!r.priority,
    priority_why: priorityWhy(r),
    ...(() => {
      const s = signals(r);
      return { signals: s.tags, claim: s.claim };
    })(),
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
  const v = url.searchParams.get("view");
  const view: View =
    v === "older" || v === "priority"
      ? v
      : v === "hail1" || (!v && url.searchParams.get("big") === "0")
        ? "hail1"
        : "hail2";
  const minHail = view === "hail2" ? 2 : view === "hail1" ? 1 : null;
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
    // The database sorts (nearest; for a ZIP, biggest hail or, for older roofs,
    // the best-door score) and caps at
    // 1,000: a phone on cell data should not pull 10,000 doors, and the API
    // would silently stop at 1,000 anyway. total says how many there were.
    const order = zip == null ? "dist" : view === "older" || view === "priority" ? "score" : "hail";
    const sent = await fieldDoors(lat, lon, mi, minHail, zip, order, view === "hail2" || view === "hail1" ? "hail" : view);
    const total = sent.length ? Number(sent[0].total) : 0;
    return NextResponse.json({
      ok: true,
      center: { lat, lon },
      mi,
      zip,
      view,
      total,
      doors: sent.map(shape),
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
