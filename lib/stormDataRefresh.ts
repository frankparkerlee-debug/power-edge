import { gunzipSync } from "node:zlib";
import { decodeWindow, gridOf } from "@/lib/grib2";

/**
 * Keeps Best doors and the Knock map current (Parker, 2026-11-11):
 *
 *   refreshRadar    each new day of NOAA MRMS MESH radar hail -> hail_days
 *   refreshWind     recent NWS wind and tornado reports -> wind_reports
 *   refreshPermits  new City of Dallas re-roof permits -> reroof_permits
 *
 * public.refresh_cell_signals() (pg_cron, supabase/radar_refresh.sql) then
 * rebuilds the per-cell signals the Map reads. Every step is safe to re-run:
 * rows are upserted on their keys.
 */

const MESH_BUCKET = "https://noaa-mrms-pds.s3.amazonaws.com";
const MESH_PREFIX = "CONUS/MESH_Max_1440min_00.50";
/** The DFW window of the 0.01-degree grid: row 0 is 33.545N, column 0 is 98.145W. */
const DFW = { lat: 33.545, lon: -98.145, rows: 165, cols: 240 };
/** 0.75 in, in mm: smaller hail is not stored (same cut as the original load). */
const MIN_MM = 19.05;

function db() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
  return { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
}
const rest = (path: string) => `${process.env.SUPABASE_URL}/rest/v1/${path}`;

