import { NextResponse } from "next/server";
import { plaid, plaidConfig } from "@/lib/plaid";
import { enqueueLeadSequence } from "@/lib/emails";
import { insertLead } from "@/lib/db";
import { site } from "@/lib/site";

// Phase 1 underwrite: exchange the Link public_token, pull identity + balances +
// auth, and return an instant structure-based decision (no credit pull). Emails
// the full intel to the team (account numbers masked) and enrolls the lead in
// the financing nurture. Access token is used transiently and NOT stored —
// persistence + recurring ACH debits are Phase 2 (needs a DB + Plaid Transfer).

type Balances = { available: number | null; current: number | null };
type Account = {
  account_id: string;
  name: string;
  mask?: string | null;
  type: string;
  subtype?: string | null;
  balances: Balances;
};
type Owner = {
  names?: string[];
  emails?: { data: string }[];
  phone_numbers?: { data: string }[];
};

const digits = (s: string) => (s.match(/\d/g) || []).join("");
const norm = (s: string) => s.toLowerCase().replace(/[^a-z ]/g, " ").trim();

export async function POST(req: Request) {
  if (!plaidConfig().enabled) {
    return NextResponse.json({ error: "Plaid not configured" }, { status: 501 });
  }

  let body: Record<string, string>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  if (!body.public_token) {
    return NextResponse.json({ error: "Missing public_token" }, { status: 400 });
  }

  const requested = Number(digits(body.amount || "")) || 0;

  try {
    const { access_token } = await plaid<{ access_token: string }>(
      "/item/public_token/exchange",
      { public_token: body.public_token },
    );

    const [balRes, idRes, authRes] = await Promise.allSettled([
      plaid<{ accounts: Account[] }>("/accounts/balance/get", { access_token }),
      plaid<{ accounts: { owners: Owner[] }[] }>("/identity/get", {
        access_token,
      }),
      plaid<{
        numbers: { ach: { account_id: string; account: string; routing: string }[] };
      }>("/auth/get", { access_token }),
    ]);

    const accounts =
      balRes.status === "fulfilled" ? balRes.value.accounts : [];
    const owners: Owner[] =
      idRes.status === "fulfilled"
        ? idRes.value.accounts.flatMap((a) => a.owners || [])
        : [];
    const ach =
      authRes.status === "fulfilled" ? authRes.value.numbers.ach : [];

    const depository = accounts.filter((a) => a.type === "depository");
    const totalAvailable = depository.reduce(
      (sum, a) => sum + (a.balances.available ?? a.balances.current ?? 0),
      0,
    );

    // Name match: any token (3+ chars) shared between provided name and owners.
    const providedTokens = norm(body.name || "")
      .split(/\s+/)
      .filter((t) => t.length >= 3);
    const ownerText = norm(owners.flatMap((o) => o.names || []).join(" "));
    const nameMatch =
      providedTokens.length > 0 &&
      providedTokens.some((t) => ownerText.includes(t));

    const approved =
      depository.length > 0 &&
      nameMatch &&
      totalAvailable >= Math.max(requested / 4, 250);
    const decision = approved ? "approved" : "review";

    // Durable capture (no-op until SUPABASE_* set).
    await insertLead({
      name: body.name,
      phone: body.phone,
      email: body.email,
      address: body.address,
      zip: body.zip,
      service: `Financing pre-qualification (Plaid — ${decision})`,
      message: `[Plaid Prequal ${decision}] amount: $${requested.toLocaleString()}; available: $${totalAvailable.toLocaleString()}; name match: ${
        nameMatch ? "yes" : "no"
      }; property: ${body.address || "—"}`,
      source: "financing-prequal-plaid",
    });

    // --- Team intel email (account numbers masked) ------------------------
    const resendKey = process.env.RESEND_API_KEY;
    if (resendKey) {
      const to = process.env.LEAD_TO_EMAIL || site.email;
      const mask = (acc: string) => (acc ? `••••${acc.slice(-4)}` : "—");
      const routingFor = (id: string) =>
        ach.find((n) => n.account_id === id)?.routing?.slice(-4) || "—";
      const acctFor = (id: string) =>
        mask(ach.find((n) => n.account_id === id)?.account || "");
      const acctRows = accounts
        .map(
          (a) =>
            `<tr><td>${a.name} (${a.subtype || a.type})</td><td>acct ${acctFor(
              a.account_id,
            )} / rt ••${routingFor(a.account_id)}</td><td style="text-align:right">$${(
              a.balances.available ??
              a.balances.current ??
              0
            ).toLocaleString()}</td></tr>`,
        )
        .join("");
      const ownerLines = owners
        .flatMap((o) => o.names || [])
        .slice(0, 4)
        .join(", ");
      fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: `PowerEdge Site <leads@${site.domain}>`,
          to: [to],
          subject: `Financing pre-qual (${decision.toUpperCase()}): ${body.name} — $${requested.toLocaleString()}`,
          html: `
            <h2>Plaid pre-qualification — ${decision.toUpperCase()}</h2>
            <p><strong>${escapeHtml(body.name || "")}</strong> · ${escapeHtml(body.phone || "")} · ${escapeHtml(body.email || "")}</p>
            <p>Property: ${escapeHtml(body.address || "—")} ${escapeHtml(body.zip || "")}</p>
            <p><strong>Requested:</strong> $${requested.toLocaleString()} ·
               <strong>Total available:</strong> $${totalAvailable.toLocaleString()} ·
               <strong>Name match:</strong> ${nameMatch ? "yes" : "NO — review"}</p>
            <p><strong>Bank owner(s) on file:</strong> ${escapeHtml(ownerLines) || "—"}</p>
            <table border="0" cellpadding="6" style="border-collapse:collapse;font-size:13px">
              <tr style="text-align:left"><th>Account</th><th>Numbers (masked)</th><th>Available</th></tr>
              ${acctRows}
            </table>
            <p style="color:#888;font-size:12px">Sandbox/Phase-1 decision — structure-based, no credit pull. Token not stored; set up the debit via Plaid Transfer (Phase 2).</p>
          `,
        }),
      }).catch((e) => console.error("[plaid] intel email failed", e));

      // Enroll the (high-intent) lead in the financing nurture.
      if (body.email) {
        void enqueueLeadSequence({
          resendKey,
          to: body.email,
          ctx: {
            firstName: (body.name || "there").split(" ")[0],
            service: "Financing pre-qualification",
            financing: true,
          },
        }).catch((e) => console.error("[plaid] sequence failed", e));
      }
    }

    return NextResponse.json({
      ok: true,
      decision,
      plan: approved ? "4-month (0%) or 12-month plan" : null,
      message: approved
        ? "You're pre-approved, pending final verification. We'll set up your plan and schedule the work."
        : "Thanks — we've got everything and a team member will confirm your options shortly.",
    });
  } catch (err) {
    console.error("[plaid] underwrite failed", err);
    return NextResponse.json(
      { error: "Could not complete the check" },
      { status: 502 },
    );
  }
}

function escapeHtml(s: string) {
  return s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ] || c,
  );
}
