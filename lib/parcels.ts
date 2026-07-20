// Parcel intersect — turns storm reports into named homeowners at addresses.
//
// County connectors (public appraisal-district GIS services, one per county):
//   • Dallas County — DCAD ParcelPublishing layer (verified): owner, site
//     address, MAILING address (absentee/investor detection), use type, year
//     built, assessed value. Web-Mercator envelope queries, max 4000/query.
//   • Tarrant County — TAD's own FeatureServer (behind their Experience app)
//     for geometry + owner/situs/year/value, ENRICHED from the TAD roll loaded
//     into Supabase `tarrant_roll` (mailing address → absentee, city, zip).
//   • Collin/Denton — no public spatial layer found yet.
//
// Flow (generateStormTargets): hail ≥1″ reports for a day → envelope around
// each (sized by hail) → parcel query → dedupe → solar-permit match → score →
// insert storm_targets (idempotent on storm_date+address).

import { haversineMi } from "@/lib/storm";

const DCAD_QUERY =
  "https://maps.dcad.org/prdwa/rest/services/Property/ParcelQuery/MapServer/4/query";
const TAD_QUERY =
  "https://tad.newedgeservices.com/arcgis/rest/services/Hosted/TADMap/FeatureServer/0/query";
const PER_EVENT_CAP = 150;
const EVENTS_PER_RUN = 40;

export type ParcelHit = {
  owner_name: string;
  address: string;
  city: string;
  zip: string;
  mailing: string;
  property_type: string;
  year_built: number | null;
  value: number | null;
  county: string;
  lat: number | null;
  lon: number | null;
};


function webMercator(lat: number, lon: number) {
  const x = (lon * 20037508.34) / 180;
  const y =
    ((Math.log(Math.tan(((90 + lat) * Math.PI) / 360)) / (Math.PI / 180)) * 20037508.34) / 180;
  return { x, y };
}

/** Envelope half-side in miles, scaled by hail size. */
function reachMi(size: number) {
  if (size >= 2) return 0.9;
  if (size >= 1.5) return 0.7;
  return 0.5;
}

const clean = (s: unknown) => String(s ?? "").trim();

async function queryDallasParcels(
  lat: number,
  lon: number,
  halfMi: number,
): Promise<ParcelHit[]> {
  const dLat = halfMi / 69;
  const dLon = halfMi / (69 * Math.cos((lat * Math.PI) / 180));
  const a = webMercator(lat - dLat, lon - dLon);
  const b = webMercator(lat + dLat, lon + dLon);
  const params = new URLSearchParams({
    geometry: `${a.x.toFixed(1)},${a.y.toFixed(1)},${b.x.toFixed(1)},${b.y.toFixed(1)}`,
    geometryType: "esriGeometryEnvelope",
    inSR: "102100",
    where: "SITEADDRESS IS NOT NULL",
    outFields:
      "OWNERNME1,SITEADDRESS,PSTLADDRESS,PSTLCITY,PSTLZIP5,USEDSCRP,RESYRBLT,CNTASSDVAL,CVTTXDSCRP",
    // DCAD's older MapServer ignores returnCentroid — pull simplified geometry
    // (reprojected to 4326) and take the bbox center ourselves.
    returnGeometry: "true",
    outSR: "4326",
    geometryPrecision: "5",
    resultRecordCount: String(PER_EVENT_CAP),
    f: "json",
  });
  const res = await fetch(`${DCAD_QUERY}?${params}`, {
    signal: AbortSignal.timeout(25000),
    cache: "no-store",
  });
  if (!res.ok) return [];
  const data = await res.json();
  const feats = (data?.features ?? []) as Array<{
    attributes: Record<string, unknown>;
    geometry?: { rings?: number[][][] };
  }>;
  const ringCenter = (rings?: number[][][]) => {
    const ring = rings?.[0];
    if (!ring || ring.length === 0) return { lat: null, lon: null };
    const xs = ring.map((p) => p[0]);
    const ys = ring.map((p) => p[1]);
    return {
      lon: (Math.min(...xs) + Math.max(...xs)) / 2,
      lat: (Math.min(...ys) + Math.max(...ys)) / 2,
    };
  };
  return feats
    .map(({ attributes: at, geometry }) => ({
      ...ringCenter(geometry?.rings),
      owner_name: clean(at.OWNERNME1),
      address: clean(at.SITEADDRESS).toUpperCase(),
      city: clean(at.CVTTXDSCRP) || "Dallas County",
      zip: clean(at.PSTLZIP5),
      mailing: `${clean(at.PSTLADDRESS)}, ${clean(at.PSTLCITY)}`.toUpperCase(),
      property_type: clean(at.USEDSCRP) || "Unknown",
      year_built: typeof at.RESYRBLT === "number" && at.RESYRBLT > 1800 ? at.RESYRBLT : null,
      value: typeof at.CNTASSDVAL === "number" ? at.CNTASSDVAL : null,
      county: "dallas" as const,
    }))
    .filter((p) => p.owner_name && p.address);
}

