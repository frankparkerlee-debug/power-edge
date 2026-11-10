import { NextResponse } from "next/server";
import { apiUser } from "@/lib/auth";
import { getById, markSent, noteOnJobForContract } from "@/lib/contracts";
import { sendAgreementToSign } from "@/lib/emails";

/**
 * Send an unsigned agreement's signing link again.
 *
 * A send can fail for ordinary reasons: a typo in the address, a mailbox that
 * is full, a provider having a bad minute. Without this the rep's only option
 * was to start the whole agreement over, which creates a second contract row
 * for the same house.
 *
 * Optionally takes a corrected email, because the usual reason a send fails
 * is that the address was wrong.
 */
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const u = await apiUser(req);
  if (!u) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  let body: { id?: string; email?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
  }

  const id = String(body.id || "").trim();
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ ok: false, error: "Bad agreement id" }, { status: 400 });
  }

  const c = await getById(id);
  if (!c) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });

  // Only an unsigned agreement has anything to resend. Once it is signed the
  // homeowner has their copy and this link is spent.
  if (String(c.status) !== "sent") {
    return NextResponse.json(
      { ok: false, error: "That agreement is already signed or withdrawn." },
      { status: 409 },
    );
  }

  const to = (String(body.email || "").trim() || String(c.owner_email || "").trim());
  if (!to) return NextResponse.json({ ok: false, error: "No email address." }, { status: 400 });
  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json({ ok: false, error: "Email is not configured." }, { status: 500 });
  }

  const base = process.env.NEXT_PUBLIC_SITE_URL || "https://poweredgetx.com";
  const r = await sendAgreementToSign(process.env.RESEND_API_KEY, {
    ownerNames: String(c.owner_names || ""),
    address: String(c.property_address || ""),
    email: to,
    url: `${base}/sign/${c.sign_token}`,
    rep: String(c.rep || u.name || ""),
    total: String(c.total_price || ""),
    claimBased: c.claim_based !== false,
  });

  if (!r?.ok) {
    await noteOnJobForContract(
      String(c.property_address || ""),
      `Agreement resend to ${to} failed`,
      u.name,
    );
    return NextResponse.json({ ok: false, error: "That did not go through either." }, { status: 502 });
  }

  await markSent(id);
  await noteOnJobForContract(
    String(c.property_address || ""),
    `Agreement re-emailed to ${to}`,
    u.name,
  );
  return NextResponse.json({ ok: true, emailedTo: to });
}
