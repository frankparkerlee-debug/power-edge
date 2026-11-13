import { geocode } from "@/lib/geocode";

/**
 * Coach's view of the storm data: one house, or the best streets near a rep.
 *
 * Both go through public.field_doors, the same function the knock map uses,
 * so a "priority" street here is a priority street there (old roof or repeat
 * storms, with a storm inside the 1-year claim window; see
 * supabase/field_doors.sql). Owner names and phone numbers are left out on
 * purpose: Coach never needs them, so they never leave our database.
 */

const DFW = { south: 31.9, north: 33.6, west: -98.2, east: -95.7 };
export const inDfw = (lat: number, lon: number) =>
  lat >= DFW.south && lat <= DFW.north && lon >= DFW.west && lon <= DFW.east;

function db() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
  return { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
}

type Row = {
  target_id: string | null;
  address: string;
  city: string | null;
  zip: string | null;
  lat: number;
  lon: number;
  dist_mi: number;
  year_built: number | null;
  hail_in: number | null;
  hail_date: string | null;
  storm_date: string | null;
  wind_kind: string | null;
  wind_date: string | null;
  wind_roof: boolean | null;
  wind_dist_mi: number | null;
  wind_mph: number | null;
  permit_date: string | null;
  recent_roof: boolean | null;
  storm_days: string[] | null;
  roof_original: boolean | null;
  no_permit_since: string | null;
  priority: boolean | null;
  last_outcome: string | null;
  last_knock_at: string | null;
  last_rep: string | null;
  last_note: string | null;
  job_stage: string | null;
  appt_status: string | null;
  total: number;
};

