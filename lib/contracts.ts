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

/** Federal holidays, with the Sat->Fri / Sun->Mon observed shift. */
function observedHolidays(year: number): Set<string> {
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const nth = (month: number, weekday: number, n: number) => {
    const d = new Date(Date.UTC(year, month, 1));
    let count = 0;
    while (true) {
      if (d.getUTCDay() === weekday && ++count === n) return d;
      d.setUTCDate(d.getUTCDate() + 1);
    }
  };
  const last = (month: number, weekday: number) => {
    const d = new Date(Date.UTC(year, month + 1, 0));
    while (d.getUTCDay() !== weekday) d.setUTCDate(d.getUTCDate() - 1);
    return d;
  };
  /** A fixed-date holiday falling at a weekend is observed on the nearest weekday. */
  const shift = (m: number, day: number) => {
    const d = new Date(Date.UTC(year, m, day));
    if (d.getUTCDay() === 6) d.setUTCDate(d.getUTCDate() - 1);
    else if (d.getUTCDay() === 0) d.setUTCDate(d.getUTCDate() + 1);
    return d;
  };

  return new Set(
    [
      shift(0, 1), // New Year's Day
      nth(0, 1, 3), // MLK Day
      nth(1, 1, 3), // Presidents Day
      last(4, 1), // Memorial Day
      shift(5, 19), // Juneteenth
      shift(6, 4), // Independence Day
      nth(8, 1, 1), // Labor Day
      nth(9, 1, 2), // Columbus Day
      shift(10, 11), // Veterans Day
      nth(10, 4, 4), // Thanksgiving
      shift(11, 25), // Christmas
    ].map(iso),
  );
}

/** Today's date on the Texas calendar, as y/m/d, free of any server timezone. */
function chicagoToday(now: Date): { y: number; m: number; d: number } {
  const p = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (t: string) => Number(p.find((x) => x.type === t)!.value);
  return { y: get("year"), m: get("month"), d: get("day") };
}

/**
 * Three BUSINESS days, which is what the cancellation notice has to state.
 *
 * Weekends and legal holidays are both skipped. Counting a holiday as a
 * business day shortens the homeowner's window and puts a wrong, short date on
 * a statutory form; skipping one only ever lengthens it. Erring long is safe,
 * erring short is what voids a sale.
 *
 * All arithmetic is anchored to the America/Chicago calendar date and then
 * done in pure UTC. An earlier version mixed getDay() (server-local) with
 * toISOString() (UTC), and within six hours of midnight UTC the two disagreed
 * about the day, which produced a deadline that landed on a Saturday.
 */
export function cancelDeadline(from = new Date()): Date {
  const { y, m, d: dd } = chicagoToday(from);
  // Noon UTC so the date is unambiguous and cannot drift across a boundary.
  const cursor = new Date(Date.UTC(y, m - 1, dd, 12, 0, 0));

  let added = 0;
  let year = cursor.getUTCFullYear();
  let holidays = observedHolidays(year);

  while (added < 3) {
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    if (cursor.getUTCFullYear() !== year) {
      year = cursor.getUTCFullYear();
      holidays = observedHolidays(year);
    }
    const day = cursor.getUTCDay();
    if (day === 0 || day === 6) continue;
    if (holidays.has(cursor.toISOString().slice(0, 10))) continue;
    added++;
  }
  return cursor;
}

/** Calendar dates are carried at noon UTC, so they are formatted in UTC. */
export function fmtDate(d: Date) {
  return d.toLocaleDateString("en-US", {
    timeZone: "UTC",
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


/** Opaque, unguessable link id for remote signing. */
function signToken() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Save a draft the rep prefilled, assigned to a prospect, without a signature
 * yet. Returns the signing link to send.
 */
export async function createDraft(
  input: Omit<ContractInput, "signature_png" | "signer_name"> & { target_id?: number },
): Promise<{ ok: true; id: string; token: string } | { ok: false; error: string }> {
  if (!dbOn()) return { ok: false, error: "Not configured." };
  if (!input.owner_names?.trim() || !input.property_address?.trim()) {
    return { ok: false, error: "Owner name and property address are required." };
  }
  const token = signToken();
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
        target_id: input.target_id ?? null,
        status: "sent",
        sign_token: token,
        sent_at: new Date().toISOString(),
        ip: input.ip || null,
      }),
    });
    if (!res.ok) return { ok: false, error: "Could not create the draft." };
    const rows = (await res.json()) as Array<{ id: string }>;
    return { ok: true, id: rows[0].id, token };
  } catch {
    return { ok: false, error: "Could not create the draft." };
  }
}

