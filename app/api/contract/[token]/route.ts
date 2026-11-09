import { NextResponse } from "next/server";
import { signByToken, fmtDate, markEmailed, type ScopeLine } from "@/lib/contracts";
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

  // Their copy, with the cancellation notice and the real deadline. The
  // agreement is already recorded, so a mail failure must not fail the signing.
  let emailed = false;
  const to = String(body.owner_email || "").trim();
  const key = process.env.RESEND_API_KEY;
  if (to && key) {
    const r = await sendSignedAgreement(key, {
      id: signed.id,
      ownerNames: String(body.owner_names || ""),
      address: String(body.property_address || ""),
      email: to,
      scope: (Array.isArray(body.scope) ? body.scope : []) as ScopeLine[],
      total: String(body.total_price || ""),
      claimBased: body.claim_based !== false,
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
