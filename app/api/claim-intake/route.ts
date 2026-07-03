import { NextResponse } from "next/server";
import { insertClaimIntake } from "@/lib/db";
import { site } from "@/lib/site";

// Homeowner "claim prep" intake — the details that let the crew arrive ready to
// inspect, photograph, and close instead of doing paperwork on the doorstep.
// Stored in Supabase + emailed to the team. We collect the homeowner's OWN
// insurance info to move fast — we don't file or negotiate the claim.
export async function POST(req: Request) {
  let body: Record<string, string | boolean>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const s = (k: string) => String(body[k] ?? "").trim();
  const intake = {
    name: s("name"),
    phone: s("phone"),
    email: s("email"),
    address: s("address"),
    carrier: s("carrier"),
    policy_number: s("policy_number"),
    deductible: s("deductible"),
    date_of_loss: s("date_of_loss"),
    filed: body.filed === true || body.filed === "yes",
    claim_number: s("claim_number"),
    mortgage_company: s("mortgage_company"),
    concerns: s("concerns"),
    best_times: s("best_times"),
    solar: body.solar === true || body.solar === "yes",
  };

  if (!intake.name || !intake.phone) {
    return NextResponse.json(
      { error: "Name and phone are required" },
      { status: 422 },
    );
  }

  await insertClaimIntake(intake);

  const resendKey = process.env.RESEND_API_KEY;
  if (resendKey) {
    const to = process.env.LEAD_TO_EMAIL || site.email;
    const row = (label: string, val: string) =>
      `<p style="margin:2px 0"><strong>${label}:</strong> ${esc(val) || "—"}</p>`;
    fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `PowerEdge Site <leads@${site.domain}>`,
        to: [to],
        subject: `Claim prep ready: ${intake.name}${intake.solar ? " ☀️ SOLAR" : ""}`,
        html: `
          <h2>Homeowner completed claim prep — crew can inspect &amp; close on-site</h2>
          ${row("Name", intake.name)}${row("Phone", intake.phone)}${row("Email", intake.email)}
          ${row("Property", intake.address)}
          <hr/>
          ${row("Carrier", intake.carrier)}${row("Policy #", intake.policy_number)}
          ${row("Deductible", intake.deductible)}${row("Date of loss", intake.date_of_loss)}
          <p style="margin:2px 0"><strong>Already filed:</strong> ${intake.filed ? "Yes" : "No"}</p>
          ${row("Claim #", intake.claim_number)}${row("Mortgage co.", intake.mortgage_company)}
          ${row("Areas of concern", intake.concerns)}${row("Best times", intake.best_times)}
          <p style="margin:2px 0"><strong>Solar:</strong> ${intake.solar ? "Yes — panels" : "—"}</p>
        `,
      }),
    }).catch((e) => console.error("[claim-intake] email failed", e));
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
