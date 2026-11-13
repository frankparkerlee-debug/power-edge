/**
 * Held inspections: the knocker's $50, tightly qualified.
 *
 * The signed contractor agreement (version 2026-11-12) pays a knocker $50 for
 * each inspection they booked that is held, and defines held as all three:
 *
 *   1. the homeowner was there (the closer answers this when recording it),
 *   2. the closer completed the inspection with photos in the PowerEdge app,
 *   3. it was the first inspection PowerEdge ran at that address.
 *
 * Everything that shows a knocker their $50s, and the office's pay list,
 * reads this one function so the rule can't drift between screens.
 */

const PHOTO_BUCKET = "job-photos";

function h() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
  return { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
}
function on() {
  return !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

/** One address, however it was typed: "123 Oak St." and "123 oak st" match. */
export function addressKey(a: string | null | undefined) {
  return String(a || "")
    .toLowerCase()
    .replace(/,?\s*(tx|texas)\b.*$/, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\b(street|st)\b/g, "st")
    .replace(/\b(avenue|ave)\b/g, "ave")
    .replace(/\b(drive|dr)\b/g, "dr")
    .replace(/\b(lane|ln)\b/g, "ln")
    .replace(/\b(road|rd)\b/g, "rd")
    .replace(/\b(court|ct)\b/g, "ct")
    .replace(/\b(circle|cir)\b/g, "cir")
    .replace(/\b(boulevard|blvd)\b/g, "blvd")
    .replace(/\s+/g, " ")
    .trim();
}

export type HeldRow = {
  id: string;
  slot_start: string;
  name: string | null;
  address: string | null;
  setter: string | null;
  closer: string | null;
  status: string;
  job_id: string | null;
  homeowner_present: boolean | null;
  photos: number;
  /** true = $50 earned; false = not; null = waiting on the closer */
  held: boolean | null;
  why: string;
};

/** The rule, on one inspection. Exported so it can be tested on its own. */
export function judge(r: {
  status: string;
  homeowner_present: boolean | null;
  photos: number;
  firstAtAddress: boolean;
}): { held: boolean | null; why: string } {
  if (r.status === "no_show") return { held: false, why: "Didn't happen: nobody home or postponed" };
  if (r.status !== "completed") return { held: null, why: "Not inspected yet" };
  if (r.homeowner_present === null) return { held: null, why: "Waiting on the closer to say if the homeowner was there" };
  if (r.homeowner_present === false) return { held: false, why: "The homeowner wasn't there" };
  if (r.photos < 1) return { held: null, why: "Waiting on the closer's inspection photos" };
  if (!r.firstAtAddress) return { held: false, why: "PowerEdge already inspected this address" };
  return { held: true, why: "Held: homeowner there, photos in, first inspection here" };
}

/**
 * Past inspections with their held status, newest first.
 * setter: only that knocker's bookings. days: how far back.
 */
export async function heldInspections(opts: { setter?: string; days?: number } = {}): Promise<HeldRow[]> {
  if (!on()) return [];
  const since = new Date(Date.now() - (opts.days ?? 60) * 86400000).toISOString();
  const who = opts.setter ? `&setter=eq.${encodeURIComponent(opts.setter)}` : "";
  try {
    const res = await fetch(
      `${process.env.SUPABASE_URL}/rest/v1/appointments?select=id,slot_start,name,address,setter,closer,status,job_id,homeowner_present&status=in.(completed,no_show)&slot_start=gte.${since}${who}&order=slot_start.desc&limit=500`,
      { headers: h(), cache: "no-store" },
    );
    if (!res.ok) return [];
    const rows = (await res.json()) as Omit<HeldRow, "photos" | "held" | "why">[];
    if (!rows.length) return [];

    // Photos per job.
    const jobs = [...new Set(rows.map((r) => r.job_id).filter(Boolean))] as string[];
    const photos = new Map<string, number>();
    if (jobs.length) {
      const pr = await fetch(
        `${process.env.SUPABASE_URL}/rest/v1/job_photos?select=job_id&job_id=in.(${jobs.join(",")})`,
        { headers: h(), cache: "no-store" },
      );
      if (pr.ok) {
        for (const p of (await pr.json()) as { job_id: string }[]) {
          photos.set(p.job_id, (photos.get(p.job_id) ?? 0) + 1);
        }
      }
    }

    // The first inspection PowerEdge ran at each address, across all time:
    // the earliest completed one with the homeowner there.
    const first = new Map<string, string>();
    const fr = await fetch(
      `${process.env.SUPABASE_URL}/rest/v1/appointments?select=id,address,slot_start&status=eq.completed&homeowner_present=is.true&order=slot_start.asc&limit=5000`,
      { headers: h(), cache: "no-store" },
    );
    if (fr.ok) {
      for (const a of (await fr.json()) as { id: string; address: string }[]) {
        const k = addressKey(a.address);
        if (k && !first.has(k)) first.set(k, a.id);
      }
    }

    return rows.map((r) => {
      const n = r.job_id ? (photos.get(r.job_id) ?? 0) : 0;
      const k = addressKey(r.address);
      const v = judge({
        status: r.status,
        homeowner_present: r.homeowner_present,
        photos: n,
        firstAtAddress: !k || !first.has(k) || first.get(k) === r.id,
      });
      return { ...r, photos: n, ...v };
    });
  } catch {
    return [];
  }
}

/** Monday 00:00 Central of the week containing `d`, as an ISO string. */
export function payWeekStart(d = new Date()) {
  const ct = new Date(d.toLocaleString("en-US", { timeZone: "America/Chicago" }));
  const dow = (ct.getDay() + 6) % 7; // Monday = 0
  ct.setHours(0, 0, 0, 0);
  ct.setDate(ct.getDate() - dow);
  const offset = d.getTime() - new Date(d.toLocaleString("en-US", { timeZone: "America/Chicago" })).getTime();
  return new Date(ct.getTime() + offset).toISOString();
}

/* ---------- inspection photos (private bucket job-photos) ---------- */

export type JobPhoto = { id: string; created_at: string; by: string | null; path: string; bytes: number | null };

export async function listJobPhotos(jobId: string): Promise<JobPhoto[]> {
  if (!on() || !/^[0-9a-f-]{36}$/i.test(jobId)) return [];
  try {
    const res = await fetch(
      `${process.env.SUPABASE_URL}/rest/v1/job_photos?select=id,created_at,by,path,bytes&job_id=eq.${jobId}&order=created_at.asc`,
      { headers: h(), cache: "no-store" },
    );
    return res.ok ? ((await res.json()) as JobPhoto[]) : [];
  } catch {
    return [];
  }
}

export async function saveJobPhoto(jobId: string, jpeg: Uint8Array, by: string) {
  if (!on()) return { ok: false as const, error: "Storage is not configured." };
  const id = crypto.randomUUID();
  const path = `${jobId}/${id}.jpg`;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
  const up = await fetch(`${process.env.SUPABASE_URL}/storage/v1/object/${PHOTO_BUCKET}/${path}`, {
    method: "POST",
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "image/jpeg", "x-upsert": "false" },
    body: jpeg as unknown as BodyInit,
  });
  if (!up.ok) return { ok: false as const, error: "The photo didn't upload. Try again." };
  const row = await fetch(`${process.env.SUPABASE_URL}/rest/v1/job_photos`, {
    method: "POST",
    headers: { ...h(), Prefer: "return=representation" },
    body: JSON.stringify({ id, job_id: jobId, by, path, bytes: jpeg.byteLength }),
  });
  if (!row.ok) return { ok: false as const, error: "The photo uploaded but didn't save. Try again." };
  return { ok: true as const, id };
}

export async function readJobPhoto(path: string) {
  if (!on()) return null;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
  const res = await fetch(`${process.env.SUPABASE_URL}/storage/v1/object/${PHOTO_BUCKET}/${path}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
    cache: "no-store",
  });
  return res.ok ? new Uint8Array(await res.arrayBuffer()) : null;
}
