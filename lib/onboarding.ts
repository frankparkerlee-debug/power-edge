/**
 * Rep onboarding: everything between "added on the Team page" and "knocking".
 *
 * One row per person in rep_onboarding (profile, agreement, training, office
 * sign-offs), plus rep_tax (W-9), rep_bank (direct deposit) and rep_permits
 * (one row per city). Sensitive numbers are encrypted in lib/pii.ts before
 * they reach the database; this file only ever sees ciphertext and last four.
 *
 * Nothing here blocks knocking (Parker, 2026-11-11: knock now, revisit gating
 * later). The checklist shows each rep what is left and the office who is
 * stuck where.
 */

import { AGREEMENT_STATUS, AGREEMENT_VERSION } from "@/lib/repAgreement";

const dbOn = () => !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
function h() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
  return { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
}
const url = (path: string) => `${process.env.SUPABASE_URL}/rest/v1/${path}`;

export type OnboardingRow = {
  member_id: number;
  legal_name: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  emergency_name: string | null;
  emergency_phone: string | null;
  shirt_size: string | null;
  photo_jpeg?: string | null;
  /** Set by the database, so the board can skip loading every photo. */
  has_photo?: boolean;
  agreement_version: string | null;
  agreement_typed_name: string | null;
  agreement_signed_at: string | null;
  playbook_read_at: string | null;
  quiz_passed_at: string | null;
  quiz_best: number | null;
  quiz_attempts: number;
  ride_along_at: string | null;
  ride_along_by: string | null;
  gear_issued_at: string | null;
  gear_by: string | null;
  office_notes: string | null;
};

export type TaxRow = {
  member_id: number;
  legal_name: string;
  business_name: string | null;
  tax_class: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  tin_type: "ssn" | "ein";
  tin_last4: string;
  certified_name: string;
  certified_at: string;
};

export type BankRow = {
  member_id: number;
  holder_name: string;
  routing: string;
  account_last4: string;
  account_type: "checking" | "savings";
  authorized_at: string;
};

export type PermitRow = {
  id: number;
  member_id: number;
  city: string;
  status: "needed" | "applied" | "approved" | "not_required";
  permit_number: string | null;
  expires_on: string | null;
  photo_jpeg: string | null;
  updated_at: string;
  updated_by: string | null;
};

/** Cities with a solicitor permit rule, checked on official city pages 2026-11-10. */
export const PERMIT_CITIES: Array<{ city: string; how: string }> = [
  { city: "Dallas", how: "In person at DPD, 1400 S. Lamar, 8am to 3pm weekdays. $50, 2x2 photo, ID card mailed within 30 days, good 1 year." },
  { city: "Fort Worth", how: "Online (Accela) or devcustomerservice@fortworthtexas.gov. Needs the company's Texas sales tax certificate, your driver's license and vehicle registration." },
  { city: "Arlington", how: "In person at Police Records, 620 W. Division St. Carry it and display it; knocking 9am to sunset." },
  { city: "Garland", how: "In person at PD Records, 1891 Forest Ln. $20, plus $15 per extra person; up to 10 business days." },
  { city: "Richardson", how: "In person, notarized form. $35 plus $10 per person; renew every 180 days." },
  { city: "Carrollton", how: "$50 per company plus $10 per setter, every 6 months." },
  { city: "Rowlett", how: "In person. Knocking 8am to 8pm; honor No Soliciting signs." },
  { city: "University Park", how: "In person, $50." },
  { city: "Grand Prairie", how: "Form to the Police Department." },
  { city: "Mesquite", how: "Rules not confirmed. Call the city before knocking." },
  { city: "Irving", how: "Rules not confirmed. Call the city before knocking." },
];

async function get<T>(path: string): Promise<T[]> {
  if (!dbOn()) return [];
  const res = await fetch(url(path), { headers: h(), cache: "no-store" });
  if (!res.ok) return [];
  return (await res.json()) as T[];
}

const ONB_COLS =
  "member_id,legal_name,phone,address,city,state,zip,emergency_name,emergency_phone,shirt_size,photo_jpeg,agreement_version,agreement_typed_name,agreement_signed_at,playbook_read_at,quiz_passed_at,quiz_best,quiz_attempts,ride_along_at,ride_along_by,gear_issued_at,gear_by,office_notes";
