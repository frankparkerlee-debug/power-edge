// Branded email funnel for site leads.
//
// One capture -> a designed 5-touch nurture sequence, enqueued entirely at
// lead time via Resend's scheduled sends (`scheduled_at`) — no DB, no cron.
// Compliance: we "document and coordinate with your adjuster," never "handle /
// negotiate the claim" (public adjusting) and never waive the deductible.
//
// All templates are table-based, inline-styled HTML for email-client safety.

import { site } from "./site";

// ---- Brand tokens (email-safe) -------------------------------------------
const INK = "#0b0e13";
const INK_SOFT = "#12161d";
const LIME = "#7FFBAE";
const LIME_DEEP = "#0c7a40";
const PAPER = "#f5f6f4";
const CARD = "#ffffff";
const TEXT = "#1a1d23";
const MUTED = "#5b6472";
const LINE = "#e6e8e4";
const FONT =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

export type LeadEmailCtx = {
  firstName: string;
  service?: string;
  solar?: boolean;
  financing?: boolean;
};

// ---- Building blocks ------------------------------------------------------
function wordmark() {
  return `<span style="font-family:${FONT};font-weight:800;font-size:22px;letter-spacing:-0.5px;color:#ffffff;">power<span style="color:${LIME};">edge</span></span>`;
}

function button(label: string, href: string) {
  // Bulletproof-ish CTA button.
  return `
  <table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 4px;">
    <tr>
      <td align="center" bgcolor="${LIME}" style="border-radius:8px;">
        <a href="${href}" target="_blank"
           style="display:inline-block;padding:15px 30px;font-family:${FONT};font-size:16px;font-weight:800;color:${INK};text-decoration:none;border-radius:8px;">
          ${label}
        </a>
      </td>
    </tr>
  </table>`;
}

function stars() {
  const s = "★★★★★";
  return `<span style="color:${LIME_DEEP};font-size:15px;letter-spacing:2px;">${s}</span>
    <span style="font-family:${FONT};font-size:13px;color:${MUTED};"> ${site.googleRating} · ${site.googleReviewCount} Google reviews</span>`;
}

function verifyChip() {
  return `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:26px;border-top:1px solid ${LINE};padding-top:18px;">
    <tr>
      <td style="font-family:${FONT};font-size:13px;color:${MUTED};line-height:1.5;">
        <strong style="color:${TEXT};">Licensed in Texas — TECL #${site.teclLicense}.</strong>
        Roofing is unlicensed statewide, so anyone can knock after a storm.
        <a href="${site.tdlrVerifyUrl}" target="_blank" style="color:${LIME_DEEP};font-weight:700;text-decoration:none;">Verify us at TDLR &rarr;</a>
        <br/><span style="color:${MUTED};">${stars()}</span>
      </td>
    </tr>
  </table>`;
}

function solarBlock() {
  return `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:20px;">
    <tr>
      <td style="background:#f0fbf4;border:1px solid #bfe9cf;border-radius:8px;padding:16px 18px;font-family:${FONT};font-size:15px;color:${TEXT};line-height:1.55;">
        <strong>You told us you have solar — good.</strong> Most roofers can&rsquo;t legally
        touch your panels, so they sub it out. We detach &amp; reset them in-house under our
        electrical license, and it&rsquo;s usually a covered line item on your claim. One
        crew, one warranty, no finger-pointing.
      </td>
    </tr>
  </table>`;
}

