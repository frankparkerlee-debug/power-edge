import { NextResponse } from "next/server";
import { saveContract, createDraft, markNoticesDelivered, fmtDate, type ScopeLine } from "@/lib/contracts";
import { markEmailed } from "@/lib/contracts";
import { sendSignedAgreement } from "@/lib/emails";
import { clientIp } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const token = req.headers.get("x-admin-token");
  if (!process.env.ADMIN_TOKEN || token !== process.env.ADMIN_TOKEN) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
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
      rep: String(body.rep || ""),
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
    const base = process.env.NEXT_PUBLIC_SITE_URL || "https://poweredgetx.com";
    return NextResponse.json({
      ok: true,
      mode: "send",
      id: draft.id,
      signUrl: `${base}/sign/${draft.token}`,
    });
  }

  const saved = await saveContract({
    rep: String(body.rep || ""),
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
      signedOn: fmtDate(new Date()),
      cancelBy: fmtDate(saved.deadline),
    });
    emailed = !!r?.ok;
    if (emailed) await markEmailed(saved.id);
  }

  // The rep confirms they handed over the two printed cancellation notices.
  // Chapter 601 wants them furnished in duplicate with the contract; the email
  // is strong evidence but not clearly a substitute, so we record the paper too.
  if (body.notices_delivered === true) await markNoticesDelivered(saved.id);

  return NextResponse.json({
    ok: true,
    id: saved.id,
    cancelBy: fmtDate(saved.deadline),
    emailed,
  });
}
