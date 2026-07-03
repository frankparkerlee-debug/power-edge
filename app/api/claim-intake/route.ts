import { NextResponse } from "next/server";
import { upsertClaimIntake } from "@/lib/db";
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

  await upsertClaimIntake(intake);

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