/** Tarrant County — TAD's FeatureServer accepts 4326 envelopes directly.
 *  Gives owner + situs + year/value; mailing/city/zip come from tarrant_roll. */
async function queryTarrantParcels(
  lat: number,
  lon: number,
  halfMi: number,
): Promise<ParcelHit[]> {
  const dLat = halfMi / 69;
  const dLon = halfMi / (69 * Math.cos((lat * Math.PI) / 180));
  const params = new URLSearchParams({
    geometry: `${(lon - dLon).toFixed(5)},${(lat - dLat).toFixed(5)},${(lon + dLon).toFixed(5)},${(lat + dLat).toFixed(5)}`,
    geometryType: "esriGeometryEnvelope",
    inSR: "4326",
    where: "improvementmarketvalue > 25000 AND situsaddress IS NOT NULL",
    outFields: "displayname,situsaddress,applclasscd,yearbuilt,totalmarketvalue",
    returnGeometry: "false",
    returnCentroid: "true",
    outSR: "4326",
    resultRecordCount: String(PER_EVENT_CAP),
    f: "json",
  });
  const res = await fetch(`${TAD_QUERY}?${params}`, {
    signal: AbortSignal.timeout(25000),
    cache: "no-store",
  });
  if (!res.ok) return [];
  const data = await res.json();
  const feats = (data?.features ?? []) as Array<{
    attributes: Record<string, unknown>;
    centroid?: { x: number; y: number };
  }>;
  return feats
    .map(({ attributes: at, centroid }) => ({
      lat: centroid ? centroid.y : null,
      lon: centroid ? centroid.x : null,
      owner_name: clean(at.displayname),
      address: clean(at.situsaddress).toUpperCase(),
      city: "", // enriched from tarrant_roll
      zip: "",
      mailing: "",
      property_type: clean(at.applclasscd) || "Unknown",
      year_built:
        typeof at.yearbuilt === "number" && at.yearbuilt > 1800 ? at.yearbuilt : null,
      value: typeof at.totalmarketvalue === "number" ? at.totalmarketvalue : null,
      county: "tarrant" as const,
    }))
    .filter((p) => p.owner_name && p.address);
}

function dbHeaders() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  };
}

/** Collin/Denton/Kaufman — TxGIO StratMap parcels loaded into our own DB with
 *  centroids, so the "query" is a lat/lon box against Supabase. One call covers
 *  every DB-loaded county at once. */
async function queryDbParcels(lat: number, lon: number, halfMi: number): Promise<ParcelHit[]> {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return [];
  const dLat = halfMi / 69;
  const dLon = halfMi / (69 * Math.cos((lat * Math.PI) / 180));
  try {
    const res = await fetch(
      `${process.env.SUPABASE_URL}/rest/v1/parcels?select=county,owner,situs,city,zip,mail,land_use,year_built,mkt_value,lat,lon` +
        `&lat=gte.${(lat - dLat).toFixed(6)}&lat=lte.${(lat + dLat).toFixed(6)}` +
        `&lon=gte.${(lon - dLon).toFixed(6)}&lon=lte.${(lon + dLon).toFixed(6)}` +
        `&order=imp_value.desc.nullslast&limit=${PER_EVENT_CAP}`,
      { headers: dbHeaders(), cache: "no-store" },
    );
    if (!res.ok) return [];
    const rows = (await res.json()) as Array<{
      county: string;
      owner: string;
      situs: string;
      city: string;
      zip: string;
      mail: string;
      land_use: string;
      year_built: number | null;
      mkt_value: number | null;
      lat: number | null;
      lon: number | null;
    }>;
    return rows
      .map((r) => ({
        lat: r.lat,
        lon: r.lon,
        owner_name: (r.owner || "").trim(),
        address: (r.situs || "").trim().toUpperCase(),
        city: (r.city || "").trim(),
        zip: (r.zip || "").trim().slice(0, 5),
        mailing: (r.mail || "").trim().toUpperCase(),
        property_type: (r.land_use || "Unknown").trim(),
        year_built: r.year_built,
        value: r.mkt_value,
        county: r.county,
      }))
      .filter((p) => p.owner_name && p.address);
  } catch {
    return [];
  }
}

const normAddr = (s: string) => s.toUpperCase().replace(/[^A-Z0-9 ]/g, "").replace(/\s+/g, " ").trim();

