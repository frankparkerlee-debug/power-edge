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
    const properties: Record<string, string> = {
      firstname: parts[0] || "",
      lastname: parts.slice(1).join(" ") || "",
      phone,
      address: lead.address || "",
      zip: lead.zip || "",
      lifecyclestage: "lead",
      hs_lead_status: "NEW",
    };
    if (email) properties.email = email;

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
      lead.solar ? "☀️ SOLAR HOME — scope panel detach & reset + D&R supplement." : "",
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