const TAX_COLS = "member_id,legal_name,business_name,tax_class,address,city,state,zip,tin_type,tin_last4,certified_name,certified_at";
const BANK_COLS = "member_id,holder_name,routing,account_last4,account_type,authorized_at";
const PERMIT_COLS = "id,member_id,city,status,permit_number,expires_on,photo_jpeg,updated_at,updated_by";

export async function loadOnboarding(memberId: number) {
  const [o, t, b, p] = await Promise.all([
    get<OnboardingRow>(`rep_onboarding?select=${ONB_COLS}&member_id=eq.${memberId}`),
    get<TaxRow>(`rep_tax?select=${TAX_COLS}&member_id=eq.${memberId}`),
    get<BankRow>(`rep_bank?select=${BANK_COLS}&member_id=eq.${memberId}`),
    get<PermitRow>(`rep_permits?select=${PERMIT_COLS}&member_id=eq.${memberId}&order=city.asc`),
  ]);
  return { onb: o[0] ?? null, tax: t[0] ?? null, bank: b[0] ?? null, permits: p };
}

/** Everyone at once, for the office board. Photos left out to keep it light. */
export async function loadAllOnboarding() {
  const light = ONB_COLS.replace(",photo_jpeg", ",has_photo");
  const [o, t, b, p] = await Promise.all([
    get<OnboardingRow>(`rep_onboarding?select=${light}`),
    get<Pick<TaxRow, "member_id">>(`rep_tax?select=member_id`),
    get<Pick<BankRow, "member_id">>(`rep_bank?select=member_id`),
    get<PermitRow>(`rep_permits?select=${PERMIT_COLS.replace(",photo_jpeg", "")}&order=city.asc`),
  ]);
  return {
    onb: new Map(o.map((r) => [r.member_id, r])),
    tax: new Set(t.map((r) => r.member_id)),
    bank: new Set(b.map((r) => r.member_id)),
    permits: p,
  };
}

export type SignedAgreement = {
  agreement_version: string | null;
  agreement_text: string | null;
  agreement_typed_name: string | null;
  agreement_signature_png: string | null;
  agreement_signed_at: string | null;
  agreement_ip: string | null;
};

/** The agreement exactly as someone signed it. */
export async function loadSignedAgreement(memberId: number) {
  const rows = await get<SignedAgreement>(
    `rep_onboarding?select=agreement_version,agreement_text,agreement_typed_name,agreement_signature_png,agreement_signed_at,agreement_ip&member_id=eq.${memberId}`,
  );
  return rows[0] ?? null;
}

