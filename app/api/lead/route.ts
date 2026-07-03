import { NextResponse } from "next/server";
import { site } from "@/lib/site";
import { enqueueLeadSequence } from "@/lib/emails";
import { insertLead } from "@/lib/db";

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
    address: (body.address || "").trim(),
    zip: (body.zip || "").trim(),
    service: (body.service || "").trim(),
    message: (body.message || "").trim(),
    // Which on-site form/tool produced this (e.g. roof-claim-check). From
    // leadContext({tool}); shown in the dashboard so you know where they signed up.
    tool: (body.tool || "").trim(),
    // Solar flag — set by the "I have solar panels" qualifier on every form.
    // Tells the team to scope detach & reset, document the panels, and add the
    // claimable D&R supplement line (the ~$3–10k most roofers miss).
    solar: body.solar === "yes" ? "yes" : "",
    // Attribution — so you know which page/campaign produced the lead.
    page_path: (body.page_path || "").trim(),
    referrer: (body.referrer || "").trim(),
    utm_source: (body.utm_source || "").trim(),
    utm_medium: (body.utm_medium || "").trim(),
    utm_campaign: (body.utm_campaign || "").trim(),
    gclid: (body.gclid || "").trim(),
    receivedAt: new Date().toISOString(),
  };

  // Marketing acquisition source (how they reached the site).
  const marketing =
    [lead.utm_source, lead.utm_medium, lead.utm_campaign].filter(Boolean).join(" / ") ||
    lead.referrer ||
    "direct";
  // Where on the SITE they signed up — the form/tool or page path. This is what
  // the team wants to see; marketing source is appended only when it's not direct.
  const origin = lead.tool || lead.page_path || "";
  const sourceLine = origin
    ? marketing === "direct"
      ? origin
      : `${origin} · ${marketing}`
    : marketing;

  // --- 0. Durable capture (Supabase) — first, so no lead is lost to an email
  // hiccup. No-ops until SUPABASE_* env is set. Best-effort (never throws).
  await insertLead({
    name: lead.name,
    phone: lead.phone,
    email: lead.email,
    address: lead.address,
    zip: lead.zip,
    service: lead.service,
    message: lead.message,
    solar: lead.solar === "yes",
    source: sourceLine,
    page_path: lead.page_path,
    referrer: lead.referrer,
    utm_source: lead.utm_source,
    utm_medium: lead.utm_medium,
    utm_campaign: lead.utm_campaign,
    gclid: lead.gclid,
  });

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
          subject: `New lead: ${lead.name} — ${lead.service || "general"}${
            lead.solar === "yes" ? " ☀️ SOLAR" : ""
          }`,
          html: `
            <h2>New website lead</h2>
            ${
              lead.solar === "yes"
                ? `<p style="background:#fff3cd;border:1px solid #ffe08a;border-radius:8px;padding:12px 14px;margin:0 0 12px"><strong>☀️ SOLAR HOME</strong> — scope the panel <strong>detach &amp; reset</strong>, photograph the array, and add the D&amp;R supplement line to the claim (the ~$3–10k most roofers miss).</p>`
                : ""
            }
            <p><strong>Name:</strong> ${escapeHtml(lead.name)}</p>
            <p><strong>Phone:</strong> ${escapeHtml(lead.phone)}</p>
            <p><strong>Email:</strong> ${escapeHtml(lead.email) || "—"}</p>
            <p><strong>Address:</strong> ${escapeHtml(lead.address) || "—"}</p>
            <p><strong>Service:</strong> ${escapeHtml(lead.service) || "—"}</p>
            <p><strong>Solar:</strong> ${lead.solar === "yes" ? "Yes — has panels" : "—"}</p>
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

    // 1b. Kick off the CUSTOMER nurture funnel — a designed 5-touch sequence
    // (instant confirmation + 4 follow-ups) enqueued via Resend scheduled
    // sends. Speed-to-lead + nurture in one shot, no DB/cron. Only when they
    // gave an email.
    if (lead.email) {
      const financing = /financ|stuck|out-of-pocket|out of pocket/i.test(
        lead.service,
      );
      // Fire-and-forget: the throttled sequence runs in the background on
      // Render's persistent server so the form returns immediately.
      void enqueueLeadSequence({
        resendKey,
        to: lead.email,
        ctx: {
          firstName: lead.name.split(" ")[0] || "there",
          service: lead.service || undefined,
          solar: lead.solar === "yes",
          financing,
        },
      }).catch((err) => console.error("[lead] sequence failed", err));

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
