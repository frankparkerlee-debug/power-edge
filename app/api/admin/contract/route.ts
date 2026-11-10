import { NextResponse } from "next/server";
import {
  saveContract,
  createDraft,
  markNoticesDelivered,
  fmtDate,
  markEmailed,
  markSent,
  noteOnJobForContract,
  type ScopeLine,
} from "@/lib/contracts";
import { sendSignedAgreement, sendAgreementToSign } from "@/lib/emails";
import { clientIp } from "@/lib/rateLimit";
import { apiUser, canSell } from "@/lib/auth";
import { linkJobForContract } from "@/lib/contracts";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const u = await apiUser(req);
  if (!u) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  // The page hides this from setters; the endpoint has to mean it.
  if (!canSell(u.role)) {
    return NextResponse.json(
      { ok: false, error: "Agreements are written by closers." },
      { status: 403 },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
  }

  const scope = Array.isArray(body.scope) ? (body.scope as ScopeLine[]) : [];

  // Two paths. "send" prefills and issues a signing link for the homeowner to
  // sign later on their own device; the default signs on the rep's phone now.
  if (body.mode === "send") {
    const draft = await createDraft({
      rep: String(body.rep || u.name || ""),
      owner_names: String(body.owner_names || ""),
      owner_phone: String(body.owner_phone || ""),
      owner_email: String(body.owner_email || ""),
      property_address: String(body.property_address || ""),
      scope,
      total_price: String(body.total_price || ""),
      claim_based: body.claim_based !== false,
      carrier: String(body.carrier || ""),
      claim_number: String(body.claim_number || ""),
      deductible: String(body.deductible || ""),
      target_id: Number(body.target_id) || undefined,
      ip: clientIp(req),
    });
    if (!draft.ok) {
      return NextResponse.json({ ok: false, error: draft.error }, { status: 400 });
    }
    await linkJobForContract({
      contractId: draft.id,
      stage: "agreement_sent",
      address: String(body.property_address || ""),
      owner: String(body.owner_names || ""),
      phone: String(body.owner_phone || ""),
      email: String(body.owner_email || ""),
      rep: String(body.rep || u.name || ""),
      claim: body.claim_based !== false,
      carrier: String(body.carrier || ""),
      claimNumber: String(body.claim_number || ""),
      deductible: String(body.deductible || ""),
      value: String(body.total_price || ""),
    });
    const base = process.env.NEXT_PUBLIC_SITE_URL || "https://poweredgetx.com";
    const signUrl = `${base}/sign/${draft.token}`;

    /*
     * Send it to the homeowner ourselves.
     *
     * The link used to come back to the rep to text from their own phone,
     * which put the agreement on a personal number, left no record that it
     * was ever sent, and relied on a rep in a truck remembering to do it.
     * We have had their email since step one of the form.
     *
     * The draft is already saved, so a mail failure must not fail the call.
     * It comes back as emailed:false with the reason, the rep sees it on the
     * screen, and they can resend or fall back to the link.
     */
    const to = String(body.owner_email || "").trim();
    let emailed = false;
    let emailError: string | null = null;
    if (!to) {
      emailError = "No email address on the agreement.";
    } else if (!process.env.RESEND_API_KEY) {
      emailError = "Email is not configured.";
    } else {
      const r = await sendAgreementToSign(process.env.RESEND_API_KEY, {
        ownerNames: String(body.owner_names || ""),
        address: String(body.property_address || ""),
        email: to,
        url: signUrl,
        rep: String(body.rep || u.name || ""),
        total: String(body.total_price || ""),
        claimBased: body.claim_based !== false,
        carrier: String(body.carrier || ""),
        claimNumber: String(body.claim_number || ""),
        deductible: String(body.deductible || ""),
        scope,
      });
      emailed = !!r?.ok;
      if (emailed) {
        await markSent(draft.id);
      } else {
        emailError = "The email did not go through.";
      }
    }

    // Put it on the record either way. "We sent it" and "we tried and it
    // bounced" are both things the office needs to see on the job.
    await noteOnJobForContract(
      String(body.property_address || ""),
      emailed
        ? `Agreement emailed to ${to}`
        : `Agreement NOT emailed (${emailError}). Link: ${signUrl}`,
      String(body.rep || u.name || ""),
    );

    return NextResponse.json({
      ok: true,
      mode: "send",
      id: draft.id,
      signUrl,
      emailed,
      emailedTo: to || null,
      emailError,
    });
  }

  const saved = await saveContract({
    rep: String(body.rep || u.name || ""),
    owner_names: String(body.owner_names || ""),
    owner_phone: String(body.owner_phone || ""),
    owner_email: String(body.owner_email || ""),
    property_address: String(body.property_address || ""),
    scope,
    total_price: String(body.total_price || ""),
    claim_based: body.claim_based !== false,
    carrier: String(body.carrier || ""),
    claim_number: String(body.claim_number || ""),
    deductible: String(body.deductible || ""),
    signature_png: String(body.signature_png || ""),
    signer_name: String(body.signer_name || ""),
    ip: clientIp(req),
  });

  if (!saved.ok) {
    return NextResponse.json({ ok: false, error: saved.error }, { status: 400 });
  }

  // The homeowner's copy carries the cancellation notice with the real
  // deadline. Best-effort: the agreement is already saved, and a rep standing
  // in a driveway should not see a failure for something they cannot fix.
  let emailed = false;
  const to = String(body.owner_email || "").trim();
  const key = process.env.RESEND_API_KEY;
  if (to && key) {
    const r = await sendSignedAgreement(key, {
      id: saved.id,
      ownerNames: String(body.owner_names || ""),
      address: String(body.property_address || ""),
      email: to,
      scope,
      total: String(body.total_price || ""),
      claimBased: body.claim_based !== false,
      carrier: String(body.carrier || ""),
      claimNumber: String(body.claim_number || ""),
      deductible: String(body.deductible || ""),
      signedOn: fmtDate(new Date()),
      cancelBy: fmtDate(saved.deadline),
    });
    emailed = !!r?.ok;
    if (emailed) await markEmailed(saved.id);
  }

  /*
   * Reps no longer hand over printed cancellation notices (Parker,
   * 2026-11-10). The agreement carries the notice in full and the emailed
   * copy repeats it with the deadline, so there is nothing left to attest to.
   * Kept accepting the flag for older clients mid-deploy; it writes the same
   * column it always did.
   */
  if (body.notices_delivered === true) await markNoticesDelivered(saved.id);

  await linkJobForContract({
    contractId: saved.id,
    stage: "signed",
    address: String(body.property_address || ""),
    owner: String(body.owner_names || ""),
    phone: String(body.owner_phone || ""),
    email: String(body.owner_email || ""),
    rep: String(body.rep || u.name || ""),
    claim: body.claim_based !== false,
    carrier: String(body.carrier || ""),
    claimNumber: String(body.claim_number || ""),
    deductible: String(body.deductible || ""),
    value: String(body.total_price || ""),
  });

  return NextResponse.json({
    ok: true,
    id: saved.id,
    cancelBy: fmtDate(saved.deadline),
    emailed,
  });
}