async function upsert(table: string, rows: object[], onConflict: string) {
  for (let i = 0; i < rows.length; i += 1000) {
    const res = await fetch(rest(`${table}?on_conflict=${onConflict}`), {
      method: "POST",
      headers: { ...db(), Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify(rows.slice(i, i + 1000)),
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`${table} upsert ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
}

async function select<T>(path: string): Promise<T[]> {
  const res = await fetch(rest(path), { headers: db(), cache: "no-store" });
  if (!res.ok) throw new Error(`${path.split("?")[0]} ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return (await res.json()) as T[];
}

const isoDay = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (day: string, n: number) => {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return isoDay(d);
};
const centralDay = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: "America/Chicago" });

// ---- Radar hail ----------------------------------------------------------

/** The 24h-max file for local day L is stamped 12:00Z on L+1 (sometimes a few seconds later). */
async function meshFile(localDay: string): Promise<{ key: string; body: Buffer } | null> {
  const stamp = addDays(localDay, 1).replaceAll("-", "");
  const exact = `${MESH_PREFIX}/${stamp}/MRMS_MESH_Max_1440min_00.50_${stamp}-120000.grib2.gz`;
  let res = await fetch(`${MESH_BUCKET}/${exact}`, { cache: "no-store" });
  let key = exact;
  if (res.status === 404 || res.status === 403) {
    const list = await fetch(
      `${MESH_BUCKET}/?list-type=2&prefix=${encodeURIComponent(`${MESH_PREFIX}/${stamp}/MRMS_MESH_Max_1440min_00.50_${stamp}-12`)}`,
      { cache: "no-store" },
    ).then((r) => r.text());
    const found = list.match(/<Key>([^<]+)<\/Key>/)?.[1];
    if (!found) return null;
    key = found;
    res = await fetch(`${MESH_BUCKET}/${found}`, { cache: "no-store" });
  }
  if (!res.ok) throw new Error(`MESH ${localDay}: HTTP ${res.status}`);
  return { key, body: Buffer.from(await res.arrayBuffer()) };
}

export async function refreshRadar(opts: { from?: string; maxDays?: number } = {}) {
  const maxDays = Math.min(Math.max(opts.maxDays ?? 7, 1), 31);
  const done = await select<{ local_date: string }>("radar_days?select=local_date&order=local_date.desc&limit=1");
  // First run: start a few days before the hand load ended (2026-11-10), so
  // the overlap is re-read rather than skipped.
  let day = opts.from ?? (done[0] ? addDays(done[0].local_date, 1) : "2026-11-01");
  const days: Array<{ day: string; cells: number; max_in: number | null; status: string }> = [];

  for (let i = 0; i < maxDays; i++) {
    // Published around 12:00Z on day+1; give it 15 minutes.
    const due = new Date(`${addDays(day, 1)}T12:15:00Z`).getTime();
    if (Date.now() < due) break;
    const file = await meshFile(day);
    if (!file) {
      // NOAA occasionally skips a file. Give up on it after 3 days so one gap
      // does not stall every later day.
      if (Date.now() - due > 3 * 86400e3) {
        await upsert("radar_days", [{ local_date: day, file_key: null, cells: -1, max_in: null }], "local_date");
        days.push({ day, cells: -1, max_in: null, status: "no file, skipped" });
        day = addDays(day, 1);
        continue;
      }
      days.push({ day, cells: 0, max_in: null, status: "not published yet" });
      break;
    }
    const msg = gunzipSync(file.body);
    const grid = gridOf(msg);
    if (Math.abs(grid.di - 0.01) > 1e-9 || Math.abs(grid.dj - 0.01) > 1e-9) {
      throw new Error(`MESH ${day}: grid spacing ${grid.di} x ${grid.dj}, expected 0.01`);
    }
    const r0 = Math.round((grid.lat0 - DFW.lat) / grid.dj);
    const c0 = Math.round((DFW.lon - grid.lon0) / grid.di);
    const { values } = decodeWindow(msg, r0, DFW.rows, c0, DFW.cols);
    const rows: Array<{ r: number; c: number; local_date: string; mesh_in: number }> = [];
    values.forEach((row, r) =>
      row.forEach((mm, c) => {
        if (mm >= MIN_MM) rows.push({ r, c, local_date: day, mesh_in: Math.round((mm / 25.4) * 100) / 100 });
      }),
    );
    await upsert("hail_days", rows, "r,c,local_date");
    const max_in = rows.length ? Math.max(...rows.map((x) => x.mesh_in)) : null;
    await upsert("radar_days", [{ local_date: day, file_key: file.key, cells: rows.length, max_in }], "local_date");
    days.push({ day, cells: rows.length, max_in, status: "loaded" });
    day = addDays(day, 1);
  }
  return days;
}

// ---- Wind reports ----------------------------------------------------------

type LsrFeature = {
  geometry: { coordinates: [number, number] };
  properties: { valid: string; typetext?: string; magf?: number | null; city?: string; remark?: string };
};

/** Roof-relevant NWS reports from the Fort Worth office over North Texas (scripts/house-scoring/wind_reports.py). */
export async function refreshWind(opts: { days?: number } = {}) {
  const days = Math.min(Math.max(opts.days ?? 3, 1), 800);
  const ets = new Date();
  const sts = new Date(ets.getTime() - days * 86400e3);
  const fmt = (d: Date) => `${d.toISOString().slice(0, 16)}Z`;
  const url = `https://mesonet.agron.iastate.edu/geojson/lsr.geojson?sts=${fmt(sts)}&ets=${fmt(ets)}&wfos=FWD`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`IEM LSR ${res.status}`);
  const features = ((await res.json()) as { features?: LsrFeature[] }).features ?? [];
  const keep: object[] = [];
  for (const f of features) {
    const [lon, lat] = f.geometry.coordinates;
    if (!(lat >= 31.9 && lat <= 33.55 && lon >= -98.15 && lon <= -95.75)) continue;
    const tt = (f.properties.typetext || "").toUpperCase();
    const damage = tt === "TSTM WND DMG" || tt === "NON-TSTM WND DMG" || tt === "TORNADO";
    const gust = (tt === "TSTM WND GST" || tt === "NON-TSTM WND GST") && (f.properties.magf ?? 0) >= 58;
    if (!damage && !gust) continue;
    const valid = new Date(f.properties.valid.endsWith("Z") ? f.properties.valid : `${f.properties.valid}Z`);
    keep.push({
      id: `${f.properties.valid}|${tt}|${lat.toFixed(4)}|${lon.toFixed(4)}`,
      valid_at: valid.toISOString(),
      local_date: centralDay(valid),
      type: tt,
      mph: f.properties.magf ?? null,
      lat: Math.round(lat * 1e4) / 1e4,
      lon: Math.round(lon * 1e4) / 1e4,
      city: f.properties.city || null,
      remark: (f.properties.remark || "").slice(0, 200) || null,
    });
  }
  await upsert("wind_reports", keep, "id");
  return { days, reports: features.length, kept: keep.length };
}

// ---- Dallas permits --------------------------------------------------------

type DallasPermit = {
  permit_number: string;
  issued_date: string; // "11/10/26"
  street_address?: string;
  zip_code?: string;
  contractor?: string;
  work_description?: string;
};

const norm = (a: string) => a.split(",")[0].trim().toUpperCase().replace(/\s+/g, " ");
const mdy = (s: string) => {
  const [m, d, y] = s.split("/").map(Number);
  return `${2000 + y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
};

async function geocode(street: string, zip: string): Promise<{ lat: number; lon: number } | null> {
  const q = encodeURIComponent(`${street}, Dallas, TX ${zip}`.trim());
  const res = await fetch(
    `https://geocoding.geo.census.gov/geocoder/locations/onelineaddress?address=${q}&benchmark=Public_AR_Current&format=json`,
    { cache: "no-store" },
  ).catch(() => null);
  if (!res?.ok) return null;
  const j = (await res.json().catch(() => null)) as {
    result?: { addressMatches?: Array<{ coordinates: { x: number; y: number } }> };
  } | null;
  const m = j?.result?.addressMatches?.[0];
  return m ? { lat: Math.round(m.coordinates.y * 1e6) / 1e6, lon: Math.round(m.coordinates.x * 1e6) / 1e6 } : null;
}