/** Solar-permit addresses in the given zips (normalized set for matching). */
async function solarAddressSet(zips: string[]): Promise<Set<string>> {
  const out = new Set<string>();
  if (zips.length === 0) return out;
  const list = zips
    .filter((z) => /^\d{5}$/.test(z))
    .slice(0, 40)
    .join(",");
  if (!list) return out;
  const res = await fetch(
    `${process.env.SUPABASE_URL}/rest/v1/solar_permits?select=address&zip=in.(${list})&limit=8000`,
    { headers: dbHeaders(), cache: "no-store" },
  );
  if (!res.ok) return out;
  const rows = (await res.json()) as Array<{ address: string }>;
  for (const r of rows) if (r.address) out.add(normAddr(r.address));
  return out;
}

/** Fill Tarrant hits' mailing/city/zip from the loaded TAD roll (by situs). */
async function enrichFromTarrantRoll(
  hits: Array<ParcelHit & { hail: number }>,
): Promise<void> {
  const need = hits.filter((h) => !h.mailing);
  for (let i = 0; i < need.length; i += 60) {
    const chunk = need.slice(i, i + 60);
    const list = chunk.map((h) => `"${normAddr(h.address).replace(/"/g, "")}"`).join(",");
    try {
      const res = await fetch(
        `${process.env.SUPABASE_URL}/rest/v1/tarrant_roll?select=situs_norm,mail_addr,mail_citystate,mail_zip,city,bedrooms&situs_norm=in.(${encodeURIComponent(list)})`,
        { headers: dbHeaders(), cache: "no-store" },
      );
      if (!res.ok) continue;
      const rows = (await res.json()) as Array<{
        situs_norm: string;
        mail_addr: string;
        mail_citystate: string;
        mail_zip: string;
        city: string;
      }>;
      const byNorm = new Map(rows.map((r) => [r.situs_norm, r]));
      for (const h of chunk) {
        const r = byNorm.get(normAddr(h.address));
        if (!r) continue;
        h.mailing = `${r.mail_addr}, ${r.mail_citystate} ${r.mail_zip}`.toUpperCase().trim();
        h.city = r.city || h.city; // jurisdiction-derived — correct for the property
        // Property zip is only knowable when the owner lives there (mail == situs).
        if (normAddr(r.mail_addr) === normAddr(h.address)) h.zip = (r.mail_zip || "").slice(0, 5);
      }
    } catch {
      /* enrichment is best-effort */
    }
  }
}

/** Street-number+name portion differs between situs and mailing → absentee. */
function isAbsentee(address: string, mailing: string) {
  const a = normAddr(address);
  const m = normAddr(mailing);
  if (!a || !m) return false;
  return !m.startsWith(a.split(" ").slice(0, 2).join(" "));
}

