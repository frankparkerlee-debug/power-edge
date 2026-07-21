import { NextResponse } from "next/server";

/**
 * Convert a storm target into a real lead: HubSpot contact + deal in the
 * Storm Restoration pipeline, and the target marked 'converted'.
 *   POST /api/admin/promote  { key: <ADMIN_TOKEN>, id: <storm_targets.id> }
 * Idempotent: re-promoting an already-converted target returns the existing ids.
 */

const HS = "https://api.hubapi.com";
const PIPELINE_ID = "2436476647";
const STAGE_NEW_LEAD = "4022610639";

function db() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  };
}

function hs() {
  return {
    Authorization: `Bearer ${process.env.HUBSPOT_ACCESS_TOKEN}`,
    "Content-Type": "application/json",
  };
}

export async function POST(req: Request) {
  let body: { key?: string; id?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  if (!process.env.ADMIN_TOKEN || body.key !== process.env.ADMIN_TOKEN) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!process.env.HUBSPOT_ACCESS_TOKEN) {
    return NextResponse.json({ error: "HubSpot not configured" }, { status: 500 });
  }
  const id = (body.id || "").trim();
  if (!/^[0-9a-f-]{36}$/.test(id)) {
    return NextResponse.json({ error: "Bad target id" }, { status: 400 });
  }

  // Load the target.
  const tres = await fetch(
    `${process.env.SUPABASE_URL}/rest/v1/storm_targets?id=eq.${id}&select=*&limit=1`,
    { headers: db(), cache: "no-store" },
  );
  const target = ((await tres.json()) as Array<Record<string, unknown>>)[0];
  if (!target) return NextResponse.json({ error: "Target not found" }, { status: 404 });
  if (target.status === "converted" && target.hubspot_id) {
    return NextResponse.json({ ok: true, already: true, contactId: target.hubspot_id });
  }

  const ownerName = String(target.owner_name || "").trim();
  // CAD names are usually "LAST FIRST MIDDLE" — best-effort split for HubSpot.
  const parts = ownerName.replace(/[&,].*$/, "").trim().split(/\s+/);
  const lastname = parts[0] || ownerName;
  const firstname = parts.slice(1).join(" ") || "";
  const address = String(target.address || "");
  const city = String(target.city || "");
  const zip = String(target.zip || "");
  const stormDate = String(target.storm_date || "");
  const mapLink = `https://poweredgetx.com/admin/storms?targets=${stormDate}`;

  try {
    // 1. Contact.
    const cres = await fetch(`${HS}/crm/v3/objects/contacts`, {
      method: "POST",
      headers: hs(),
      body: JSON.stringify({
        properties: {
          firstname,
          lastname,
          address,
          city,
          zip,
          phone: String(target.phone || ""),
          lifecyclestage: "lead",
          hs_lead_status: "IN_PROGRESS",
          lead_type: "homeowner",
          storm_date: stormDate,
          hail_size_in: String(target.hail_size_in ?? ""),
          storm_map_link: mapLink,
          ...(target.solar ? { solar_home: "true" } : {}),
        },
      }),
      signal: AbortSignal.timeout(15000),
    });
    if (!cres.ok) {
      return NextResponse.json(
        { error: `HubSpot contact failed (${cres.status})` },
        { status: 502 },
      );
    }
    const contactId = (await cres.json()).id as string;

    // 2. Deal in Storm Restoration pipeline, associated to the contact.
    const dres = await fetch(`${HS}/crm/v3/objects/deals`, {
      method: "POST",
      headers: hs(),
      body: JSON.stringify({
        properties: {
          dealname: `Roof — ${address}${city ? `, ${city}` : ""}`,
          pipeline: PIPELINE_ID,
          dealstage: STAGE_NEW_LEAD,
        },
        associations: [
          {
            to: { id: contactId },
            types: [{ associationCategory: "HUBSPOT_DEFINED", associationTypeId: 3 }],
          },
        ],
      }),
      signal: AbortSignal.timeout(15000),
    });
    const dealId = dres.ok ? ((await dres.json()).id as string) : null;

    // 3. Note with full door context.
    await fetch(`${HS}/crm/v3/objects/notes`, {
      method: "POST",
      headers: hs(),
      body: JSON.stringify({
        properties: {
          hs_note_body:
            `Converted from the storm tool at the door.\n` +
            `${target.hail_size_in ? `${target.hail_size_in}″ hail documented (${stormDate}). ` : ""}` +
            `${target.solar ? "☀️ SOLAR HOME — detach & reset applies. " : ""}` +
            `${target.absentee ? "Absentee owner — mail: " + target.owner_mailing + ". " : "Owner-occupied. "}` +
            `Assessed value ${target.value ? `$${Math.round(Number(target.value) / 1000)}k` : "n/a"}, ` +
            `built ${target.year_built ?? "n/a"}. Map: ${mapLink}`,
          hs_timestamp: new Date().toISOString(),
        },
        associations: [
          {
            to: { id: contactId },
            types: [{ associationCategory: "HUBSPOT_DEFINED", associationTypeId: 202 }],
          },
        ],
      }),
      signal: AbortSignal.timeout(15000),
    }).catch(() => {});

    // 4. Mark the target converted.
    await fetch(`${process.env.SUPABASE_URL}/rest/v1/storm_targets?id=eq.${id}`, {
      method: "PATCH",
      headers: { ...db(), Prefer: "return=minimal" },
      body: JSON.stringify({ status: "converted", hubspot_id: contactId }),
    });

    return NextResponse.json({ ok: true, contactId, dealId });
  } catch (err) {
    console.error("[promote] failed", err);
    return NextResponse.json({ error: "Promotion failed" }, { status: 500 });
  }
}
