// Durable lead capture via Supabase (PostgREST REST API — no SDK dependency).
// Env-gated so the app runs clean until keys are set:
//   SUPABASE_URL                (e.g. https://xxxx.supabase.co)
//   SUPABASE_SERVICE_ROLE_KEY   (server-only — bypasses RLS; never expose client-side)
//
// Apply the schema in supabase/schema.sql via the Supabase SQL editor (the
// transaction pooler can't run DDL from the app). This is also the foundation
// for the Plaid Phase 2 financing tables.

export function dbEnabled() {
  return !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function authHeaders() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  };
}

export type LeadInsert = {
  name?: string;
  phone?: string;
  email?: string;
  address?: string;
  zip?: string;
  service?: string;
  message?: string;
  solar?: boolean;
  source?: string;
  page_path?: string;
  referrer?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  gclid?: string;
};

export type LeadRow = LeadInsert & { id: string; created_at: string };

/** Best-effort insert — never throws, so a DB hiccup can't drop a lead's email. */
export async function insertLead(lead: LeadInsert) {
  if (!dbEnabled()) return;
  const post = (payload: LeadInsert) =>
    fetch(`${process.env.SUPABASE_URL}/rest/v1/leads`, {
      method: "POST",
      headers: { ...authHeaders(), Prefer: "return=minimal" },
      body: JSON.stringify(payload),
    });
  try {
    let res = await post(lead);
    if (!res.ok) {
      // If the `address` column hasn't been added yet, PostgREST rejects the
      // whole row — retry without it so we never drop a lead over one column.
      const { address: _address, ...rest } = lead;
      void _address;
      res = await post(rest);
      if (!res.ok) {
        console.error("[db] insertLead non-2xx", res.status, await res.text());
      }
    }
  } catch (err) {
    console.error("[db] insertLead failed", err);
  }
}

export type ClaimIntake = {
  name?: string;
  phone?: string;
  email?: string;
  address?: string;
  carrier?: string;
  policy_number?: string;
  deductible?: string;
  date_of_loss?: string;
  filed?: boolean;
  claim_number?: string;
  mortgage_company?: string;
  concerns?: string;
  best_times?: string;
  solar?: boolean;
};

/** Best-effort insert of a homeowner's claim-prep intake. Never throws. */
export async function insertClaimIntake(intake: ClaimIntake) {
  if (!dbEnabled()) return;
  try {
    const res = await fetch(`${process.env.SUPABASE_URL}/rest/v1/claim_intakes`, {
      method: "POST",
      headers: { ...authHeaders(), Prefer: "return=minimal" },
      body: JSON.stringify(intake),
    });
    if (!res.ok) {
      console.error("[db] insertClaimIntake non-2xx", res.status, await res.text());
    }
  } catch (err) {
    console.error("[db] insertClaimIntake failed", err);
  }
}

export async function listLeads(limit = 300): Promise<LeadRow[]> {
  if (!dbEnabled()) return [];
  try {
    const res = await fetch(
      `${process.env.SUPABASE_URL}/rest/v1/leads?select=*&order=created_at.desc&limit=${limit}`,
      { headers: authHeaders(), cache: "no-store" },
    );
    if (!res.ok) return [];
    return (await res.json()) as LeadRow[];
  } catch (err) {
    console.error("[db] listLeads failed", err);
    return [];
  }
}