/** New Dallas residential re-roof permits from the city's open data (no key). */
export async function refreshPermits(opts: { lookbackDays?: number } = {}) {
  const lookback = Math.min(Math.max(opts.lookbackDays ?? 45, 7), 400);
  const since = addDays(isoDay(new Date()), -lookback);
  const url =
    "https://www.dallasopendata.com/resource/e7gq-4sah.json?" +
    new URLSearchParams({
      $where: "permit_type='Residential Roofing Permit'",
      $order: ":id DESC",
      $limit: String(lookback > 60 ? 5000 : 1500),
    });
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Dallas permits ${res.status}`);
  const recent = ((await res.json()) as DallasPermit[]).filter(
    (p) => p.permit_number && p.issued_date && p.street_address && mdy(p.issued_date) >= since,
  );

  // Only the ones we do not have yet.
  const have = new Set<string>();
  for (let i = 0; i < recent.length; i += 150) {
    const ids = recent.slice(i, i + 150).map((p) => `"${p.permit_number.replace(/"/g, "")}"`).join(",");
    for (const r of await select<{ permit_number: string }>(`reroof_permits?select=permit_number&permit_number=in.(${ids})`)) {
      have.add(r.permit_number);
    }
  }
  const fresh = recent.filter((p) => !have.has(p.permit_number));

  const rows: object[] = [];
  let unmatched = 0;
  for (let i = 0; i < fresh.length; i += 6) {
    const batch = fresh.slice(i, i + 6);
    const found = await Promise.all(batch.map((p) => geocode(norm(p.street_address || ""), (p.zip_code || "").slice(0, 5))));
    batch.forEach((p, k) => {
      const g = found[k];
      if (!g) {
        unmatched++;
        return;
      }
      const contractor = (p.contractor || "").trim().toUpperCase().replace(/\s+/g, " ");
      rows.push({
        permit_number: p.permit_number,
        city: "dallas",
        issued_date: mdy(p.issued_date),
        street: norm(p.street_address || ""),
        zip: (p.zip_code || "").slice(0, 5) || null,
        lat: g.lat,
        lon: g.lon,
        contractor,
        work: (p.work_description || "").slice(0, 200) || null,
      });
    });
  }
  await upsert("reroof_permits", rows, "permit_number");
  return { checked: recent.length, new: fresh.length, added: rows.length, unmatched };
}
