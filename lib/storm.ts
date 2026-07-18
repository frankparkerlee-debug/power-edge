// Storm engine — ingest NWS/IEM Local Storm Reports (hail + damaging wind)
// within 100mi of DFW into Supabase `storm_events`. This is the trigger layer
// for the post-storm lead engine: watch → (Phase 1b) parcel intersect → score
// → knock map / dial list / HubSpot.
//
// Data: Iowa Environmental Mesonet LSR geojson (free, no key). A 100mi circle
// around DFW spills past the FWD forecast office into OUN (SE OK) and SHV
// (E TX), so we query all three and distance-filter.

const DFW = { lat: 32.9, lon: -97.04 };
const RADIUS_MI = 100;
const WFOS = "FWD,OUN,SHV";

export function haversineMi(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 3958.8;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export type StormEvent = {
  valid_at: string;
  type: "hail" | "wind_gust" | "wind_dmg";
  magnitude: number | null;
  city: string;
  county: string;
  lat: number;
  lon: number;
  wfo: string;
  remark: string;
};

function cleanCity(raw: string) {
  return raw
    .replace(/^\s*\d+\s+[NSEW]{1,4}\s+/i, "")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

/** Fetch hail + wind LSRs in the window, distance-filtered to 100mi of DFW. */
export async function fetchStormReports(days: number): Promise<StormEvent[]> {
  const now = new Date();
  const start = new Date(now.getTime() - days * 86400 * 1000);
  const sts = start.toISOString().slice(0, 10);
  const ets = now.toISOString().slice(0, 10);
  const url = `https://mesonet.agron.iastate.edu/geojson/lsr.geojson?sts=${sts}T00:00Z&ets=${ets}T23:59Z&wfos=${WFOS}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(15000), cache: "no-store" });
  if (!res.ok) throw new Error(`IEM LSR fetch failed: ${res.status}`);
  const data = await res.json();
  const feats = (data?.features ?? []) as Array<{
    properties: {
      typetext?: string;
      magf?: number | null;
      city?: string;
      county?: string;
      wfo?: string;
      valid?: string;
      remark?: string;
    };
    geometry?: { coordinates?: [number, number] };
  }>;

  const out: StormEvent[] = [];
  for (const f of feats) {
    const p = f.properties;
    const coords = f.geometry?.coordinates;
    if (!coords || !p.valid) continue;
    const [lon, lat] = coords;
    if (haversineMi(DFW.lat, DFW.lon, lat, lon) > RADIUS_MI) continue;

    const tt = (p.typetext || "").toUpperCase();
    let type: StormEvent["type"] | null = null;
    if (tt === "HAIL") type = "hail";
    else if (tt === "TSTM WND GST" || tt === "NON-TSTM WND GST") type = "wind_gust";
    else if (tt === "TSTM WND DMG") type = "wind_dmg";
    if (!type) continue;
    // Skip sub-severe gusts (roof-relevant threshold ≈ 55mph). Hail: keep all
    // sizes — even 0.75" matters for soft-metal + shingle-granule claims.
    if (type === "wind_gust" && (p.magf ?? 0) < 55) continue;

    out.push({
      valid_at: p.valid,
      type,
      magnitude: p.magf ?? null,
      city: cleanCity(p.city || ""),
      county: p.county || "",
      lat,
      lon,
      wfo: p.wfo || "",
      remark: (p.remark || "").slice(0, 500),
    });
  }
  return out;
}

/** Ingest recent reports into storm_events (dedupes on valid_at/type/lat/lon).
 *  Best-effort; safe to run every hour. Returns how many reports it saw. */
export async function runStormWatch(days = 3): Promise<{ seen: number; ok: boolean }> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return { seen: 0, ok: false };
  try {
    const events = await fetchStormReports(days);
    if (events.length === 0) return { seen: 0, ok: true };
    const res = await fetch(`${url}/rest/v1/storm_events?on_conflict=valid_at,type,lat,lon`, {
      method: "POST",
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        Prefer: "resolution=ignore-duplicates,return=minimal",
      },
      body: JSON.stringify(events),
    });
    if (!res.ok) {
      console.error("[storm] upsert non-2xx", res.status, await res.text());
      return { seen: events.length, ok: false };
    }
    return { seen: events.length, ok: true };
  } catch (err) {
    console.error("[storm] watch failed", err);
    return { seen: 0, ok: false };
  }
}

export type StormEventRow = StormEvent & { id: string };

/** Recent events for the admin view. */
export async function listStormEvents(days = 90): Promise<StormEventRow[]> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return [];
  const since = new Date(Date.now() - days * 86400 * 1000).toISOString();
  try {
    const res = await fetch(
      `${url}/rest/v1/storm_events?select=*&valid_at=gte.${since}&order=valid_at.desc&limit=2000`,
      { headers: { apikey: key, Authorization: `Bearer ${key}` }, cache: "no-store" },
    );
    if (!res.ok) return [];
    return (await res.json()) as StormEventRow[];
  } catch {
    return [];
  }
}