/** Wrap body content in the branded shell. */
function shell({
  preheader,
  body,
}: {
  preheader: string;
  body: string;
}) {
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<meta name="color-scheme" content="light only"/>
</head>
<body style="margin:0;padding:0;background:${PAPER};">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${preheader}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${PAPER};padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;">

        <!-- Header -->
        <tr><td style="background:${INK};border-radius:14px 14px 0 0;padding:22px 32px;">
          ${wordmark()}
          <div style="height:3px;width:44px;background:${LIME};margin-top:12px;border-radius:2px;"></div>
        </td></tr>

        <!-- Body -->
        <tr><td style="background:${CARD};padding:34px 32px 30px;">
          ${body}
        </td></tr>

        <!-- Footer -->
        <tr><td style="background:${INK_SOFT};border-radius:0 0 14px 14px;padding:22px 32px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr><td style="font-family:${FONT};font-size:13px;color:#9aa3b0;line-height:1.6;">
              <a href="${site.phoneHref}" style="color:#ffffff;font-weight:700;text-decoration:none;">${site.phone}</a>
              &nbsp;·&nbsp;
              <a href="${site.textHref}" style="color:#ffffff;font-weight:700;text-decoration:none;">Text us</a>
              &nbsp;·&nbsp;
              <a href="${site.url}" style="color:#9aa3b0;text-decoration:none;">${site.domain}</a>
              <br/>
              ${site.legalEntity} · TECL #${site.teclLicense} · Serving ${site.serviceArea}.
              <br/><br/>
              <span style="color:#6b7280;">You&rsquo;re receiving this because you requested contact at ${site.domain}.
              Reply <strong>STOP</strong> to opt out, or
              <a href="mailto:${site.email}?subject=Unsubscribe" style="color:#9aa3b0;text-decoration:underline;">unsubscribe</a>.</span>
            </td></tr>
          </table>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body></html>`;
}

// Shared type/link helpers
const h1 = (t: string) =>
  `<h1 style="margin:0 0 14px;font-family:${FONT};font-size:26px;line-height:1.2;font-weight:800;color:${INK};">${t}</h1>`;
const p = (t: string) =>
  `<p style="margin:0 0 16px;font-family:${FONT};font-size:16px;line-height:1.62;color:${TEXT};">${t}</p>`;
const small = (t: string) =>
  `<p style="margin:14px 0 0;font-family:${FONT};font-size:13px;line-height:1.55;color:${MUTED};">${t}</p>`;

const BOOK_URL = `${site.url}/roof-claim-check`;
const FINANCE_URL = `${site.url}/financing`;

// ---- The sequence ---------------------------------------------------------
export type SequenceEmail = {
  key: string;
  delayDays: number;
  subject: (c: LeadEmailCtx) => string;
  html: (c: LeadEmailCtx) => string;
};

export const leadSequence: SequenceEmail[] = [
  // 0 — Instant confirmation
  {
    key: "confirm",
    delayDays: 0,
    subject: () => "We've got it — your free roof inspection with PowerEdge",
    html: (c) =>
      shell({
        preheader:
          "A licensed member of our team will call you shortly to schedule.",
        body:
          h1(`Thanks, ${c.firstName} — we're on it.`) +
          p(
            `We&rsquo;ve got your request${
              c.service ? ` about <strong>${c.service}</strong>` : ""
            }. A licensed member of our team will call you shortly — usually within the hour during business hours — to lock in your <strong>free inspection</strong>.`,
          ) +
          `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:6px 0 20px;">
            ${["We call you to schedule — fast.", "We inspect &amp; document your roof, free.", "You decide. No pressure, no games."]
              .map(
                (step, i) => `<tr><td style="padding:7px 0;font-family:${FONT};font-size:15px;color:${TEXT};">
                  <span style="display:inline-block;width:24px;height:24px;background:${LIME};color:${INK};border-radius:12px;text-align:center;line-height:24px;font-weight:800;font-size:13px;margin-right:10px;">${i + 1}</span>${step}</td></tr>`,
              )
              .join("")}
          </table>` +
          p(`Can&rsquo;t wait? Call or text us at <strong>${site.phone}</strong>.`) +
          button(`Call ${site.phone}`, site.phoneHref) +
          (c.solar ? solarBlock() : "") +
          verifyChip(),
      }),
  },

  // 1 — How a Texas storm claim works
  {
    key: "how-claims-work",
    delayDays: 1,
    subject: () => "How a Texas hail claim actually works (the honest version)",
    html: (c) =>
      shell({
        preheader: "You pay your deductible. We document the rest. No games.",
        body:
          h1("Here's how your claim works — plainly.") +
          p(
            `A storm claim is where homeowners get burned by fly-by-night roofers, so here&rsquo;s the straight version:`,
          ) +
          p(
            `On a <strong>covered claim</strong>, you typically pay only your <strong>deductible</strong> — insurance covers the rest of the replacement. We <strong>document the damage and coordinate with your adjuster</strong>, by the book. We never waive your deductible and never pose as your adjuster — both are illegal in Texas, and following the law protects you.`,
          ) +
          p(
            `Replacement-cost claims usually pay in two checks — an initial amount, then the balance once work begins. We walk you through exactly what to expect.`,
          ) +
          (c.financing
            ? p(
                `And if the deductible is the thing standing in your way — <strong>we can finance it</strong>, $0 down. You still pay it in full, just over time.`,
              )
            : "") +
          button("Book my free inspection", BOOK_URL) +
          verifyChip(),
      }),
  },

  // 2 — Why PowerEdge / trust
  {
    key: "why-poweredge",
    delayDays: 3,
    subject: () => "Anyone can knock after a storm. Not everyone can prove it.",
    html: (c) =>
      shell({
        preheader: `Licensed, ${site.googleRating}★, and one crew for your whole roof.`,
        body:
          h1("Why homeowners pick PowerEdge.") +
          p(
            `Texas doesn&rsquo;t license roofers — anyone with a ladder and a magnet sign can knock your door after a hailstorm. We&rsquo;re built the opposite way:`,
          ) +
          `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:4px 0 8px;">
            ${[
              [
                "A license you can actually check",
                `TECL #${site.teclLicense}, backed by a 40-year Master Electrician. Look us up on the state&rsquo;s public portal before you sign anything.`,
              ],
              [
                "One accountable crew",
                "Roof and the electrical it touches, handled in-house — no subcontractor finger-pointing.",
              ],
              [
                "Capacity to actually show up",
                "Four crews and the scale to be there this week, not next month.",
              ],
            ]
              .map(
                ([t, d]) => `<tr><td style="padding:9px 0;border-bottom:1px solid ${LINE};font-family:${FONT};">
                  <div style="font-size:16px;font-weight:800;color:${INK};">${t}</div>
                  <div style="font-size:15px;color:${MUTED};line-height:1.5;margin-top:2px;">${d}</div></td></tr>`,
              )
              .join("")}
          </table>` +
          (c.solar ? solarBlock() : "") +
          button("Book my free inspection", BOOK_URL) +
          verifyChip(),
      }),
  },

  // 3 — Urgency + financing
  {
    key: "claim-clock",
    delayDays: 6,
    subject: () => "Your roof claim has a clock on it",
    html: (c) =>
      shell({
        preheader:
          "Texas claims have deadlines, and damage worsens with every rain.",
        body:
          h1("Don't let the window close.") +
          p(
            `Two clocks are running. First, many Texas policies require you to file within about <strong>a year of the storm</strong> — miss it and the roof&rsquo;s on you. Second, hail damage gets worse with every rain until it&rsquo;s a leak.`,
          ) +
          p(
            `The good news: on a covered claim you pay only your deductible — and if that&rsquo;s the roadblock, <strong>you can finance it, $0 down</strong>. A tight month shouldn&rsquo;t cost you a sound roof.`,
          ) +
          button("See what my deductible looks like financed", FINANCE_URL) +
          small(
            `Prefer to just get it inspected? <a href="${BOOK_URL}" style="color:${LIME_DEEP};font-weight:700;text-decoration:none;">Book your free inspection &rarr;</a>`,
          ) +
          verifyChip(),
      }),
  },

  // 4 — Soft last touch
  {
    key: "still-thinking",
    delayDays: 12,
    subject: () => "Still thinking it over?",
    html: (c) =>
      shell({
        preheader: "No pressure — we're here when you're ready.",
        body:
          h1(`No rush, ${c.firstName}.`) +
          p(
            `If you&rsquo;re still weighing it, that&rsquo;s fair. When you&rsquo;re ready, we&rsquo;ll give you an honest, free inspection — and tell you straight if your roof is fine.`,
          ) +
          p(
            `You pay your deductible, we document and coordinate with your adjuster by the book, financing&rsquo;s there if you need it${
              c.solar ? ", and we handle your solar too" : ""
            }. That&rsquo;s it.`,
          ) +
          button("Book my free inspection", BOOK_URL) +
          p(
            `Or just call or text <strong>${site.phone}</strong> — a real person picks up.`,
          ) +
          verifyChip(),
      }),
  },
];

// ---- Enqueue the sequence via Resend scheduled sends ----------------------
/**
 * Sends email 0 immediately and schedules 1..n via Resend `scheduled_at`.
 * Fully fire-and-forget; failures are logged, never thrown, so a lead is never
 * lost to an email hiccup. Requires RESEND_API_KEY.
 */
export async function enqueueLeadSequence(opts: {
  resendKey: string;
  to: string;
  ctx: LeadEmailCtx;
}) {
  const { resendKey, to, ctx } = opts;
  const from = `PowerEdge <hello@${site.domain}>`;
  const now = Date.now();

  await Promise.allSettled(
    leadSequence.map((email) => {
      const scheduledAt =
        email.delayDays > 0
          ? new Date(now + email.delayDays * 86400000).toISOString()
          : undefined;
      return fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from,
          to: [to],
          replyTo: site.email,
          subject: email.subject(ctx),
          html: email.html(ctx),
          ...(scheduledAt ? { scheduled_at: scheduledAt } : {}),
          headers: {
            "List-Unsubscribe": `<mailto:${site.email}?subject=Unsubscribe>`,
          },
          tags: [{ name: "sequence", value: email.key }],
        }),
      }).catch((err) => {
        console.error(`[emails] failed to enqueue ${email.key}`, err);
        return null;
      });
    }),
  );
}
