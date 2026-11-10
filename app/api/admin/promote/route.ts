import { NextResponse } from "next/server";
import { apiUser } from "@/lib/auth";
import { listJobs, createJob, logEvent } from "@/lib/jobs";

/**
 * Convert a storm target into a job.
 *
 * This used to create a HubSpot contact plus a deal in the Storm Restoration
 * pipeline. Parker decided on 2026-11-10 to run without HubSpot, so a
 * converted door now becomes a job, which is the system of record. Everything
 * the HubSpot note carried (hail size, storm date, property details) goes on
 * the job and its timeline instead.
 *
 *   POST /api/admin/promote  { id: <storm_targets.id> }
 *
 * Idempotent: converting a door that is already a job returns that job rather
 * than creating a second one, because a rep tapping twice on bad signal should
 * not split one house across two records.
 */

function db() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  };
}

export async function POST(req: Request) {
  const u = await apiUser(req);
  if (!u) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { id?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const id = (body.id || "").trim();
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ error: "Bad target id" }, { status: 400 });
  }
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Database not configured" }, { status: 500 });
  }

  // Load the door.
  const tres = await fetch(
    `${process.env.SUPABASE_URL}/rest/v1/storm_targets?id=eq.${id}&select=*&limit=1`,
    { headers: db(), cache: "no-store" },
  );
  const target = ((await tres.json()) as Array<Record<string, unknown>>)[0];
  if (!target) {
    return NextResponse.json({ error: "Target not found" }, { status: 404 });
  }

  const address = String(target.address || "").trim();
  if (!address) {
    return NextResponse.json({ error: "Target has no address" }, { status: 422 });
  }

  // Already a job? Hand back the same one.
  const existing = (await listJobs({ limit: 500 })).find(
    (j) =>
      j.storm_target_id === id ||
      j.address.trim().toLowerCase() === address.toLowerCase(),
  );
  if (existing) {
    return NextResponse.json({ ok: true, already: true, jobId: existing.id });
  }

  const hail = target.hail_size_in ? `${target.hail_size_in}" hail` : null;
  const stormDate = target.storm_date ? String(target.storm_date) : null;

  const job = await createJob(
    {
      address,
      owner_name: target.owner_name ? String(target.owner_name) : null,
      phone: target.phone ? String(target.phone) : null,
      city: target.city ? String(target.city) : null,
      zip: target.zip ? String(target.zip) : null,
      lat: typeof target.lat === "number" ? target.lat : null,
      lon: typeof target.lon === "number" ? target.lon : null,
      stage: "contacted",
      job_type: "claim",
      storm_target_id: id,
      rep: u.name || null,
      notes: [hail, stormDate ? `storm ${stormDate}` : null,
              target.year_built ? `built ${target.year_built}` : null]
        .filter(Boolean)
        .join(" · ") || null,
    },
    u.name,
  );

  if (!job) {
    return NextResponse.json({ error: "Could not create the job" }, { status: 502 });
  }

  await logEvent(
    job.id,
    "knock",
    `Converted from the knock map${hail ? `, ${hail}` : ""}${stormDate ? ` on ${stormDate}` : ""}`,
    u.name,
  );

  // Mark the door so the map shows it worked and a regen cannot un-convert it.
  try {
    await fetch(`${process.env.SUPABASE_URL}/rest/v1/storm_targets?id=eq.${id}`, {
      method: "PATCH",
      headers: { ...db(), Prefer: "return=minimal" },
      body: JSON.stringify({ status: "converted" }),
    });
  } catch {
    /* the job exists, which is the part that matters */
  }

  return NextResponse.json({ ok: true, jobId: job.id });
}
