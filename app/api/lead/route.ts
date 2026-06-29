import { NextResponse } from "next/server";
import { site } from "@/lib/site";

/**
 * Lead handler.
 *
 * Routes every web lead two ways (per the chosen "Email + Jobber" setup):
 *   1. Emails the team instantly (via Resend if RESEND_API_KEY is set).
 *   2. Creates a request in Jobber (via JOBBER_* env vars — see TODO below).
 *
 * Until those env vars are populated it still accepts the lead and logs it,
 * so the form works in dev and never drops a customer.
 *
 * Required env (set in .env.local / hosting dashboard):
 *   RESEND_API_KEY        - Resend API key for transactional email
 *   LEAD_TO_EMAIL         - where leads are emailed (defaults to site.email)
 *   JOBBER_API_TOKEN      - Jobber GraphQL API access token (OAuth)
 *   (Jobber wiring is stubbed below — drop in the GraphQL mutation when ready.)
 */

export async function POST(req: Request) {
  let body: Record<string, string>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  // Honeypot: if the hidden field is filled, silently accept and drop.
  if (body.company_website) {
    return NextResponse.json({ ok: true });
  }

  const name = (body.name || "").trim();
  const phone = (body.phone || "").trim();
  if (!name || !phone) {
    return NextResponse.json(
      { error: "Name and phone are required" },
      { status: 422 },
    );
  }

  const lead = {
    name,
    phone,
    email: (body.email || "").trim(),
    zip: (body.zip || "").trim(),
    service: (body.service || "").trim(),
    message: (body.message || "").trim(),
    receivedAt: new Date().toISOString(),
  };

  // --- 1. Email notification -------------------------------------------------
  const resendKey = process.env.RESEND_API_KEY;
  const to = process.env.LEAD_TO_EMAIL || site.email;
  if (resendKey) {
    try {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: `PowerEdge Site <leads@${site.domain}>`,
          to: [to],
          subject: `New lead: ${lead.name} — ${lead.service || "general"}`,
          html: `
            <h2>New website lead</h2>
            <p><strong>Name:</strong> ${escapeHtml(lead.name)}</p>
            <p><strong>Phone:</strong> ${escapeHtml(lead.phone)}</p>
            <p><strong>Email:</strong> ${escapeHtml(lead.email) || "—"}</p>
            <p><strong>ZIP:</strong> ${escapeHtml(lead.zip) || "—"}</p>
            <p><strong>Service:</strong> ${escapeHtml(lead.service) || "—"}</p>
            <p><strong>Message:</strong> ${escapeHtml(lead.message) || "—"}</p>
            <p style="color:#888">Received ${lead.receivedAt}</p>
          `,
        }),
      });
    } catch (err) {
      console.error("[lead] email send failed", err);
    }
  } else {
    console.log("[lead] (no RESEND_API_KEY — logging only)", lead);
  }

  // --- 2. Jobber request -----------------------------------------------------
  // TODO(parker): wire the Jobber GraphQL `clientCreate` + `requestCreate`
  // mutations here once the OAuth token is available. Jobber uses a GraphQL API
  // at https://api.getjobber.com/api/graphql with a bearer token. Keeping the
  // shape ready so it's a drop-in.
  if (process.env.JOBBER_API_TOKEN) {
    // await createJobberRequest(lead);
  }

  return NextResponse.json({ ok: true });
}

function escapeHtml(s: string) {
  return s.replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[c] || c,
  );
}
