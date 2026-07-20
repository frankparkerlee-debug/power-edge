// Storm → HubSpot call tasks. When fresh 1″+ hail lands near an EXISTING
// HubSpot contact, create a HIGH-priority task ("Call X — hail hit their
// area") and stamp the contact's storm properties. Runs from the hourly cron;
// workflow-grade automation with no paid HubSpot tier.
//
// Dedupe: a contact whose storm_date already equals the event date is skipped,
// so re-runs within the same storm day are no-ops.

const API = "https://api.hubapi.com";
const NEAR_MI = 12;
const MAX_TASKS_PER_RUN = 50;

function hs() {
  return {
    Authorization: `Bearer ${process.env.HUBSPOT_ACCESS_TOKEN}`,
    "Content-Type": "application/json",
  };
}

function db() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
  return { apikey: key, Authorization: `Bearer ${key}` };
}

function haversineMi(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 3958.8;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const zipCache = new Map<string, { lat: number; lon: number } | null>();
async function zipCentroid(zip: string) {
  if (zipCache.has(zip)) return zipCache.get(zip) ?? null;
  let out: { lat: number; lon: number } | null = null;
  try {
    const res = await fetch(`https://api.zippopotam.us/us/${zip}`, {
      next: { revalidate: 2592000 },
      signal: AbortSignal.timeout(4000),
    });
    if (res.ok) {
      const p = (await res.json())?.places?.[0];
      if (p) out = { lat: parseFloat(p.latitude), lon: parseFloat(p.longitude) };
    }
  } catch {
    /* noop */
  }
  zipCache.set(zip, out);
  return out;
}

export async function runStormContactTasks(): Promise<{
  events: number;
  contacts: number;
  tasks: number;
  ok: boolean;
}> {
  const out = { events: 0, contacts: 0, tasks: 0, ok: true };
  if (
    !process.env.HUBSPOT_ACCESS_TOKEN ||
    !process.env.SUPABASE_URL ||
    !process.env.SUPABASE_SERVICE_ROLE_KEY
  ) {
    return { ...out, ok: false };
  }
  try {
    // Fresh hail (last 36h, ≥1″).
    const since = new Date(Date.now() - 36 * 3600 * 1000).toISOString();
    const eres = await fetch(
      `${process.env.SUPABASE_URL}/rest/v1/storm_events?select=valid_at,magnitude,city,lat,lon&type=eq.hail&magnitude=gte.1&valid_at=gte.${since}&order=magnitude.desc&limit=300`,
      { headers: db(), cache: "no-store" },
    );
    if (!eres.ok) return { ...out, ok: false };
    const events = (await eres.json()) as Array<{
      valid_at: string;
      magnitude: number;
      city: string;
      lat: number;
      lon: number;
    }>;
    out.events = events.length;
    if (events.length === 0) return out;

    // All contacts with a zip (small portal; paginate defensively).
    type C = {
      id: string;
      properties: Record<string, string | null>;
    };
    const contacts: C[] = [];
    let after = "";
    for (let page = 0; page < 20; page++) {
      const res = await fetch(
        `${API}/crm/v3/objects/contacts?limit=100&properties=firstname,lastname,phone,zip,address,city,storm_date,lead_type${after ? `&after=${after}` : ""}`,
        { headers: hs(), cache: "no-store", signal: AbortSignal.timeout(10000) },
      );
      if (!res.ok) break;
      const data = await res.json();
      contacts.push(...((data?.results ?? []) as C[]));
      after = data?.paging?.next?.after || "";
      if (!after) break;
    }
    out.contacts = contacts.length;

    for (const c of contacts) {
      if (out.tasks >= MAX_TASKS_PER_RUN) break;
      const p = c.properties;
      const zip = (p.zip || "").slice(0, 5);
      if (!/^\d{5}$/.test(zip)) continue;
      if (p.lead_type === "rep_applicant") continue;
      const loc = await zipCentroid(zip);
      if (!loc) continue;

      let hit: (typeof events)[number] | null = null;
      for (const e of events) {
        if (haversineMi(loc.lat, loc.lon, e.lat, e.lon) <= NEAR_MI) {
          if (!hit || e.magnitude > hit.magnitude) hit = e;
        }
      }
      if (!hit) continue;
      const stormDate = hit.valid_at.slice(0, 10);
      if (p.storm_date === stormDate) continue; // already handled this storm

      const name = `${p.firstname || ""} ${p.lastname || ""}`.trim() || "contact";
      const mapLink = `https://poweredgetx.com/admin/storms?targets=${stormDate}`;
      const task = await fetch(`${API}/crm/v3/objects/tasks`, {
        method: "POST",
        headers: hs(),
        signal: AbortSignal.timeout(10000),
        body: JSON.stringify({
          properties: {
            hs_task_subject: `⛈️ Storm follow-up: ${hit.magnitude}″ hail near ${name}`,
            hs_task_body:
              `${hit.magnitude}″ hail reported near ${hit.city} on ${stormDate}, ` +
              `~${NEAR_MI}mi or less from ${name}'s zip (${zip}). ` +
              `They already know us — call before the door-knockers get there.` +
              `${p.phone ? ` Phone: ${p.phone}.` : ""} Map: ${mapLink}`,
            hs_task_status: "NOT_STARTED",
            hs_task_priority: "HIGH",
            hs_task_type: "CALL",
            hs_timestamp: new Date(Date.now() + 3600 * 1000).toISOString(),
          },
          associations: [
            {
              to: { id: c.id },
              types: [{ associationCategory: "HUBSPOT_DEFINED", associationTypeId: 204 }],
            },
          ],
        }),
      });
      if (!task.ok) {
        console.error("[hubspot] task create non-2xx", task.status, await task.text());
        continue;
      }
      out.tasks++;

      await fetch(`${API}/crm/v3/objects/contacts/${c.id}`, {
        method: "PATCH",
        headers: hs(),
        signal: AbortSignal.timeout(10000),
        body: JSON.stringify({
          properties: {
            storm_date: stormDate,
            hail_size_in: String(hit.magnitude),
            storm_map_link: mapLink,
          },
        }),
      }).catch(() => {});
    }
    return out;
  } catch (err) {
    console.error("[hubspot] storm tasks failed", err);
    return { ...out, ok: false };
  }
}
