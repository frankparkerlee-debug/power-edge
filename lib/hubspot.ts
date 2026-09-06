// HubSpot CRM pipe — every lead (and later, storm-engine target) flows into
// HubSpot as a contact + a timeline note with the full context. Env-gated:
//   HUBSPOT_ACCESS_TOKEN   private-app token (Settings → Integrations →
//                          Private Apps; scopes: crm.objects.contacts.read/write)
// Uses only standard contact properties, so it works on a fresh free portal
// with zero configuration. Best-effort — never throws, never blocks a lead.

const API = "https://api.hubapi.com";

export function hubspotEnabled() {
  return !!process.env.HUBSPOT_ACCESS_TOKEN;
}

function headers() {
  return {
    Authorization: `Bearer ${process.env.HUBSPOT_ACCESS_TOKEN}`,
    "Content-Type": "application/json",
  };
}

export type HubspotLead = {
  name?: string;
  phone?: string;
  email?: string;
  address?: string;
  zip?: string;
  service?: string;
  message?: string;
  solar?: boolean;
  source?: string;
};

/** Hail history near a zip (last 12mo): latest 1″+ date + max size. */
export async function stormContextForZip(
  zip: string,
): Promise<{ storm_date: string; hail_size_in: number } | null> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key || !/^\d{5}$/.test(zip)) return null;
  try {
    const zres = await fetch(`https://api.zippopotam.us/us/${zip}`, {
      next: { revalidate: 2592000 },
      signal: AbortSignal.timeout(4000),
    });
    if (!zres.ok) return null;
    const place = (await zres.json())?.places?.[0];
    if (!place) return null;
    const lat = parseFloat(place.latitude);
    const lon = parseFloat(place.longitude);

    const since = new Date(Date.now() - 365 * 86400 * 1000).toISOString();
    const eres = await fetch(
      `${url}/rest/v1/storm_events?select=valid_at,magnitude,lat,lon&type=eq.hail&magnitude=gte.1&valid_at=gte.${since}&limit=2000`,
      {
        headers: { apikey: key, Authorization: `Bearer ${key}` },
        cache: "no-store",
        signal: AbortSignal.timeout(8000),
      },
    );
    if (!eres.ok) return null;
    const events = (await eres.json()) as Array<{
      valid_at: string;
      magnitude: number;
      lat: number;
      lon: number;
    }>;
    const R = 3958.8;
    const toRad = (d: number) => (d * Math.PI) / 180;
    let latest = "";
    let maxSize = 0;
    for (const e of events) {
      const dLat = toRad(e.lat - lat);
      const dLon = toRad(e.lon - lon);
      const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat)) * Math.cos(toRad(e.lat)) * Math.sin(dLon / 2) ** 2;
      const mi = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      if (mi > 15) continue;
      if (e.magnitude > maxSize) maxSize = e.magnitude;
      const d = e.valid_at.slice(0, 10);
      if (d > latest) latest = d;
    }
    return latest ? { storm_date: latest, hail_size_in: maxSize } : null;
  } catch {
    return null;
  }
}

async function findContact(email: string, phone: string): Promise<string | null> {
  const filters = [];
  if (email) filters.push({ propertyName: "email", operator: "EQ", value: email });
  else if (phone) filters.push({ propertyName: "phone", operator: "EQ", value: phone });
  if (filters.length === 0) return null;
  const res = await fetch(`${API}/crm/v3/objects/contacts/search`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ filterGroups: [{ filters }], properties: ["email"], limit: 1 }),
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data?.results?.[0]?.id ?? null;
}

/** Upsert the contact, then attach a note with the full lead context. */
export async function pushLeadToHubspot(lead: HubspotLead) {
  if (!hubspotEnabled()) return;
  try {
    const email = (lead.email || "").trim().toLowerCase();
    const phone = (lead.phone || "").trim();
    const parts = (lead.name || "").trim().split(/\s+/);
    const isRep = /sales rep application/i.test(lead.service || "");
    const zip = (lead.zip || "").trim().slice(0, 5);

    // Storm enrichment (homeowners only; best-effort).
    const storm = isRep ? null : await stormContextForZip(zip);

    const properties: Record<string, string> = {
      firstname: parts[0] || "",
      lastname: parts.slice(1).join(" ") || "",
      phone,
      address: lead.address || "",
      zip: lead.zip || "",
      lifecyclestage: "lead",
      hs_lead_status: "NEW",
      lead_type: isRep
        ? "rep_applicant"
        : /commercial/i.test(lead.service || "")
          ? "commercial"
          : "homeowner",
    };
    if (email) properties.email = email;
    if (storm) {
      properties.storm_date = storm.storm_date;
      properties.hail_size_in = String(storm.hail_size_in);
      properties.storm_map_link = `https://poweredgetx.com/admin/storms?targets=${storm.storm_date}`;
    }

    let id = await findContact(email, phone);
    if (id) {
      await fetch(`${API}/crm/v3/objects/contacts/${id}`, {
        method: "PATCH",
        headers: headers(),
        body: JSON.stringify({ properties }),
        signal: AbortSignal.timeout(10000),
      });
    } else {
      const res = await fetch(`${API}/crm/v3/objects/contacts`, {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({ properties }),
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) {
        console.error("[hubspot] contact create non-2xx", res.status, await res.text());
        return;
      }
      id = (await res.json())?.id ?? null;
    }
    if (!id) return;

    const noteLines = [
      `New website lead — ${lead.service || "general"}`,
      storm
        ? `⛈️ Hail history: ${storm.hail_size_in}″ documented near their zip, most recent ${storm.storm_date}. Map: https://poweredgetx.com/admin/storms?targets=${storm.storm_date}`
        : "",
      lead.message ? `Message: ${lead.message}` : "",
      lead.source ? `Source: ${lead.source}` : "",
    ].filter(Boolean);
    await fetch(`${API}/crm/v3/objects/notes`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({
        properties: {
          hs_note_body: noteLines.join("\n"),
          hs_timestamp: new Date().toISOString(),
        },
        associations: [
          {
            to: { id },
            types: [{ associationCategory: "HUBSPOT_DEFINED", associationTypeId: 202 }],
          },
        ],
      }),
      signal: AbortSignal.timeout(10000),
    });
  } catch (err) {
    console.error("[hubspot] push failed", err);
  }
}
