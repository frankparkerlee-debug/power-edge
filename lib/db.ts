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
  id?: string;
  name?: string;
  phone?: string;
  email?: string;
  address?: string;
  cause?: string;
  damage_signs?: string;
  roof_age?: string;
  carrier?: string;
  policy_number?: string;
  deductible?: string;
  coverage_type?: string;
  date_of_loss?: string;
  filed?: boolean;
  claim_number?: string;
  mortgage_company?: string;
  concerns?: string;
  best_times?: string;
  solar?: boolean;
  stage?: number;
  completed?: boolean;
  updated_at?: string;
  nurtured_stage?: number;
};

/** Upsert a claim-prep intake by id (progressive save — one row per homeowner,
 *  updated as they advance through the wizard). Best-effort; never throws. */
export async function upsertClaimIntake(intake: ClaimIntake) {
  if (!dbEnabled()) return;
  try {
    const res = await fetch(`${process.env.SUPABASE_URL}/rest/v1/claim_intakes`, {
      method: "POST",
      headers: {
        ...authHeaders(),
        Prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify(intake),
    });
    if (!res.ok) {
      console.error("[db] upsertClaimIntake non-2xx", res.status, await res.text());
    }
  } catch (err) {
    console.error("[db] upsertClaimIntake failed", err);
  }
}

/** Incomplete intakes last touched before `beforeIso` — for drop-off nurture. */
export async function listIncompleteIntakes(beforeIso: string): Promise<ClaimIntake[]> {
  if (!dbEnabled()) return [];
  try {
    const res = await fetch(
      `${process.env.SUPABASE_URL}/rest/v1/claim_intakes?select=*&completed=eq.false&updated_at=lt.${beforeIso}&order=updated_at.asc&limit=300`,
      { headers: authHeaders(), cache: "no-store" },
    );
    if (!res.ok) return [];
    return (await res.json()) as ClaimIntake[];
  } catch (err) {
    console.error("[db] listIncompleteIntakes failed", err);
    return [];
  }
}

/** Mark which nurture stage has been sent, so we don't re-send. */
export async function markIntakeNurtured(id: string, stage: number) {
  if (!dbEnabled()) return;
  try {
    await fetch(
      `${process.env.SUPABASE_URL}/rest/v1/claim_intakes?id=eq.${id}`,
      {
        method: "PATCH",
        headers: { ...authHeaders(), Prefer: "return=minimal" },
        body: JSON.stringify({ nurtured_stage: stage }),
      },
    );
  } catch (err) {
    console.error("[db] markIntakeNurtured failed", err);
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