export async function generateStormTargets(
  dateISO: string,
): Promise<{ date: string; events: number; targets: number; solar: number; ok: boolean }> {
  const url = process.env.SUPABASE_URL;
  if (!url || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { date: dateISO, events: 0, targets: 0, solar: 0, ok: false };
  }
  try {
    // Hail ≥1″ that day.
    const res = await fetch(
      `${url}/rest/v1/storm_events?select=lat,lon,magnitude&type=eq.hail&magnitude=gte.1&valid_at=gte.${dateISO}T00:00:00Z&valid_at=lt.${dateISO}T23:59:59Z&order=magnitude.desc&limit=200`,
      { headers: dbHeaders(), cache: "no-store" },
    );
    if (!res.ok) return { date: dateISO, events: 0, targets: 0, solar: 0, ok: false };
    const all = (await res.json()) as Array<{ lat: number; lon: number; magnitude: number }>;

    // Drop reports within 1mi of an already-kept (larger) one — one query per cell.
    const kept: typeof all = [];
    for (const e of all) {
      if (!kept.some((k) => haversineMi(k.lat, k.lon, e.lat, e.lon) < 1)) kept.push(e);
      if (kept.length >= EVENTS_PER_RUN) break;
    }

    // Parcel queries (throttled, sequential — be polite to the county servers).
    const byAddr = new Map<string, ParcelHit & { hail: number }>();
    for (const e of kept) {
      const reach = reachMi(e.magnitude);
      const [dallas, tarrant, dbCounties] = await Promise.all([
        queryDallasParcels(e.lat, e.lon, reach),
        queryTarrantParcels(e.lat, e.lon, reach),
        queryDbParcels(e.lat, e.lon, reach),
      ]);
      for (const p of [...dallas, ...tarrant, ...dbCounties]) {
        const k = normAddr(p.address);
        const prev = byAddr.get(k);
        if (!prev || e.magnitude > prev.hail) byAddr.set(k, { ...p, hail: e.magnitude });
      }
    }
    // Tarrant hits need mailing/city/zip from the loaded TAD roll.
    await enrichFromTarrantRoll([...byAddr.values()]);
    if (byAddr.size === 0) return { date: dateISO, events: kept.length, targets: 0, solar: 0, ok: true };

    // Solar match by normalized address within the affected zips.
    const zips = [...new Set([...byAddr.values()].map((p) => p.zip).filter(Boolean))];
    const solarSet = await solarAddressSet(zips);

    let solarCount = 0;
    const rows = [...byAddr.entries()].map(([norm, p]) => {
      const solar = solarSet.has(norm);
      if (solar) solarCount++;
      const absentee = isAbsentee(p.address, p.mailing);
      const score =
        p.hail * 2 +
        (solar ? 3 : 0) +
        (absentee ? 0 : 1) +
        ((p.value ?? 0) >= 300000 ? 1 : 0) +
        (p.year_built && p.year_built <= 2012 ? 0.5 : 0);
      return {
        storm_date: dateISO,
        address: p.address,
        city: p.city,
        county: p.county,
        zip: p.zip,
        lat: p.lat,
        lon: p.lon,
        owner_name: p.owner_name,
        owner_mailing: p.mailing,
        property_type: p.property_type,
        year_built: p.year_built,
        value: p.value,
        hail_size_in: p.hail,
        solar,
        solar_source: solar ? "permit" : null,
        absentee,
        score: Math.round(score * 10) / 10,
        status: "new",
      };
    });

    // Upsert in batches on (storm_date, address). merge-duplicates so re-runs
    // refresh coords/scores. NOTE for the rep-view build: rep knock statuses
    // must live in a separate table (or be excluded here) so regen never
    // clobbers them — today status is always 'new' so merge is safe.
    for (let i = 0; i < rows.length; i += 500) {
      const ins = await fetch(
        `${url}/rest/v1/storm_targets?on_conflict=storm_date,address`,
        {
          method: "POST",
          headers: { ...dbHeaders(), Prefer: "resolution=merge-duplicates,return=minimal" },
          body: JSON.stringify(rows.slice(i, i + 500)),
        },
      );
      if (!ins.ok) {
        console.error("[targets] insert non-2xx", ins.status, await ins.text());
        return { date: dateISO, events: kept.length, targets: i, solar: solarCount, ok: false };
      }
    }
    return { date: dateISO, events: kept.length, targets: rows.length, solar: solarCount, ok: true };
  } catch (err) {
    console.error("[targets] generate failed", err);
    return { date: dateISO, events: 0, targets: 0, solar: 0, ok: false };
  }
}

export type StormTargetRow = {
  id: string;
  storm_date: string;
  address: string;
  city: string;
  county: string;
  zip: string;
  owner_name: string;
  owner_mailing: string;
  property_type: string;
  year_built: number | null;
  value: number | null;
  hail_size_in: number | null;
  solar: boolean;
  absentee: boolean;
  score: number;
  status: string;
  lat: number | null;
  lon: number | null;
};

export async function listStormTargets(
  filters: { date?: string; county?: string; city?: string; days?: number } = {},
  limit = 200,
): Promise<StormTargetRow[]> {
  const url = process.env.SUPABASE_URL;
  if (!url || !process.env.SUPABASE_SERVICE_ROLE_KEY) return [];
  let q = "";
  if (filters.date) q += `&storm_date=eq.${filters.date}`;
  else if (filters.days) {
    const from = new Date(Date.now() - filters.days * 86400 * 1000).toISOString().slice(0, 10);
    q += `&storm_date=gte.${from}`;
  }
  if (filters.county) q += `&county=eq.${encodeURIComponent(filters.county)}`;
  if (filters.city) q += `&city=eq.${encodeURIComponent(filters.city)}`;
  try {
    const res = await fetch(
      `${url}/rest/v1/storm_targets?select=*${q}&order=score.desc.nullslast&limit=${limit}`,
      { headers: dbHeaders(), cache: "no-store" },
    );
    if (!res.ok) return [];
    return (await res.json()) as StormTargetRow[];
  } catch {
    return [];
  }
}

export async function listTargetCities(): Promise<
  Array<{ county: string; city: string; targets: number }>
> {
  const url = process.env.SUPABASE_URL;
  if (!url || !process.env.SUPABASE_SERVICE_ROLE_KEY) return [];
  try {
    const res = await fetch(`${url}/rest/v1/storm_target_cities?limit=60`, {
      headers: dbHeaders(),
      cache: "no-store",
    });
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

export async function listTargetDays(): Promise<
  Array<{ storm_date: string; targets: number; solar_targets: number }>
> {
  const url = process.env.SUPABASE_URL;
  if (!url || !process.env.SUPABASE_SERVICE_ROLE_KEY) return [];
  try {
    const res = await fetch(`${url}/rest/v1/storm_target_days?limit=30`, {
      headers: dbHeaders(),
      cache: "no-store",
    });
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}
