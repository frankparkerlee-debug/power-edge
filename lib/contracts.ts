/**
 * Field agreements.
 *
 * The paper version exists and still works, but a rep filling a form on a
 * phone beats handing someone a clipboard, and it means the homeowner leaves
 * with the agreement and both cancellation notices in their inbox rather than
 * a page that ends up in a kitchen drawer.
 */

const dbOn = () =>
  !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);

function authHeaders() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  };
}

export type ScopeLine = { description: string; price: string };

export type ContractInput = {
  rep?: string;
  owner_names: string;
  owner_phone?: string;
  owner_email?: string;
  property_address: string;
  scope: ScopeLine[];
  total_price?: string;
  claim_based: boolean;
  carrier?: string;
  claim_number?: string;
  deductible?: string;
  signature_png?: string;
  signer_name?: string;
  ip?: string;
};

/**
 * Three BUSINESS days, which is what the cancellation notice has to state.
 * Counting calendar days would understate the homeowner's window and put the
 * wrong date on a statutory form, so weekends are skipped. Public holidays are
 * not, which errs toward giving the homeowner longer rather than shorter.
 */
export function cancelDeadline(from = new Date()): Date {
  const d = new Date(from);
  let added = 0;
  while (added < 3) {
    d.setDate(d.getDate() + 1);
    const day = d.getDay();
    if (day !== 0 && day !== 6) added++;
  }
  return d;
}

export function fmtDate(d: Date) {
  return d.toLocaleDateString("en-US", {
    timeZone: "America/Chicago",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export async function saveContract(
  input: ContractInput,
): Promise<{ ok: true; id: string; deadline: Date } | { ok: false; error: string }> {
  if (!dbOn()) return { ok: false, error: "Not configured." };
  if (!input.owner_names?.trim() || !input.property_address?.trim()) {
    return { ok: false, error: "Owner name and property address are required." };
  }
  if (!input.signature_png) {
    return { ok: false, error: "A signature is required." };
  }

  const deadline = cancelDeadline();
  try {
    const res = await fetch(`${process.env.SUPABASE_URL}/rest/v1/contracts`, {
      method: "POST",
      headers: { ...authHeaders(), Prefer: "return=representation" },
      body: JSON.stringify({
        rep: input.rep || null,
        owner_names: input.owner_names.trim(),
        owner_phone: input.owner_phone?.trim() || null,
        owner_email: input.owner_email?.trim() || null,
        property_address: input.property_address.trim(),
        scope: input.scope.filter((s) => s.description?.trim()),
        total_price: input.total_price?.trim() || null,
        claim_based: input.claim_based,
        carrier: input.carrier?.trim() || null,
        claim_number: input.claim_number?.trim() || null,
        deductible: input.deductible?.trim() || null,
        signature_png: input.signature_png,
        signer_name: input.signer_name?.trim() || input.owner_names.trim(),
        signed_at: new Date().toISOString(),
        cancel_deadline: deadline.toISOString().slice(0, 10),
        ip: input.ip || null,
      }),
    });
    if (!res.ok) return { ok: false, error: "Could not save the agreement." };
    const rows = (await res.json()) as Array<{ id: string }>;
    return { ok: true, id: rows[0].id, deadline };
  } catch {
    return { ok: false, error: "Could not save the agreement." };
  }
}

export async function listContracts(limit = 100) {
  if (!dbOn()) return [];
  try {
    const res = await fetch(
      `${process.env.SUPABASE_URL}/rest/v1/contracts?select=id,created_at,rep,owner_names,property_address,total_price,claim_based,cancel_deadline,canceled_at&order=created_at.desc&limit=${limit}`,
      { headers: authHeaders(), cache: "no-store" },
    );
    if (!res.ok) return [];
    return (await res.json()) as Array<Record<string, string | boolean | null>>;
  } catch {
    return [];
  }
}

export async function markEmailed(id: string) {
  if (!dbOn()) return;
  try {
    await fetch(`${process.env.SUPABASE_URL}/rest/v1/contracts?id=eq.${id}`, {
      method: "PATCH",
      headers: { ...authHeaders(), Prefer: "return=minimal" },
      body: JSON.stringify({ emailed_at: new Date().toISOString() }),
    });
  } catch {
    /* non-fatal */
  }
}