export async function upsert(table: string, row: Record<string, unknown>, conflict = "member_id") {
  if (!dbOn()) return false;
  const res = await fetch(url(`${table}?on_conflict=${conflict}`), {
    method: "POST",
    headers: { ...h(), Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify([{ ...row, updated_at: new Date().toISOString() }]),
  });
  if (!res.ok) console.error(`[onboarding] ${table}`, res.status, (await res.text()).slice(0, 300));
  return res.ok;
}

export async function removePermit(memberId: number, city: string) {
  if (!dbOn()) return false;
  const res = await fetch(url(`rep_permits?member_id=eq.${memberId}&city=eq.${encodeURIComponent(city)}`), {
    method: "DELETE",
    headers: h(),
  });
  return res.ok;
}

export async function logPiiView(viewer: string, memberId: number, field: string) {
  if (!dbOn()) return;
  await fetch(url("pii_access_log"), {
    method: "POST",
    headers: { ...h(), Prefer: "return=minimal" },
    body: JSON.stringify({ viewer, member_id: memberId, field }),
  }).catch(() => undefined);
}

export async function encryptedField(table: "rep_tax" | "rep_bank", memberId: number) {
  const col = table === "rep_tax" ? "tin_enc" : "account_enc";
  const rows = await get<Record<string, string>>(`${table}?select=${col}&member_id=eq.${memberId}`);
  return rows[0]?.[col] ?? null;
}

/* ------------------------------------------------------------------------ */

export type Step = {
  key: "profile" | "agreement" | "w9" | "bank" | "training" | "permits" | "ride_along" | "gear";
  label: string;
  done: boolean;
  /** Who does it: the rep, or the office. */
  by: "rep" | "office";
  detail: string;
};

export function stepsFor(d: {
  onb: OnboardingRow | null;
  tax: TaxRow | { member_id: number } | null;
  bank: BankRow | { member_id: number } | null;
  permits: PermitRow[];
}): Step[] {
  const o = d.onb;
  const profileDone = !!(o?.legal_name && o.phone && o.address && o.emergency_name && o.emergency_phone && (o.photo_jpeg || o.has_photo));
  const signedCurrent = !!o?.agreement_signed_at && o.agreement_version === AGREEMENT_VERSION;
  const approved = d.permits.filter((p) => p.status === "approved" || p.status === "not_required");
  const pending = d.permits.filter((p) => p.status === "needed" || p.status === "applied");
  return [
    {
      key: "profile",
      label: "Your details and badge photo",
      done: profileDone,
      by: "rep",
      detail: profileDone ? "Done" : "Legal name, phone, address, an emergency contact and a photo for your badge and permits.",
    },
    {
      key: "agreement",
      label: "Sign your contractor agreement",
      done: signedCurrent,
      by: "rep",
      detail: signedCurrent
        ? "Signed"
        : AGREEMENT_STATUS === "draft"
          ? "Opens for signing once the office finalizes it. You can read it now."
          : o?.agreement_signed_at
            ? "Updated since you signed. Please sign the new version."
            : "Read it, then sign on your phone.",
    },
    {
      key: "w9",
      label: "Tax form (W-9)",
      done: !!d.tax,
      by: "rep",
      detail: d.tax ? "On file" : "So PowerEdge can pay you and send your 1099. Your SSN is encrypted.",
    },
    {
      key: "bank",
      label: "Direct deposit",
      done: !!d.bank,
      by: "rep",
      detail: d.bank ? "On file" : "Where your commission goes. Your account number is encrypted.",
    },
    {
      key: "training",
      label: "Playbook and compliance check",
      done: !!o?.playbook_read_at && !!o?.quiz_passed_at,
      by: "rep",
      detail:
        o?.playbook_read_at && o?.quiz_passed_at
          ? "Passed"
          : !o?.playbook_read_at
            ? "Read the scripts and the Texas compliance card, then pass a 10-question check."
            : `Pass the 10-question check${o?.quiz_attempts ? ` (best so far ${o.quiz_best ?? 0}/10)` : ""}.`,
    },
    {
      key: "permits",
      label: "City permits",
      done: approved.length > 0 && pending.length === 0,
      by: "rep",
      detail: approved.length
        ? `${approved.map((p) => p.city).join(", ")}${pending.length ? `; waiting on ${pending.map((p) => p.city).join(", ")}` : ""}`
        : pending.length
          ? `Waiting on ${pending.map((p) => p.city).join(", ")}`
          : "Add each city you will knock in, and track the permit.",
    },
    {
      key: "ride_along",
      label: "Ride-along with a lead",
      done: !!o?.ride_along_at,
      by: "office",
      detail: o?.ride_along_at ? `Signed off by ${o.ride_along_by ?? "the office"}` : "A day in the field with a lead before knocking alone.",
    },
    {
      key: "gear",
      label: "Badge, shirt and print kit",
      done: !!o?.gear_issued_at,
      by: "office",
      detail: o?.gear_issued_at ? `Issued by ${o.gear_by ?? "the office"}` : "Badge, PowerEdge shirt, door hangers and appointment cards.",
    },
  ];
}

/** Permits running out within 30 days, or already out. */
export function expiring(permits: PermitRow[], todayIso: string) {
  const today = Date.parse(`${todayIso}T12:00:00Z`);
  return permits
    .filter((p) => p.status === "approved" && p.expires_on)
    .map((p) => ({ ...p, days: Math.round((Date.parse(`${p.expires_on}T12:00:00Z`) - today) / 86400000) }))
    .filter((p) => p.days <= 30)
    .sort((a, b) => a.days - b.days);
}
