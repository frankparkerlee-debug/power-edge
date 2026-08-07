import { NextResponse } from "next/server";
import { upsertClaimIntake, type ClaimIntake } from "@/lib/db";
import { sendClaimComplete } from "@/lib/emails";
import { site } from "@/lib/site";

// Homeowner "claim prep" intake — progressive save. The wizard upserts one row
// (by id) as the homeowner advances, so partial progress persists and the
// drop-off nurture can reach people who don't finish. On completion we notify
// the team and confirm to the homeowner. We collect the homeowner's OWN claim
// info to move fast on-site — we don't file or negotiate the claim.
export async function POST(req: Request) {
  let body: Record<string, string | boolean | number>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const s = (k: string) => String(body[k] ?? "").trim();
  const id = s("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 422 });

  const completed = body.completed === true || body.completed === "true";
  const stage = Number(body.stage) || 1;

  // --- Spam guard -----------------------------------------------------------
  // The bots hammering this endpoint have a clean fingerprint: honeypot ignored,
  // instant submit, gibberish name, and a one-word address with NO house number.
  // Real storm leads always have a street number. We drop obvious bots BEFORE
  // any DB write or email, and return ok:true so bots don't learn what tripped.
  const elapsed = Number(body.form_elapsed_ms) || 0;
  const addr = s("address");
  const nameVal = s("name");
  const consonantRun = /[bcdfghjklmnpqrstvwxz]{5,}/i.test(nameVal.replace(/\s/g, ""));
  const spamReasons: string[] = [];
  if (s("company_website")) spamReasons.push("honeypot"); // hidden field bots fill
  if (elapsed > 0 && elapsed < 2500) spamReasons.push("too-fast");
  if (consonantRun) spamReasons.push("gibberish-name");
  // At the notify/complete step the address must contain a house number.
  if (completed && stage >= 2 && addr && !/\d/.test(addr)) spamReasons.push("no-street-number");
  if (spamReasons.length > 0) {
    console.warn("[claim-intake] dropped spam:", spamReasons.join(","), "| name:", nameVal);
    return NextResponse.json({ ok: true });
  }

  // Full view (defaults) — used for the notification emails.
  const intake = {
    id,
    name: s("name"),
    phone: s("phone"),
    email: s("email"),
    address: s("address"),
    cause: s("cause"),
    damage_signs: s("damage_signs"),
    roof_age: s("roof_age"),
    carrier: s("carrier"),
    policy_number: s("policy_number"),
    deductible: s("deductible"),
    coverage_type: s("coverage_type"),
    date_of_loss: s("date_of_loss"),
    filed: body.filed === true || body.filed === "yes",
    claim_number: s("claim_number"),
    mortgage_company: s("mortgage_company"),
    concerns: s("concerns"),
    best_times: s("best_times"),
    solar: body.solar === true || body.solar === "yes",
    stage,
    completed,
    updated_at: new Date().toISOString(),
  };

  // Sparse upsert — omit empty strings so a partial resend (e.g. resume from a
  // nurture email, where only contact is prefilled) never clobbers earlier
  // progressive-save answers. Booleans only when the client actually sent them.
  const payload: Record<string, unknown> = {
    id,
    stage,
    completed,
    updated_at: intake.updated_at,
  };
  const strKeys = [
    "name", "phone", "email", "address", "cause", "damage_signs", "roof_age",
    "carrier", "policy_number", "deductible", "coverage_type", "date_of_loss",
    "claim_number", "mortgage_company", "concerns", "best_times",
  ] as const;
  for (const k of strKeys) {
    const v = intake[k];
    if (v) payload[k] = v;
  }
  if ("filed" in body) payload.filed = intake.filed;
  if ("solar" in body) payload.solar = intake.solar;

  await upsertClaimIntake(payload as ClaimIntake);

  // Notify only at the booking step (stage 2) — the optional policy step
  // (stage 3) upserts silently so we don't double-email.
  if (completed && stage === 2) {
    const resendKey = process.env.RESEND_API_KEY;
    if (resendKey) {
      const to = process.env.LEAD_TO_EMAIL || site.email;
      const row = (l: string, v: string) =>
        `<p style="margin:2px 0"><strong>${l}:</strong> ${esc(v) || "—"}</p>`;
      // Team notification (full intake).
      fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: `PowerEdge Site <leads@${site.domain}>`,
          to: [to],
          subject: `Claim prep COMPLETE: ${intake.name}${intake.solar ? " ☀️ SOLAR" : ""}`,
          html: `
            <h2>Homeowner completed claim prep — crew can inspect &amp; close on-site</h2>
            ${row("Name", intake.name)}${row("Phone", intake.phone)}${row("Email", intake.email)}
            ${row("Property", intake.address)}
            ${row("Cause", intake.cause)}${row("What they see", intake.damage_signs)}
            ${row("Roof age", intake.roof_age)}${row("Best times", intake.best_times)}<hr/>
            ${row("Carrier", intake.carrier)}${row("Policy #", intake.policy_number)}
            ${row("Deductible", intake.deductible)}${row("Coverage", intake.coverage_type)}
            ${row("Date of loss", intake.date_of_loss)}
            <p style="margin:2px 0"><strong>Already filed:</strong> ${intake.filed ? "Yes" : "No"}</p>
            ${row("Claim #", intake.claim_number)}${row("Mortgage co.", intake.mortgage_company)}
            ${row("Areas of concern", intake.concerns)}
            <p style="margin:2px 0"><strong>Solar:</strong> ${intake.solar ? "Yes — panels" : "—"}</p>
          `,
        }),
      }).catch((e) => console.error("[claim-intake] team email failed", e));

      // Customer confirmation.
      if (intake.email) {
        void sendClaimComplete(resendKey, intake.email, intake.name).catch((e) =>
          console.error("[claim-intake] customer email failed", e),
        );
      }
    }
  }

  return NextResponse.json({ ok: true });
}

function esc(str: string) {
  return str.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ] || c,
  );
}
