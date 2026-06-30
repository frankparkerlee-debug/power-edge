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

  // Temporary diagnostic — reports why lead emails aren't arriving, without
  // exposing the key. Remove after debugging.
  if (body.debug) {
    const key = process.env.RESEND_API_KEY;
    const toAddr = process.env.LEAD_TO_EMAIL || site.email;
    let status: number | null = null;
    let respBody: string | null = null;
    if (key) {
      try {
        const r = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${key}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: `PowerEdge Site <leads@${site.domain}>`,
            to: [toAddr],
            subject: "PowerEdge lead-email diagnostic",
            html: "<p>Diagnostic test send.</p>",
          }),
        });
        status = r.status;
        respBody = (await r.text()).slice(0, 300);
      } catch (e) {
        respBody = String(e);
      }
    }
    return NextResponse.json({
      resendKeyPresent: !!key,
      leadToEmail: toAddr,
      fromDomain: site.domain,
      audienceIdPresent: !!process.env.RESEND_AUDIENCE_ID,
      webhookPresent: !!process.env.LEAD_WEBHOOK_URL,
      resendStatus: status,
      resendResponse: respBody,
    });
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
    // Attribution — so you know which page/campaign produced the lead.
    page_path: (body.page_path || "").trim(),
    referrer: (body.referrer || "").trim(),
    utm_source: (body.utm_source || "").trim(),
    utm_medium: (body.utm_medium || "").trim(),
    utm_campaign: (body.utm_campaign || "").trim(),
    gclid: (body.gclid || "").trim(),
    receivedAt: new Date().toISOString(),
  };

  const sourceLine =
    [lead.utm_source, lead.utm_medium, lead.utm_campaign].filter(Boolean).join(" / ") ||
    lead.referrer ||
    "direct";

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
            <hr/>
            <p><strong>Source:</strong> ${escapeHtml(sourceLine)}</p>
            <p><strong>Page:</strong> ${escapeHtml(lead.page_path) || "—"}</p>
            <p style="color:#888">Received ${lead.receivedAt}</p>
          `,
        }),
      });
    } catch (err) {
      console.error("[lead] email send failed", err);
    }

    // 1b. Instant auto-response to the CUSTOMER (speed-to-lead — sets
    // expectations, reduces re-shopping). Only when they gave an email.
    if (lead.email) {
      try {
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${resendKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: `PowerEdge <hello@${site.domain}>`,
            to: [lead.email],
            replyTo: site.email,
            subject: "We've got your request — PowerEdge",
            html: `
              <p>Hi ${escapeHtml(lead.name.split(" ")[0] || "there")},</p>
              <p>Thanks for reaching out to ${site.legalName}. We've received your request${lead.service ? ` about <strong>${escapeHtml(lead.service)}</strong>` : ""} and a licensed member of our team will call you shortly — usually within the hour during business hours.</p>
              <p>Need us sooner? Call or text <strong>${site.textNumber}</strong>.</p>
              <p>— PowerEdge · Licensed TX electrical contractor (TECL #${site.teclLicense}) · ${site.serviceArea}</p>
              <p style="color:#888;font-size:12px">You're receiving this because you requested contact at ${site.domain}.</p>
            `,
          }),
        });
      } catch (err) {
        console.error("[lead] customer auto-response failed", err);
      }

      // 1c. Add the lead to the Resend audience for nurture campaigns.
      const audienceId = process.env.RESEND_AUDIENCE_ID;
      if (audienceId) {
        try {
          await fetch(`https://api.resend.com/audiences/${audienceId}/contacts`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${resendKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              email: lead.email,
              first_name: lead.name.split(" ")[0] || "",
              last_name: lead.name.split(" ").slice(1).join(" ") || "",
              unsubscribed: false,
            }),
          });
        } catch (err) {
          console.error("[lead] audience add failed", err);
        }
      }
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

  // --- 3. Lead webhook -------------------------------------------------------
  // Fire the full lead to a webhook (e.g. a Zapier "Catch Hook") so it can
  // trigger an INSTANT auto-text to the customer via CallRail (Message Flow /
  // Messaging) or any other automation. Speed-to-lead by SMS beats email.
  // Set LEAD_WEBHOOK_URL to a Zapier catch-hook (or Make/n8n) URL.
  const webhook = process.env.LEAD_WEBHOOK_URL;
  if (webhook) {
    try {
      await fetch(webhook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(lead),
      });
    } catch (err) {
      console.error("[lead] webhook failed", err);
    }
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