/** The agreement behind a signing link, for the homeowner to read. */
export async function getByToken(token: string) {
  if (!dbOn() || !/^[0-9a-f]{48}$/.test(token)) return null;
  try {
    const res = await fetch(
      `${process.env.SUPABASE_URL}/rest/v1/contracts?select=*&sign_token=eq.${token}`,
      { headers: authHeaders(), cache: "no-store" },
    );
    if (!res.ok) return null;
    const rows = (await res.json()) as Array<Record<string, unknown>>;
    return rows[0] || null;
  } catch {
    return null;
  }
}

/**
 * Homeowner signs a sent agreement. The deadline is computed HERE, at signing,
 * because that is the date the statute runs from, not the date the rep drafted
 * it. Only a contract still in 'sent' can be signed, so a replayed link cannot
 * overwrite a signature or restart the clock.
 */
export async function signByToken(
  token: string,
  signature_png: string,
  signer_name: string,
  ip?: string,
): Promise<{ ok: true; id: string; deadline: Date } | { ok: false; error: string }> {
  if (!dbOn()) return { ok: false, error: "Not configured." };
  if (!signature_png) return { ok: false, error: "A signature is required." };
  if (!/^[0-9a-f]{48}$/.test(token)) return { ok: false, error: "Not found." };

  const deadline = cancelDeadline();
  try {
    const res = await fetch(
      `${process.env.SUPABASE_URL}/rest/v1/contracts?sign_token=eq.${token}&status=eq.sent`,
      {
        method: "PATCH",
        headers: { ...authHeaders(), Prefer: "return=representation" },
        body: JSON.stringify({
          status: "signed",
          signature_png,
          signer_name: signer_name?.trim() || null,
          signed_at: new Date().toISOString(),
          signed_remotely: true,
          cancel_deadline: deadline.toISOString().slice(0, 10),
          ip: ip || null,
        }),
      },
    );
    if (!res.ok) return { ok: false, error: "Could not record the signature." };
    const rows = (await res.json()) as Array<{ id: string }>;
    if (rows.length === 0) {
      return { ok: false, error: "This agreement has already been signed or withdrawn." };
    }
    return { ok: true, id: rows[0].id, deadline };
  } catch {
    return { ok: false, error: "Could not record the signature." };
  }
}

/** Rep attests they handed over the two printed cancellation notices. */
export async function markNoticesDelivered(id: string) {
  if (!dbOn()) return;
  try {
    await fetch(`${process.env.SUPABASE_URL}/rest/v1/contracts?id=eq.${id}`, {
      method: "PATCH",
      headers: { ...authHeaders(), Prefer: "return=minimal" },
      body: JSON.stringify({ notices_delivered: true }),
    });
  } catch {
    /* non-fatal */
  }
}


/** An agreement is a job. Same address-matching rule as a booking. */
export async function linkJobForContract(a: {
  contractId: string;
  stage: "agreement_sent" | "signed";
  address: string;
  owner: string;
  phone?: string;
  email?: string;
  rep?: string;
  claim: boolean;
  carrier?: string;
  claimNumber?: string;
  deductible?: string;
  value?: string;
}) {
  if (!dbOn() || !a.address?.trim()) return;
  const { listJobs, createJob, updateJob, logEvent } = await import("@/lib/jobs");
  const label = a.stage === "signed" ? "agreement_signed" : "agreement_sent";
  try {
    const addr = a.address.trim();
    const existing = (await listJobs({ limit: 500 })).find(
      (j) => j.address.trim().toLowerCase() === addr.toLowerCase(),
    );
    const patch = {
      stage: a.stage as never,
      contract_id: a.contractId,
      owner_name: a.owner || null,
      phone: a.phone || null,
      email: a.email || null,
      rep: a.rep || null,
      job_type: (a.claim ? "claim" : "cash") as "claim" | "cash",
      carrier: a.carrier || null,
      claim_number: a.claimNumber || null,
      deductible: a.deductible || null,
      contract_value: a.value || null,
    };
    if (existing) {
      await updateJob(existing.id, patch, a.rep);
      await logEvent(existing.id, label, a.value || undefined, a.rep);
      return;
    }
    const job = await createJob({ address: addr, ...patch }, a.rep);
    if (job) await logEvent(job.id, label, a.value || undefined, a.rep);
  } catch {
    /* never cost the agreement */
  }
}
