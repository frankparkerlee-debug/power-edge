import { NextResponse } from "next/server";
import { apiUser } from "@/lib/auth";
import { decrypt, piiReady } from "@/lib/pii";
import { encryptedField, logPiiView } from "@/lib/onboarding";

export const dynamic = "force-dynamic";

/**
 * Show one full SSN/EIN or bank account number to an admin, and log it.
 * Needed for 1099 filing and setting up payouts; never shown to anyone else,
 * never sent in a page load, only on an explicit tap.
 */
export async function POST(req: Request) {
  const u = await apiUser(req);
  if (!u || u.role !== "admin") return NextResponse.json({ ok: false, error: "Admins only." }, { status: 403 });
  if (!piiReady()) return NextResponse.json({ ok: false, error: "Secure storage key is not set." }, { status: 503 });

  let b: { member_id?: number; field?: string };
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
  }
  const member = Number(b.member_id);
  const field = b.field === "account" ? "account" : "tin";
  if (!Number.isFinite(member)) return NextResponse.json({ ok: false, error: "Who?" }, { status: 400 });

  const enc = await encryptedField(field === "tin" ? "rep_tax" : "rep_bank", member);
  if (!enc) return NextResponse.json({ ok: false, error: "Not on file." }, { status: 404 });
  try {
    const value = decrypt(enc);
    await logPiiView(u.name, member, field);
    return NextResponse.json({ ok: true, value });
  } catch {
    return NextResponse.json({ ok: false, error: "Couldn't read it. Was the key changed?" }, { status: 500 });
  }
}
