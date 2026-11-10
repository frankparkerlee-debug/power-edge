import { NextResponse } from "next/server";
import { signByToken, fmtDate, markEmailed, linkJobForContract, type ScopeLine } from "@/lib/contracts";
import { sendSignedAgreement } from "@/lib/emails";
import { burst, clientIp, tooMany } from "@/lib/rateLimit";

/**
 * Homeowner signs an agreement a rep sent them.
 *
 * Public by design: the 48-hex token in the URL is the credential, the same
 * way a signing link from any e-sign tool works. Rate limited so the token
 * space cannot be probed.
 */
export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ token: string }> },
) {
  const ip = clientIp(req);
  const wait = burst(`sign:${ip}`, 12, 10 * 60_000);
  if (wait) return tooMany(wait);

  const { token } = await ctx.params;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
  }

  const signed = await signByToken(
    token,
    String(body.signature_png || ""),
    String(body.signer_name || ""),
    ip,
  );
  if (!signed.ok) {
    return NextResponse.json({ ok: false, error: signed.error }, { status: 400 });
  }

  /**
   * Everything below describes the agreement itself, so it comes from the row
   * the rep drafted, not from the request.
   *
   * It used to be read off `body`, which is the homeowner's browser. That lost
   * the rep on every remote signing, because no rep was in the body to send:
   * the job had "Parker Lee" against it at agreement_sent and came back null
   * once the homeowner signed, which is the commission gone. It also meant the
   * scope and total in the signed copy we email were whatever was posted to
   * this endpoint, while the stored contract kept the real ones.
   */
  const c = signed.contract;
  const str = (k: string) => String(c[k] ?? "").trim();
  const scopeLines = (Array.isArray(c.scope) ? c.scope : []) as ScopeLine[];
  const claimBased = c.claim_based !== false;

  // Advance the job. Without this a remotely signed agreement left the CRM
  // reading "agreement sent" while the contract itself said signed, so the
  // office chased a deal that was already closed.
  await linkJobForContract({
    contractId: signed.id,
    stage: "signed",
    address: str("property_address"),
    owner: str("owner_names"),
    phone: str("owner_phone"),
    email: str("owner_email"),
    rep: str("rep"),
    claim: claimBased,
    carrier: str("carrier"),
    claimNumber: str("claim_number"),
    deductible: str("deductible"),
    value: str("total_price"),
  });

  // Their copy, with the cancellation notice and the real deadline. The
  // agreement is already recorded, so a mail failure must not fail the signing.
  let emailed = false;
  const to = str("owner_email");
  const key = process.env.RESEND_API_KEY;
  if (to && key) {
    const r = await sendSignedAgreement(key, {
      id: signed.id,
      ownerNames: str("owner_names"),
      address: str("property_address"),
      email: to,
      scope: scopeLines,
      total: str("total_price"),
      claimBased,
      signedOn: fmtDate(new Date()),
      cancelBy: fmtDate(signed.deadline),
    });
    emailed = !!r?.ok;
    if (emailed) await markEmailed(signed.id);
  }

  return NextResponse.json({
    ok: true,
    cancelBy: fmtDate(signed.deadline),
    emailed,
  });
}
