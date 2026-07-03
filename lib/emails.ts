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
  existing?: boolean; // true = already-on-the-list backfill (re-intro opener)
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

function steps(items: string[]) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 18px;">
    ${items
      .map(
        (step, i) => `<tr>
          <td width="36" valign="top" style="padding:7px 0;">
            <span style="display:inline-block;width:26px;height:26px;background:${LIME};color:${INK};border-radius:13px;text-align:center;line-height:26px;font-weight:800;font-size:14px;font-family:${FONT};">${i + 1}</span>
          </td>
          <td valign="top" style="padding:9px 0;font-family:${FONT};font-size:15px;line-height:1.5;color:${TEXT};">${step}</td>
        </tr>`,
      )
      .join("")}
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
  // 0 — Instant confirmation (or re-intro for existing subscribers)
  {
    key: "confirm",
    delayDays: 0,
    subject: (c) =>
      c.existing
        ? "A quick hello from PowerEdge (and why it matters this season)"
        : "We've got it — your free roof inspection with PowerEdge",
    html: (c) =>
      c.existing
        ? shell({
            preheader:
              "DFW's insurance-first storm roof team — here's the 2-minute version.",
            body:
              h1(`Hi ${c.firstName} — a quick refresher.`) +
              p(
                `You&rsquo;re on our list, so here&rsquo;s the short version of who we are: <strong>DFW&rsquo;s insurance-first storm roof team</strong>. When hail hits, you typically pay just your deductible — we document the damage, coordinate with your adjuster by the book, and can even handle your solar.`,
              ) +
              p(
                `Over the next couple weeks we&rsquo;ll show you exactly how it works. Want to skip the line? See if your roof already has a claim:`,
              ) +
              button("Check if I have a claim", BOOK_URL) +
              verifyChip(),
          })
        : shell({
            preheader:
              "A licensed member of our team will call you shortly to schedule.",
            body:
              h1(`Thanks, ${c.firstName} — we're on it.`) +
              p(
                `We&rsquo;ve got your request${
                  c.service ? ` about <strong>${c.service}</strong>` : ""
                }. A licensed member of our team will call you shortly — usually within the hour during business hours — to lock in your <strong>free inspection</strong>.`,
              ) +
              steps([
                "We call you to schedule — fast.",
                "We inspect &amp; document your roof, free.",
                "You decide. No pressure, no games.",
              ]) +
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
    subject: () => "Your hail claim, in 4 simple steps",
    html: (c) =>
      shell({
        preheader: "You pay your deductible. We document the rest. No games.",
        body:
          h1("How your claim works — 4 steps.") +
          p("No mystery. Here&rsquo;s exactly how a Texas storm claim goes:") +
          steps([
            "<strong>Free inspection.</strong> We photograph and document the damage.",
            "<strong>You file.</strong> We meet your adjuster on-site and document the full scope.",
            "<strong>Insurance covers the replacement.</strong> You pay only your deductible.",
            "<strong>We install.</strong> On replacement-cost policies the balance comes once work begins.",
          ]) +
          p(
            `We never waive your deductible or pose as your adjuster — both are illegal in Texas, and doing it right protects you.`,
          ) +
          (c.financing
            ? p(`Deductible in the way? We can finance it — from as little as $250 down, paid in full over time.`)
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

  // 4 — Deductible financing (the money objection)
  {
    key: "deductible-financing",
    delayDays: 5,
    subject: () => "The deductible isn't the wall you think it is",
    html: () =>
      shell({
        preheader: "Finance it from $250 down, and get the roof done now.",
        body:
          h1("Short on the deductible? That's not a dead end.") +
          p(
            `Texas wind/hail deductibles run 1&ndash;2% of your home&rsquo;s value — often <strong>$5,000&ndash;$10,000</strong>. If that number is the only thing between you and a sound roof, here&rsquo;s the fix:`,
          ) +
          steps([
            "<strong>Finance your deductible</strong> — from as little as $250 down, low monthly payments.",
            "<strong>We schedule the work now</strong> — you don&rsquo;t wait to save up.",
            "<strong>You still pay it in full</strong>, just over time. (Waiving it is illegal in Texas; financing is smart.)",
          ]) +
          p(`Already have an estimate from another roofer? Bring it — we can do the work and finance it.`) +
          button("See my deductible financed", FINANCE_URL) +
          verifyChip(),
      }),
  },

  // 5 — Urgency: you can lose the claim
  {
    key: "claim-clock",
    delayDays: 8,
    subject: () => "Wait too long and you lose the claim entirely",
    html: (c) =>
      shell({
        preheader:
          "Texas claims expire — then the whole roof comes out of your pocket.",
        body:
          h1("Don't lose your claim to the clock.") +
          p(
            `Here&rsquo;s the part no one warns you about: Texas policies give you a limited window to file — <strong>often about a year from the date of the storm</strong>. Miss it, and the claim is gone for good. At that point the <strong>entire roof</strong> comes out of your pocket — not just your deductible.`,
          ) +
          p(
            `And the damage doesn&rsquo;t wait for you. Every rain turns a small bruise into a bigger leak — and an aging roof can quietly slip from full-replacement to depreciated coverage, paying you thousands less.`,
          ) +
          p(
            `If you think a storm hit your roof, don&rsquo;t sit on it. Check whether you still qualify — it takes about a minute.`,
          ) +
          button("Check if I still have a claim", BOOK_URL) +
          small(
            `Deductible the holdup? <a href="${FINANCE_URL}" style="color:${LIME_DEEP};font-weight:700;text-decoration:none;">See it financed, from $250 down &rarr;</a>`,
          ) +
          verifyChip(),
      }),
  },

  // 6 — Witty re-engagement
  {
    key: "did-we-lose-you",
    delayDays: 12,
    subject: () => "Did we lose you?",
    html: (c) =>
      shell({
        preheader: "Your roof's still up there. We checked.",
        body:
          h1(`Did we lose you, ${c.firstName}?`) +
          p(
            `We&rsquo;ve knocked on your inbox a few times and heard&hellip; crickets. Which means one of three things:`,
          ) +
          steps([
            "Your roof is flawless — genuinely, congrats.",
            "You&rsquo;re already handling it.",
            "Life got loud and the hail slipped your mind.",
          ]) +
          p(
            `If it&rsquo;s that last one, no judgment — but the storm clock keeps ticking. Sixty seconds tells you whether you&rsquo;ve still got a claim, and then we&rsquo;ll quiet down.`,
          ) +
          button("Check my roof — 60 seconds", BOOK_URL) +
          verifyChip(),
      }),
  },

  // 7 — Trust / objection (witty)
  {
    key: "storm-chaser",
    delayDays: 17,
    subject: () => "About the guy in the pickup with the clipboard",
    html: (c) =>
      shell({
        preheader: "Texas doesn't license roofers. We're the one you can verify.",
        body:
          h1("Not every 'roofer' is a roofer.") +
          p(
            `After a storm your street fills with trucks and clipboards. The uncomfortable truth: <strong>Texas doesn&rsquo;t license roofers</strong> — a magnet sign and a ladder is the whole barrier to entry, and plenty vanish before the warranty ever matters.`,
          ) +
          p(
            `We&rsquo;re the opposite kind of company: a licensed electrical contractor (TECL #${site.teclLicense}) you can look up on the state&rsquo;s site in ten seconds, ${site.googleRating}&#9733; across ${site.googleReviewCount} reviews, one accountable crew for your whole roof${
              c.solar ? " — solar included" : ""
            }. Verify us before you trust anyone knocking.`,
          ) +
          button("Verify us, then book a free inspection", BOOK_URL) +
          verifyChip(),
      }),
  },

  // 8 — Witty last call
  {
    key: "last-call",
    delayDays: 23,
    subject: () => "Okay, we can take a hint",
    html: (c) =>
      shell({
        preheader: "Last one — the offer stands whenever you're ready.",
        body:
          h1("We'll stop crowding your inbox.") +
          p(
            `This is the part where we gracefully back off. No hard feelings — your roof&rsquo;s still up there, the free inspection still stands, and we&rsquo;re exactly one text away the day you want it.`,
          ) +
          p(
            `If a storm ever does a number on your roof, you know who to call: the licensed crew that <em>shows you the license</em>${
              c.solar ? " and handles your solar too" : ""
            }. Until then, ${c.firstName}, take care.`,
          ) +
          button("Actually, I'm ready — book it", BOOK_URL) +
          p(`Or text <strong>${site.phone}</strong>. That&rsquo;s it. Promise.`) +
          verifyChip(),
      }),
  },
];

// ---- Enqueue the sequence via Resend scheduled sends ----------------------
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Enqueues the whole funnel for one recipient: email 0 sends now, 1..n are
 * scheduled via Resend `scheduled_at` (day-offset from now, so the timer starts
 * today). Sent SEQUENTIALLY with a throttle to stay under Resend's rate limit
 * (free tier ~2 req/s). Failures are logged, never thrown. Intended to be
 * fire-and-forget (don't block the response) — safe on Render's persistent
 * Node server. Requires RESEND_API_KEY.
 */
export async function enqueueLeadSequence(opts: {
  resendKey: string;
  to: string;
  ctx: LeadEmailCtx;
}) {
  const { resendKey, to, ctx } = opts;
  const from = `PowerEdge <hello@${site.domain}>`;
  const now = Date.now();

  for (const email of leadSequence) {
    const scheduledAt =
      email.delayDays > 0
        ? new Date(now + email.delayDays * 86400000).toISOString()
        : undefined;
    try {
      await fetch("https://api.resend.com/emails", {
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
      });
    } catch (err) {
      console.error(`[emails] failed to enqueue ${email.key} for ${to}`, err);
    }
    await sleep(600); // ~1.6/s — under Resend's 2/s free-tier limit
  }
}