async function fieldDoors(p: {
  lat: number;
  lon: number;
  miles: number;
  minHail: number | null;
  zip?: string | null;
  order?: "dist" | "hail" | "score";
  view?: "hail" | "priority";
  limit?: number;
}): Promise<Row[]> {
  const res = await fetch(`${process.env.SUPABASE_URL}/rest/v1/rpc/field_doors`, {
    method: "POST",
    headers: db(),
    body: JSON.stringify({
      p_lat: p.lat,
      p_lon: p.lon,
      p_miles: p.miles,
      p_min_hail: p.minHail,
      p_zip: p.zip ?? null,
      p_order: p.order ?? "dist",
      p_limit: p.limit ?? 1000,
      p_view: p.view ?? "hail",
    }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`field_doors ${res.status}`);
  return (await res.json()) as Row[];
}

const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** "2026-04-25" -> "April 25, 2026" style, short month. */
export function niceDate(iso: string | null | undefined) {
  if (!iso) return "";
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return `${MON[m - 1]} ${d}, ${y}`;
}
const title = (s: string) => s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
function lineOf(raw: string) {
  return String(raw || "").split(",")[0].trim().replace(/\s+/g, " ").toUpperCase();
}
function streetOf(line: string) {
  const m = line.match(/^(\d+[A-Z]?)\s+(.*)$/i);
  return m ? { num: m[1], street: title(m[2]) } : { num: "", street: title(line) };
}

const OUTCOME: Record<string, string> = {
  not_home: "nobody home",
  come_back: "asked us to come back",
  not_interested: "said no",
  do_not_knock: "asked not to be knocked",
  already_done: "said the roof was already done",
  appointment_set: "booked an inspection",
  inspected: "had an inspection",
};

export type HouseFacts = {
  address: string;
  street: string;
  city: string;
  zip: string;
  lat: number;
  lon: number;
  target_id: string | null;
  year_built: number | null;
  /** Radar hail at the house, inches, and the day of loss. */
  hail_in: number | null;
  hail_date: string | null;
  /** Storms since the roof was last replaced, last 24 months. */
  storms: string[];
  wind: string | null;
  /** City of Dallas re-roof permit date, when there is one. */
  permit_date: string | null;
  recent_permit: boolean;
  roof_may_be_original: boolean;
  priority: boolean;
  claim_window: string | null;
  /** What we already did at this door. */
  history: string | null;
  last_note: string | null;
};

function claimWindow(r: Row) {
  const storms = [...(r.storm_days ?? [])];
  if ((r.hail_in ?? 0) >= 1 && r.hail_date && !(r.permit_date && r.permit_date >= r.hail_date)) storms.push(r.hail_date);
  const last = storms.sort().at(-1);
  if (!last) return null;
  const until = new Date(`${last.slice(0, 10)}T12:00:00`);
  until.setFullYear(until.getFullYear() + 1);
  return until.getTime() > Date.now()
    ? `Open to ${niceDate(until.toISOString())} (1 year from the ${niceDate(last)} storm)`
    : `Past the 1-year window from the ${niceDate(last)} storm, likely a cash job`;
}

function factsOf(r: Row): HouseFacts {
  const line = lineOf(r.address);
  const s = streetOf(line);
  let wind: string | null = null;
  if (r.wind_date && r.wind_dist_mi != null) {
    const what =
      r.wind_kind === "tornado" ? "Tornado" : r.wind_roof ? "Roof damage" : r.wind_kind === "wind_damage" ? "Wind damage" : r.wind_mph ? `${Math.round(r.wind_mph)} mph gust` : "Wind";
    wind = `${what} reported ${r.wind_dist_mi.toFixed(1)} mi away on ${niceDate(r.wind_date)}`;
  }
  let history: string | null = null;
  if (r.job_stage) history = `Already a PowerEdge job (${r.job_stage.replace(/_/g, " ")})`;
  else if (r.last_outcome) {
    const who = r.last_rep ? ` (${r.last_rep.split(" ")[0]})` : "";
    history = `Knocked ${niceDate(r.last_knock_at)}${who}: ${OUTCOME[r.last_outcome] ?? r.last_outcome.replace(/_/g, " ")}`;
  }
  return {
    address: title(line),
    street: s.street,
    city: r.city && !/ County$/i.test(r.city) ? title(r.city) : "",
    zip: (r.zip || "").slice(0, 5),
    lat: r.lat,
    lon: r.lon,
    target_id: r.target_id,
    year_built: r.year_built,
    hail_in: r.hail_in != null ? Math.round(r.hail_in * 10) / 10 : null,
    hail_date: r.storm_date ?? r.hail_date,
    storms: r.storm_days ?? [],
    wind,
    permit_date: r.permit_date,
    recent_permit: !!r.permit_date && Date.now() - new Date(r.permit_date).getTime() <= 10 * 365.25 * 86400e3,
    roof_may_be_original: !!r.roof_original,
    priority: !!r.priority,
    claim_window: claimWindow(r),
    history,
    last_note: r.last_note ? r.last_note.slice(0, 200) : null,
  };
}

/** A house the rep tapped on the map: matched by address, else the nearest door. */
export async function houseAt(lat: number, lon: number, address?: string): Promise<HouseFacts | null> {
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || !inDfw(lat, lon)) return null;
  const rows = await fieldDoors({ lat, lon, miles: 0.15, minHail: null, limit: 300 });
  if (!rows.length) return null;
  const want = address ? lineOf(address) : "";
  const byLine = want ? rows.find((r) => lineOf(r.address) === want) : undefined;
  const byNum = want
    ? rows.find((r) => {
        const a = streetOf(lineOf(r.address)), b = streetOf(want);
        return a.num === b.num && a.street.split(" ")[0] === b.street.split(" ")[0];
      })
    : undefined;
  const nearest = [...rows].sort((a, b) => a.dist_mi - b.dist_mi)[0];
  const hit = byLine ?? byNum ?? (nearest.dist_mi <= 0.05 ? nearest : undefined);
  return hit ? factsOf(hit) : null;
}

/** A typed address: geocode it, then find the house in our data. */
export async function houseByAddress(text: string): Promise<HouseFacts | null> {
  const q = text.trim().slice(0, 160);
  if (!q) return null;
  const g = await geocode(/\b(tx|texas)\b/i.test(q) ? q : `${q}, TX`);
  if (!g || !inDfw(g.lat, g.lon)) return null;
  return houseAt(g.lat, g.lon, q);
}

export type Street = {
  street: string;
  city: string;
  zip: string;
  open: number;
  priority: number;
  worked: number;
  recent_permits: number;
  hail_in: number | null;
  hail_date: string | null;
  why: string;
  map: string;
  /** A door on this street that hasn't been worked, to practice before knocking. */
  sample: { lat: number; lon: number; address: string } | null;
};

const isOpen = (r: Row) => !r.job_stage && (!r.last_outcome || r.last_outcome === "not_home");

/**
 * The best streets near a point or in a ZIP. Priority doors first (the knock
 * map's own rule); when a place has none, the biggest radar hail instead.
 */
export async function bestStreets(where: { lat: number; lon: number } | { zip: string }) {
  let lat: number, lon: number, zip: string | null = null, miles: number;
  if ("zip" in where) {
    const g = await geocode(`${where.zip}, TX`);
    if (!g || !inDfw(g.lat, g.lon)) return { ok: false as const, error: `Couldn't find ZIP ${where.zip} in North Texas.` };
    lat = g.lat;
    lon = g.lon;
    zip = where.zip;
    miles = 3;
  } else {
    lat = where.lat;
    lon = where.lon;
    if (!inDfw(lat, lon)) return { ok: false as const, error: "That location is outside DFW." };
    miles = 1;
  }

  let basis: "priority" | "hail" = "priority";
  let rows = await fieldDoors({ lat, lon, miles, minHail: null, zip, order: zip ? "score" : "dist", view: "priority" });
  if (rows.filter(isOpen).length < 5) {
    basis = "hail";
    rows = await fieldDoors({ lat, lon, miles, minHail: 1, zip, order: zip ? "hail" : "dist", view: "hail" });
  }
  if (!rows.length) return { ok: true as const, basis, streets: [] as Street[], zip };

  const groups = new Map<string, Row[]>();
  for (const r of rows) {
    const s = streetOf(lineOf(r.address)).street;
    const key = `${s}|${(r.zip || "").slice(0, 5)}`;
    groups.set(key, [...(groups.get(key) ?? []), r]);
  }

  const streets: Street[] = [...groups.entries()].map(([key, rs]) => {
    const [street, z] = key.split("|");
    const open = rs.filter(isOpen);
    const pri = open.filter((r) => r.priority).length;
    const top = [...rs].sort((a, b) => (b.hail_in ?? 0) - (a.hail_in ?? 0))[0];
    const permits = rs.filter((r) => r.permit_date && Date.now() - new Date(r.permit_date).getTime() <= 10 * 365.25 * 86400e3).length;
    const bits: string[] = [];
    if (top.hail_in) bits.push(`${(Math.round(top.hail_in * 10) / 10).toFixed(1)}″ hail reported ${niceDate(top.storm_date ?? top.hail_date)}`);
    bits.push(
      `${open.length} not knocked yet${pri ? (pri === open.length ? ", all priority" : `, ${pri} priority`) : ""}`,
    );
    if (permits) bits.push(`${permits} with a recent roof permit (skip those)`);
    const sample = open.find((r) => r.priority) ?? open[0];
    const city = rs[0].city && !/ County$/i.test(rs[0].city) ? title(rs[0].city) : "";
    const view = basis === "priority" ? "priority" : "hail1";
    return {
      street,
      city,
      zip: z,
      open: open.length,
      priority: pri,
      worked: rs.length - open.length,
      recent_permits: permits,
      hail_in: top.hail_in != null ? Math.round(top.hail_in * 10) / 10 : null,
      hail_date: top.storm_date ?? top.hail_date,
      why: bits.join(" · "),
      map: z ? `/admin/storms?zip=${z}&view=${view}` : "/admin/storms",
      sample: sample ? { lat: sample.lat, lon: sample.lon, address: title(lineOf(sample.address)) } : null,
    };
  });

  streets.sort((a, b) => b.priority - a.priority || b.open - a.open || (b.hail_in ?? 0) - (a.hail_in ?? 0));
  return { ok: true as const, basis, zip, streets: streets.filter((s) => s.open > 0).slice(0, 8) };
}
