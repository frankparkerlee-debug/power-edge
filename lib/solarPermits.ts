// Solar permit inventory — every rooftop solar install pulled a permit, and
// permit records are public. Addresses with confirmed panels are PowerEdge's
// highest-value storm targets (detach & reset supplement + TECL license means
// we can do the work most roofers legally can't).
//
// Sources (metroplex coverage, one connector per portal type):
//   • Dallas — Socrata open data, dataset e7gq-4sah "Building Permits"
//   • Fort Worth — ArcGIS FeatureServer "CFW Development Permits" (~19k solar
//     rows, includes OWNER names)
// Remaining suburbs (Plano publishes restricted/empty data; Arlington/McKinney/
// Denton publish nothing machine-readable) get covered by the Phase 1b county
// CAD ingest — CAD improvement records span every parcel in Tarrant/Dallas/
// Collin/Denton counties regardless of city — plus rep flags from the field.

const DATASET = "https://www.dallasopendata.com/resource/e7gq-4sah.json";
const FW_QUERY =
  "https://services5.arcgis.com/3ddLCBXe1bRt7mzj/arcgis/rest/services/CFW_Open_Data_Development_Permits_View/FeatureServer/0/query";
const PAGE = 1000;
const MAX_PAGES_PER_RUN = 5; // 5k rows per source per run; the daily cron catches up

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

/** How many permits we already hold for a source (drives stable offset
 *  pagination — both sources are ordered by an append-stable key). */
async function storedCount(source?: string): Promise<number> {
  const filter = source ? `&source=eq.${source}` : "";
  const res = await fetch(
    `${process.env.SUPABASE_URL}/rest/v1/solar_permits?select=id&limit=1${filter}`,
    { method: "HEAD", headers: { ...dbHeaders(), Prefer: "count=exact" }, cache: "no-store" },
  );
  const range = res.headers.get("content-range") || "";
  const total = parseInt(range.split("/")[1] || "0", 10);
  return Number.isFinite(total) ? total : 0;
}

type PermitInsert = {
  permit_number: string;
  source: string;
  address: string;
  zip: string;
  city: string;
  issued_date: string;
  contractor: string;
  owner?: string;
  land_use: string;
  description: string;
};

async function upsertPermits(payload: PermitInsert[]): Promise<boolean> {
  const res = await fetch(
    `${process.env.SUPABASE_URL}/rest/v1/solar_permits?on_conflict=permit_number`,
    {
      method: "POST",
      headers: { ...dbHeaders(), Prefer: "resolution=ignore-duplicates,return=minimal" },
      body: JSON.stringify(payload),
    },
  );
  if (!res.ok) console.error("[solar] upsert non-2xx", res.status, await res.text());
  return res.ok;
}

/** Sync all sources. Best-effort, idempotent. Run daily (or force via
 *  /api/cron/storm-watch?solar=1). */
export async function runSolarPermitSync(): Promise<{ fetched: number; ok: boolean }> {
  const [dallas, fw] = await Promise.all([runDallasSync(), runFortWorthSync()]);
  return { fetched: dallas.fetched + fw.fetched, ok: dallas.ok && fw.ok };
}

/** Dallas (Socrata). Ordered by permit_number ASC — date-prefixed, append-stable. */
async function runDallasSync(): Promise<{ fetched: number; ok: boolean }> {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { fetched: 0, ok: false };
  }
  try {
    let offset = await storedCount("dallas");
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

      const payload: PermitInsert[] = rows
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

      if (!(await upsertPermits(payload))) break;
      fetched += rows.length;
      offset += rows.length;
      if (rows.length < PAGE) break; // caught up
    }
    return { fetched, ok: true };
  } catch (err) {
    console.error("[solar] dallas sync failed", err);
    return { fetched: 0, ok: false };
  }
}

type FWFeature = {
  attributes: {
    Permit_No?: string;
    Full_Street_Address?: string;
    Zip_Code?: number | string;
    Owner_Full_Name?: string;
    File_Date?: number;         // epoch ms
    B1_WORK_DESC?: string;
    Use_Type?: string;
    ObjectId?: number;
  };
};

/** Fort Worth (ArcGIS FeatureServer). Ordered by ObjectId ASC — append-stable.
 *  ~19k solar rows and, unlike Dallas, includes the OWNER's name. */
async function runFortWorthSync(): Promise<{ fetched: number; ok: boolean }> {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { fetched: 0, ok: false };
  }
  try {
    let offset = await storedCount("fortworth");
    let fetched = 0;
    for (let page = 0; page < MAX_PAGES_PER_RUN; page++) {
      const params = new URLSearchParams({
        where: "UPPER(B1_WORK_DESC) LIKE '%SOLAR%'",
        outFields:
          "Permit_No,Full_Street_Address,Zip_Code,Owner_Full_Name,File_Date,B1_WORK_DESC,Use_Type,ObjectId",
        orderByFields: "ObjectId ASC",
        resultOffset: String(offset),
        resultRecordCount: String(PAGE),
        f: "json",
      });
      const res = await fetch(`${FW_QUERY}?${params}`, {
        signal: AbortSignal.timeout(25000),
        cache: "no-store",
      });
      if (!res.ok) {
        console.error("[solar] fw non-2xx", res.status);
        break;
      }
      const data = await res.json();
      const feats = (data?.features ?? []) as FWFeature[];
      if (feats.length === 0) break;

      const payload: PermitInsert[] = feats
        .filter((f) => f.attributes.ObjectId != null)
        .map((f) => {
          const a = f.attributes;
          return {
            // Keyed by ObjectId (the dataset's unique row id) so count-based
            // offset pagination stays 1:1 even if a permit number repeats.
            permit_number: `fortworth-${a.ObjectId}`,
            source: "fortworth",
            address: (a.Full_Street_Address || "").trim(),
            zip: a.Zip_Code != null ? String(a.Zip_Code) : "",
            city: "Fort Worth",
            issued_date: a.File_Date ? new Date(a.File_Date).toISOString().slice(0, 10) : "",
            contractor: "",
            owner: (a.Owner_Full_Name || "").trim().slice(0, 200),
            land_use: (a.Use_Type || "").trim(),
            description: (a.B1_WORK_DESC || "").slice(0, 300),
          };
        });

      if (!(await upsertPermits(payload))) break;
      fetched += feats.length;
      offset += feats.length;
      if (feats.length < PAGE) break; // caught up
    }
    return { fetched, ok: true };
  } catch (err) {
    console.error("[solar] fw sync failed", err);
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
