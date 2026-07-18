// Solar permit inventory — every rooftop solar install pulled a permit, and
// permit records are public. Addresses with confirmed panels are PowerEdge's
// highest-value storm targets (detach & reset supplement + TECL license means
// we can do the work most roofers legally can't).
//
// Source (Phase 1): City of Dallas open data (Socrata), dataset e7gq-4sah
// "Building Permits" — free JSON API, no key required (throttled without one).
// Other DFW cities (Fort Worth, Plano, Arlington, ...) come in Phase 1b via
// their own portals.

const DATASET = "https://www.dallasopendata.com/resource/e7gq-4sah.json";
const PAGE = 1000;
const MAX_PAGES_PER_RUN = 5; // 5k rows per run; the daily cron catches up over days

type DallasPermit = {
  permit_number?: string;
  permit_type?: string;
  issued_date?: string;
  contractor?: string;
  work_description?: string;
  land_use?: string;
  street_address?: string;
  zip_code?: string;
};

function dbHeaders() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  };
}

/** How many Dallas permits we already hold (drives stable offset pagination —
 *  permit numbers are date-prefixed, so ordering by them is append-stable). */
async function storedCount(): Promise<number> {
  const res = await fetch(
    `${process.env.SUPABASE_URL}/rest/v1/solar_permits?select=id&source=eq.dallas&limit=1`,
    { method: "HEAD", headers: { ...dbHeaders(), Prefer: "count=exact" }, cache: "no-store" },
  );
  const range = res.headers.get("content-range") || "";
  const total = parseInt(range.split("/")[1] || "0", 10);
  return Number.isFinite(total) ? total : 0;
}

/** Pull the next pages of Dallas solar permits into solar_permits. Best-effort,
 *  idempotent (unique permit_number, ignore-duplicates). Run daily. */
export async function runSolarPermitSync(): Promise<{ fetched: number; ok: boolean }> {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { fetched: 0, ok: false };
  }
  try {
    let offset = await storedCount();
    let fetched = 0;
    for (let page = 0; page < MAX_PAGES_PER_RUN; page++) {
      const q =
        `${DATASET}?$where=upper(work_description) like '%25SOLAR%25'` +
        `&$order=permit_number ASC&$limit=${PAGE}&$offset=${offset}`;
      const res = await fetch(q.replace(/ /g, "%20"), {
        signal: AbortSignal.timeout(20000),
        cache: "no-store",
      });
      if (!res.ok) {
        console.error("[solar] socrata non-2xx", res.status);
        break;
      }
      const rows = (await res.json()) as DallasPermit[];
      if (rows.length === 0) break;

      const payload = rows
        .filter((r) => r.permit_number)
        .map((r) => ({
          permit_number: `dallas-${r.permit_number}`,
          source: "dallas",
          address: (r.street_address || "").trim(),
          zip: (r.zip_code || "").trim(),
          city: "Dallas",
          issued_date: (r.issued_date || "").trim(),
          contractor: (r.contractor || "").slice(0, 300),
          land_use: (r.land_use || "").trim(),
          description: (r.work_description || "").slice(0, 300),
        }));

      const ins = await fetch(
        `${process.env.SUPABASE_URL}/rest/v1/solar_permits?on_conflict=permit_number`,
        {
          method: "POST",
          headers: { ...dbHeaders(), Prefer: "resolution=ignore-duplicates,return=minimal" },
          body: JSON.stringify(payload),
        },
      );
      if (!ins.ok) {
        console.error("[solar] upsert non-2xx", ins.status, await ins.text());
        break;
      }
      fetched += rows.length;
      offset += rows.length;
      if (rows.length < PAGE) break; // caught up
    }
    return { fetched, ok: true };
  } catch (err) {
    console.error("[solar] sync failed", err);
    return { fetched: 0, ok: false };
  }
}

export type SolarZipCount = { zip: string; permits: number };

export async function solarPermitStats(): Promise<{
  total: number;
  topZips: SolarZipCount[];
}> {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { total: 0, topZips: [] };
  }
  try {
    const [total, zipRes] = await Promise.all([
      storedCount(),
      fetch(`${process.env.SUPABASE_URL}/rest/v1/solar_permit_zip_counts?limit=12`, {
        headers: dbHeaders(),
        cache: "no-store",
      }),
    ]);
    const topZips = zipRes.ok ? ((await zipRes.json()) as SolarZipCount[]) : [];
    return { total, topZips };
  } catch {
    return { total: 0, topZips: [] };
  }
}
