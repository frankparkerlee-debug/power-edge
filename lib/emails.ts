// Branded email funnel for site leads.
//
// One capture -> a designed 5-touch nurture sequence, enqueued entirely at
// lead time via Resend's scheduled sends (`scheduled_at`), no DB, no cron.
// Compliance: we "document and coordinate with your adjuster," never "handle /
// negotiate the claim" (public adjusting) and never waive the deductible.
//
// All templates are table-based, inline-styled HTML for email-client safety.

import { AsyncLocalStorage } from "node:async_hooks";
import { site } from "./site";
import { money, claimSplit } from "./money";
import { sendMail } from "@/lib/sendMail";

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
/*
 * One look for every customer email (2026-11-11):
 *
 *   - a slim ink header carrying the real logo, not typed letters;
 *   - one key panel per email holding the single fact it exists to deliver:
 *     the arrival window, the verdict, what the homeowner pays, the date they
 *     can cancel by;
 *   - hairline rows for the rest, and a button that runs full width on phones.
 *
 * Mail about a homeowner's own inspection or agreement carries no sales pitch
 * and no unsubscribe line. Those used to sit under the signed contract and
 * under "your roof is fine", which read as a form letter at exactly the
 * moments the homeowner is deciding whether we are straight with them. Only
 * marketing (the lead sequence and claim-prep nudges) keeps the trust line
 * and the unsubscribe, and every email now carries the mailing address.
 */
const LOGO_URL = `${site.url}/brand/email-logo-on-dark.png`;

function logo() {
  // Alt text is styled, so a client that blocks images still shows the name.
  return `<img src="${LOGO_URL}" width="132" height="34" alt="PowerEdge" style="display:block;border:0;outline:none;text-decoration:none;width:132px;height:34px;font-family:${FONT};font-size:20px;font-weight:800;color:#ffffff;" />`;
}

/** The phone number as a tap target that never breaks across two lines. */
function phone(color = TEXT) {
  return `<a href="${site.phoneHref}" style="color:${color};font-weight:700;text-decoration:none;white-space:nowrap;">${site.phone}</a>`;
}

/** Primary is lime and used once per email. Quiet is for change/cancel/call. */
function button(label: string, href: string, variant: "primary" | "quiet" = "primary") {
  const bg = variant === "primary" ? LIME : CARD;
  const edge = variant === "primary" ? LIME : INK;
  return `
  <table role="presentation" class="pe-btn" cellpadding="0" cellspacing="0" style="margin:24px 0 8px;">
    <tr>
      <td align="center" bgcolor="${bg}" style="background:${bg};border:2px solid ${edge};border-radius:10px;">
        <a href="${href}" target="_blank"
           style="display:inline-block;padding:14px 30px;font-family:${FONT};font-size:16px;line-height:20px;font-weight:800;color:${INK};text-decoration:none;border-radius:10px;white-space:nowrap;">
          ${label}
        </a>
      </td>
    </tr>
  </table>`;
}

/** Small green label above the headline: what kind of email this is. */
const eyebrow = (t: string) =>
  `<p style="margin:0 0 10px;font-family:${FONT};font-size:12px;line-height:16px;font-weight:800;letter-spacing:1px;text-transform:uppercase;color:${LIME_DEEP};">${t}</p>`;

/** Muted label above a block of rows. */
const section = (t: string) =>
  `<p style="margin:26px 0 8px;font-family:${FONT};font-size:12px;line-height:16px;font-weight:800;letter-spacing:1px;text-transform:uppercase;color:${MUTED};">${t}</p>`;

/** The one fact the email exists to deliver, on ink, in lime. */
function keyPanel(k: { label: string; value: string; sub?: string }) {
  return `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 22px;">
    <tr><td bgcolor="${INK}" style="background:${INK};border-radius:12px;padding:20px 22px 22px;">
      <p style="margin:0 0 8px;font-family:${FONT};font-size:12px;line-height:16px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#9aa3b0;">${k.label}</p>
      <p class="pe-key" style="margin:0;font-family:${FONT};font-size:30px;line-height:36px;font-weight:800;letter-spacing:-0.5px;color:${LIME};">${k.value}</p>
      ${k.sub ? `<p style="margin:10px 0 0;font-family:${FONT};font-size:15px;line-height:23px;color:#d6dbe1;">${k.sub}</p>` : ""}
    </td></tr>
  </table>`;
}

type Row = [label: string, value: string, strong?: boolean];

/** Label left, value right, hairlines between. Falsy rows are skipped. */
function rows(list: Array<Row | false | null | undefined | "">) {
  const r = list.filter(Boolean) as Row[];
  if (!r.length) return "";
  return `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 6px;border-top:1px solid ${LINE};">
    ${r
      .map(
        ([k, v, strong]) => `<tr>
      <td valign="top" style="padding:11px 14px 11px 0;border-bottom:1px solid ${LINE};font-family:${FONT};font-size:14px;line-height:20px;font-weight:${strong ? 700 : 400};color:${strong ? TEXT : MUTED};">${k}</td>
      <td valign="top" align="right" style="padding:11px 0;border-bottom:1px solid ${LINE};font-family:${FONT};font-size:14px;line-height:20px;font-weight:${strong ? 800 : 600};color:${TEXT};text-align:right;white-space:nowrap;">${v}</td>
    </tr>`,
      )
      .join("")}
  </table>`;
}

/** Vertical space that survives every client. */
const gap = (px: number) =>
  `<div style="height:${px}px;line-height:${px}px;font-size:1px;">&nbsp;</div>`;

/** What the inspector wrote, set apart from our own words. */
const quote = (t: string) => `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 6px;">
    <tr><td style="background:${PAPER};border-left:3px solid ${LIME_DEEP};border-radius:0 8px 8px 0;padding:14px 16px;font-family:${FONT};font-size:15px;line-height:23px;color:${TEXT};">${t}</td></tr>
  </table>`;

function steps(items: string[]) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:4px 0 14px;">
    ${items
      .map(
        (step, i) => `<tr>
          <td width="36" valign="top" style="padding:8px 0;">
            <span style="display:inline-block;width:24px;height:24px;background:${INK};color:${LIME};border-radius:12px;text-align:center;line-height:24px;font-weight:800;font-size:13px;font-family:${FONT};">${i + 1}</span>
          </td>
          <td valign="top" style="padding:9px 0;font-family:${FONT};font-size:15px;line-height:23px;color:${TEXT};">${step}</td>
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

/** Trust line. Marketing only; never under a contract or an inspection result. */
function verifyChip() {
  return `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:28px;border-top:1px solid ${LINE};">
    <tr>
      <td style="padding-top:18px;font-family:${FONT};font-size:13px;color:${MUTED};line-height:20px;">
        <strong style="color:${TEXT};">Insured &amp; accountable in Texas.</strong>
        Texas doesn&rsquo;t license roofers, so anyone can knock after a storm. We carry
        ${site.liabilityCoverage} in liability coverage and back our work with a
        ${site.workmanshipGuarantee}.
        <br/>${stars()}
      </td>
    </tr>
  </table>`;
}

/** Wrap body content in the branded shell. */
function shell({
  preheader,
  body,
  marketing = false,
}: {
  preheader: string;
  body: string;
  /** Lead sequence and nudges: adds the unsubscribe line. */
  marketing?: boolean;
}) {
  const muted = "#6b7280";
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<meta name="color-scheme" content="light only"/>
<meta name="supported-color-schemes" content="light only"/>
<style>
  @media only screen and (max-width:480px) {
    .pe-pad { padding-left:22px !important; padding-right:22px !important; }
    .pe-btn { width:100% !important; }
    .pe-btn a { display:block !important; }
    .pe-h1 { font-size:24px !important; line-height:30px !important; }
    .pe-key { font-size:27px !important; line-height:33px !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background:${PAPER};">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${preheader}&#8199;&#65279;&#847;&#8199;&#65279;&#847;&#8199;&#65279;&#847;</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${PAPER};padding:20px 10px 28px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;">

        <tr><td class="pe-pad" bgcolor="${INK}" style="background:${INK};border-radius:14px 14px 0 0;padding:20px 32px;">
          <a href="${site.url}" target="_blank" style="text-decoration:none;">${logo()}</a>
        </td></tr>

        <tr><td class="pe-pad" style="background:${CARD};border-radius:0 0 14px 14px;padding:32px 32px 34px;">
          ${body}
        </td></tr>

        <tr><td class="pe-pad" style="padding:22px 32px 0;font-family:${FONT};font-size:13px;line-height:20px;color:${muted};">
          <strong style="color:${TEXT};">PowerEdge</strong> &middot; ${site.legalEntity}<br/>
          ${site.mailingAddress}<br/>
          ${phone(muted)} &middot; <a href="${site.url}" style="color:${muted};text-decoration:none;">${site.domain}</a>
          ${
            marketing
              ? `<br/><br/>You&rsquo;re getting this because you asked about your roof at ${site.domain}.
          <a href="mailto:${site.email}?subject=Unsubscribe" style="color:${muted};text-decoration:underline;">Unsubscribe</a>, or reply STOP.`
              : ""
          }
        </td></tr>

      </table>
    </td></tr>
  </table>
</body></html>`;
}

// Shared type/link helpers
const h1 = (t: string) =>
  `<h1 class="pe-h1" style="margin:0 0 14px;font-family:${FONT};font-size:27px;line-height:33px;font-weight:800;letter-spacing:-0.4px;color:${INK};">${t}</h1>`;
const p = (t: string) =>
  `<p style="margin:0 0 16px;font-family:${FONT};font-size:16px;line-height:26px;color:${TEXT};">${t}</p>`;
const small = (t: string) =>
  `<p style="margin:14px 0 0;font-family:${FONT};font-size:14px;line-height:22px;color:${MUTED};">${t}</p>`;

const BOOK_URL = `${site.url}/roof-claim-check`;
const FINANCE_URL = `${site.url}/financing`;
const CLAIM_PREP_URL = `${site.url}/claim-prep`;

// ---- The sequence ---------------------------------------------------------
export type SequenceEmail = {
  key: string;
  delayDays: number;
  subject: (c: LeadEmailCtx) => string;
  html: (c: LeadEmailCtx) => string;
  /** Send only when this holds. Absent means everyone in the sequence. */
  when?: (c: LeadEmailCtx) => boolean;
};

/**
 * Deductible financing is an answer, not an opener (Parker, 2026-11-11).
 *
 * It is advertised on the website, where a homeowner goes looking for it. In
 * outreach it comes up only once the homeowner has said the deductible is the
 * problem; then it is how the deal gets done. c.financing is set when they told
 * us so on the lead form ("Financing, stuck on the out-of-pocket"), which is
 * exactly that signal. Every lead used to get a financing email on day 5
 * whether they had raised it or not.
 */
const raisedDeductible = (c: LeadEmailCtx) => !!c.financing;

/**
 * What the homeowner asked for, in their words.
 *
 * Lead forms send labels written for the CRM, like "Roof claim check (LIKELY
 * QUALIFIES)". The qualifier is our internal read and was being printed back
 * to the homeowner in their first email. Generic picks ("Other") say nothing,
 * so they are dropped.
 */
function serviceLabel(service?: string) {
  const s = (service || "").replace(/\s*\([^)]*\)\s*/g, " ").trim();
  if (!s || /^(other|general|not sure)$/i.test(s)) return "";
  return s;
}

/** The emails this lead should actually receive. */
export function sequenceFor(c: LeadEmailCtx): SequenceEmail[] {
  return leadSequence.filter((e) => !e.when || e.when(c));
}

export const leadSequence: SequenceEmail[] = [
  // 0, Instant confirmation (or re-intro for existing subscribers)
  {
    key: "confirm",
    delayDays: 0,
    subject: (c) =>
      c.existing
        ? "A quick hello from PowerEdge (and why it matters this season)"
        : "We've got it, your free roof inspection with PowerEdge",
    html: (c) =>
      c.existing
        ? shell({
        marketing: true,
            preheader:
              "DFW's insurance-first storm roof team, here's the 2-minute version.",
            body:
              h1(`Hi ${c.firstName}, a quick refresher.`) +
              p(
                `You&rsquo;re on our list, so here&rsquo;s the short version of who we are: <strong>DFW&rsquo;s insurance-first storm roof team</strong>. When hail hits, you typically pay just your deductible, we document the damage and coordinate with your adjuster by the book.`,
              ) +
              p(
                `Over the next couple weeks we&rsquo;ll show you exactly how it works. Want to skip the line? See if your roof already has a claim:`,
              ) +
              button("Check if I have a claim", BOOK_URL) +
              verifyChip(),
          })
        : shell({
        marketing: true,
            preheader:
              "A member of our team will call you shortly to schedule.",
            body:
              h1(`Thanks, ${c.firstName}, we're on it.`) +
              p(
                `We&rsquo;ve got your request${
                  serviceLabel(c.service) ? ` about <strong>${serviceLabel(c.service)}</strong>` : ""
                }. A member of our team will call you shortly, usually within the hour during business hours, to lock in your <strong>free inspection</strong>.`,
              ) +
              steps([
                "We call you to schedule, fast.",
                "We inspect &amp; document your roof, free.",
                "You decide. No pressure, no games.",
              ]) +
              p(`Can&rsquo;t wait? Call or text us at ${phone()}.`) +
              button(`Call ${site.phone}`, site.phoneHref) +
              p(
                `<strong>Want it done in one visit?</strong> Add your carrier and deductible ahead of time and we can do the inspection and the paperwork together. <a href="${CLAIM_PREP_URL}" style="color:${LIME_DEEP};font-weight:700;text-decoration:none;white-space:nowrap;">Prep your claim, 2 minutes &rarr;</a>`,
              ) +
              verifyChip(),
          }),
  },

  // 1, How a Texas storm claim works
  {
    key: "how-claims-work",
    delayDays: 1,
    subject: () => "Your hail claim, in 4 simple steps",
    html: (c) =>
      shell({
        marketing: true,
        preheader: "You pay your deductible. We document the rest. No games.",
        body:
          h1("How your claim works, 4 steps.") +
          p("No mystery. Here&rsquo;s exactly how a Texas storm claim goes:") +
          steps([
            "<strong>Free inspection.</strong> We photograph and document the damage.",
            "<strong>You file.</strong> We meet your adjuster on-site and document the full scope.",
            "<strong>Insurance covers the replacement.</strong> You pay only your deductible.",
            "<strong>We install.</strong> On replacement-cost policies the balance comes once work begins.",
          ]) +
          p(
            `We never waive your deductible or pose as your adjuster, both are illegal in Texas, and doing it right protects you.`,
          ) +
          (c.financing
            ? p(`Deductible in the way? We can finance it, from as little as $250 down, paid in full over time.`)
            : "") +
          button("Book my free inspection", BOOK_URL) +
          verifyChip(),
      }),
  },

  // 2, Why PowerEdge / trust
  {
    key: "why-poweredge",
    delayDays: 3,
    subject: () => "Anyone can knock after a storm. Not everyone can prove it.",
    html: (c) =>
      shell({
        marketing: true,
        preheader: `Insured, ${site.googleRating}★, and one crew for your whole roof.`,
        body:
          h1("Why homeowners pick PowerEdge.") +
          p(
            `Texas doesn&rsquo;t license roofers, anyone with a ladder and a magnet sign can knock your door after a hailstorm. We&rsquo;re built the opposite way:`,
          ) +
          `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:4px 0 8px;">
            ${[
              [
                "Insured & accountable",
                `Backed by ${site.liabilityCoverage} in liability coverage and a documented 1-year workmanship guarantee, a real company standing behind the work.`,
              ],
              [
                "One accountable crew",
                "Your roof handled in-house, start to finish, no subcontractor finger-pointing.",
              ],
              [
                "Capacity to actually show up",
                "Our own crews, so we can be there this week, not next month.",
              ],
            ]
              .map(
                ([t, d]) => `<tr><td style="padding:9px 0;border-bottom:1px solid ${LINE};font-family:${FONT};">
                  <div style="font-size:16px;font-weight:800;color:${INK};">${t}</div>
                  <div style="font-size:15px;color:${MUTED};line-height:1.5;margin-top:2px;">${d}</div></td></tr>`,
              )
              .join("")}
          </table>` +
          button("Book my free inspection", BOOK_URL) +
          verifyChip(),
      }),
  },

  // 4, Deductible financing (the money objection). Only for homeowners who
  // told us the deductible is the problem; see raisedDeductible.
  {
    key: "deductible-financing",
    delayDays: 5,
    when: raisedDeductible,
    subject: () => "The deductible isn't the wall you think it is",
    html: () =>
      shell({
        marketing: true,
        preheader: "Finance it from $250 down, and get the roof done now.",
        body:
          h1("Short on the deductible? That's not a dead end.") +
          p(
            `Texas wind/hail deductibles run 1&ndash;2% of your home&rsquo;s value, often <strong>$5,000&ndash;$10,000</strong>. If that number is the only thing between you and a sound roof, here&rsquo;s the fix:`,
          ) +
          steps([
            "<strong>Finance your deductible</strong>, from as little as $250 down, low monthly payments.",
            "<strong>We schedule the work now</strong>, you don&rsquo;t wait to save up.",
            "<strong>You still pay it in full</strong>, just over time. (Waiving it is illegal in Texas; financing is smart.)",
          ]) +
          p(`Already have an estimate from another roofer? Bring it, we can do the work and finance it.`) +
          button("See my deductible financed", FINANCE_URL) +
          verifyChip(),
      }),
  },

  // 5, Urgency: you can lose the claim
  {
    key: "claim-clock",
    delayDays: 8,
    subject: () => "Wait too long and you lose the claim entirely",
    html: (c) =>
      shell({
        marketing: true,
        preheader:
          "Texas claims expire, then the whole roof comes out of your pocket.",
        body:
          h1("Don't lose your claim to the clock.") +
          p(
            `Here&rsquo;s the part no one warns you about: Texas policies give you a limited window to file, <strong>some as short as one year from the date of the storm</strong>. Miss it, and the claim is gone for good. At that point the <strong>entire roof</strong> comes out of your pocket, not just your deductible.`,
          ) +
          p(
            `And the damage doesn&rsquo;t wait for you. Every rain turns a small bruise into a bigger leak, and an aging roof can quietly slip from full-replacement to depreciated coverage, paying you thousands less.`,
          ) +
          p(
            `If you think a storm hit your roof, don&rsquo;t sit on it. Check whether you still qualify. It takes about a minute.`,
          ) +
          button("Check if I still have a claim", BOOK_URL) +
          (raisedDeductible(c)
            ? small(
                `Deductible the holdup? <a href="${FINANCE_URL}" style="color:${LIME_DEEP};font-weight:700;text-decoration:none;">See it financed, from $250 down &rarr;</a>`,
              )
            : "") +
          verifyChip(),
      }),
  },

  // 6, Witty re-engagement
  {
    key: "did-we-lose-you",
    delayDays: 12,
    subject: () => "Did we lose you?",
    html: (c) =>
      shell({
        marketing: true,
        preheader: "Your roof's still up there. We checked.",
        body:
          h1(`Did we lose you, ${c.firstName}?`) +
          p(
            `We&rsquo;ve knocked on your inbox a few times and heard&hellip; crickets. Which means one of three things:`,
          ) +
          steps([
            "Your roof is flawless, genuinely, congrats.",
            "You&rsquo;re already handling it.",
            "Life got loud and the hail slipped your mind.",
          ]) +
          p(
            `If it&rsquo;s that last one, no judgment, but the storm clock keeps ticking. Sixty seconds tells you whether you&rsquo;ve still got a claim, and then we&rsquo;ll quiet down.`,
          ) +
          button("Check my roof, 60 seconds", BOOK_URL) +
          verifyChip(),
      }),
  },

  // 7, Trust / objection (witty)
  {
    key: "storm-chaser",
    delayDays: 17,
    subject: () => "About the guy in the pickup with the clipboard",
    html: (c) =>
      shell({
        marketing: true,
        preheader: "Texas doesn't license roofers. We're the one you can verify.",
        body:
          h1("Not every 'roofer' is a roofer.") +
          p(
            `After a storm your street fills with trucks and clipboards. The uncomfortable truth: <strong>Texas doesn&rsquo;t license roofers</strong>: a magnet sign and a ladder is the whole barrier to entry, and plenty vanish before the warranty ever matters.`,
          ) +
          p(
            `We&rsquo;re the opposite kind of company: insured and accountable, ${site.googleRating}&#9733; across ${site.googleReviewCount} reviews, one accountable crew for your whole roof. Verify us before you trust anyone knocking.`,
          ) +
          button("Verify us, then book a free inspection", BOOK_URL) +
          verifyChip(),
      }),
  },

  // 8, Witty last call
  {
    key: "last-call",
    delayDays: 23,
    subject: () => "Okay, we can take a hint",
    html: (c) =>
      shell({
        marketing: true,
        preheader: "Last one, the offer stands whenever you're ready.",
        body:
          h1("We'll stop crowding your inbox.") +
          p(
            `This is the part where we gracefully back off. No hard feelings, your roof&rsquo;s still up there, the free inspection still stands, and we&rsquo;re exactly one text away the day you want it.`,
          ) +
          p(
            `If a storm ever does a number on your roof, you know who to call: the insured crew that <em>shows you the coverage</em>. Until then, ${c.firstName}, take care.`,
          ) +
          button("Actually, I'm ready, book it", BOOK_URL) +
          p(`Or text ${phone()}. That&rsquo;s it. Promise.`) +
          verifyChip(),
      }),
  },
];

// ---- Claim-prep intake emails (completion + drop-off nurture) -------------
type IntakeLite = {
  id?: string;
  name?: string;
  email?: string;
  phone?: string;
  address?: string;
};

/**
 * Marketing mail carries an unsubscribe header. One-to-one mail does not.
 *
 * Every email from here used to carry List-Unsubscribe, the agreement to
 * sign, the signed copy and the sign-in link included. That header is how a
 * mailbox provider is told "this is bulk, the recipient may not want it", so
 * we were volunteering a homeowner's own contract for the promotions tab, and
 * offering to unsubscribe people from their sign-in links.
 *
 * It is also the wrong way round legally: marketing needs an unsubscribe,
 * transactional mail about an agreement someone is party to does not, and
 * nobody can opt out of being sent the contract they just signed.
 */
function isMarketing(kind: string) {
  return kind.startsWith("sequence:") || kind.startsWith("nurture");
}

/**
 * Preview capture.
 *
 * To see an email exactly as it sends, the preview page runs the real send
 * function inside captureEmails(), and sendEmail hands the rendered message
 * back instead of sending it. The capture is per async call, not a module
 * flag, so a real send happening on the server at the same moment is never
 * swallowed by someone looking at a preview.
 */
export type CapturedEmail = { to: string; subject: string; html: string; kind: string };
const captureStore = new AsyncLocalStorage<CapturedEmail[]>();

export async function captureEmails(run: () => Promise<unknown>): Promise<CapturedEmail[]> {
  const out: CapturedEmail[] = [];
  await captureStore.run(out, run);
  return out;
}

async function sendEmail(
  resendKey: string,
  to: string,
  subject: string,
  html: string,
  kind = "transactional",
) {
  const capture = captureStore.getStore();
  if (capture) {
    capture.push({ to, subject, html, kind });
    return { ok: true } as { ok: boolean };
  }
  return sendMail({
    resendKey,
    kind,
    to,
    subject,
    html,
    from: `PowerEdge <hello@${site.domain}>`,
    replyTo: site.email,
    headers: isMarketing(kind)
      ? {
          "List-Unsubscribe": `<mailto:${site.email}?subject=Unsubscribe>`,
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        }
      : undefined,
  });
}

function prepResumeUrl(i: IntakeLite) {
  const q = new URLSearchParams({
    resume: i.id || "",
    name: i.name || "",
    phone: i.phone || "",
    email: i.email || "",
    address: i.address || "",
  });
  return `${CLAIM_PREP_URL}?${q.toString()}`;
}

/** Sent when a homeowner finishes claim prep. */
export async function sendClaimComplete(
  resendKey: string,
  to: string,
  name: string,
) {
  const first = (name || "there").split(" ")[0];
  return sendEmail(
    resendKey,
    to,
    "Your claim details are in, we'll call you right away",
    shell({
      preheader: "We've got everything to move fast on-site.",
      body:
        eyebrow("Claim details received") +
        h1(`You're all set, ${first}.`) +
        p(
          `We&rsquo;ve got your claim details, and someone from our team will call you <strong>right away</strong> to set your inspection. When we arrive we go straight to documenting the roof, no paperwork on the doorstep.`,
        ) +
        button(`Call ${site.phone}`, site.phoneHref) +
        small(`Or text the same number. A person answers.`),
    }),
    "claim-complete",
  );
}

/** Drop-off nurture. stage 1 = started only; stage 2 = did insurance step. */
export async function sendClaimNurture(
  resendKey: string,
  intake: IntakeLite,
  stage: number,
) {
  if (!intake.email) return;
  const first = (intake.name || "there").split(" ")[0];
  const url = prepResumeUrl(intake);
  if (stage >= 2) {
    return sendEmail(
      resendKey,
      intake.email,
      "You're almost there, finish your claim in a minute",
      shell({
        marketing: true,
        preheader: "A couple more details and your crew arrives ready.",
        body:
          h1(`Almost done, ${first}.`) +
          p(
            `You&rsquo;ve done the hard part, just a couple more details and your inspection is fully prepped, so our crew gets right on the roof instead of doing paperwork. Takes about a minute.`,
          ) +
          button("Finish my claim →", url) +
          verifyChip(),
      }),
      "nurture:claim-prep-2",
    );
  }
  return sendEmail(
    resendKey,
    intake.email,
    "Your roof claim, made easy",
    shell({
        marketing: true,
      preheader: "Storm damage doesn't wait, let's get ahead of it.",
      body:
        h1(`Let's get your claim rolling, ${first}.`) +
        p(
          `You started your claim prep, smart move. Filing a hail claim <em>sounds</em> like a hassle, but we make it simple: you add a few details, we document the damage and coordinate with your adjuster, and on a covered claim you pay just your deductible.`,
        ) +
        p(
          `<strong>Storm damage only gets worse, and your filing window won&rsquo;t stay open.</strong> Pick up right where you left off:`,
        ) +
        button("Finish my claim →", url) +
        verifyChip(),
    }),
    "nurture:claim-prep-1",
  );
}

// ---- Enqueue the sequence via Resend scheduled sends ----------------------
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Enqueues the whole funnel for one recipient: email 0 sends now, 1..n are
 * scheduled via Resend `scheduled_at` (day-offset from now, so the timer starts
 * today). Sent SEQUENTIALLY with a throttle to stay under Resend's rate limit
 * (free tier ~2 req/s). Failures are logged, never thrown. Intended to be
 * fire-and-forget (don't block the response), safe on Render's persistent
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

  for (const email of sequenceFor(ctx)) {
    const scheduledAt =
      email.delayDays > 0
        ? new Date(now + email.delayDays * 86400000).toISOString()
        : undefined;
    await sendMail({
      resendKey,
      kind: `sequence:${email.key}`,
      to,
      subject: email.subject(ctx),
      html: email.html(ctx),
      from,
      replyTo: site.email,
      scheduledAt,
      // This one is marketing, so it keeps the unsubscribe, and gets the
      // one-click form Gmail expects from anyone sending drip mail.
      headers: {
        "List-Unsubscribe": `<mailto:${site.email}?subject=Unsubscribe>`,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      },
    });
    await sleep(600); // ~1.6/s, under Resend's 2/s free-tier limit
  }
}

/**
 * Inspection booked: confirmation to the homeowner, notification to the team.
 * Sent after the slot is already persisted, so a mail failure never costs the
 * booking (the caller swallows throws).
 */
export async function sendAppointmentConfirmation(
  resendKey: string,
  a: {
    name: string;
    phone: string;
    email?: string;
    address?: string;
    notes?: string;
    dayLabel: string;
    timeLabel: string;
    id?: string;
    /** Who is driving to it. */
    closer?: string | null;
    /** Who set it at the door. */
    setter?: string | null;
  },
): Promise<{ ok: boolean } | undefined> {
  const first = (a.name || "there").split(" ")[0];
  const when = `${a.dayLabel}, ${a.timeLabel}`;

  // Homeowner confirmation. Returned, so the caller can tell the setter
  // whether it actually went rather than assuming.
  let homeowner: { ok: boolean } | undefined;
  if (a.email) {
    homeowner = await sendEmail(
      resendKey,
      a.email,
      `You're booked: roof inspection ${a.dayLabel}`,
      shell({
        preheader: `${when}. Free, documented, no obligation.`,
        body:
          eyebrow("Inspection booked") +
          h1(`You're booked, ${first}.`) +
          keyPanel({
            label: "Arrival window",
            value: a.dayLabel,
            sub: `${a.timeLabel}${a.address ? `<br/>${a.address}` : ""}`,
          }) +
          p(
            `${a.closer ? `Your inspector is <strong>${a.closer}</strong>. ` : ""}That&rsquo;s an arrival window, not a fixed minute, so we&rsquo;ll call before we head over.`,
          ) +
          section("At the inspection") +
          steps([
            "We photograph and measure the roof, top to bottom.",
            "You get a written assessment, including &ldquo;your roof is fine&rdquo; if that&rsquo;s the answer.",
            "If there&rsquo;s storm damage, we document it, so if you decide to file, your claim stands on evidence.",
          ]) +
          p(
            `You don&rsquo;t need to be home for the roof itself, but it helps to be there for the walkthrough.`,
          ) +
          (a.id
            ? button("Change or cancel", `${site.url}/appointment/${a.id}`, "quiet") +
              small(`Or call or text ${phone(MUTED)}.`)
            : small(`Need to move it? Call or text ${phone(MUTED)}.`)),
      }),
      "appointment-confirmation",
    );
  }

  // Team notification.
  const row = (k: string, v?: string) =>
    v
      ? `<tr><td style="padding:4px 10px 4px 0;color:${MUTED};font:13px ${FONT};">${k}</td><td style="padding:4px 0;color:${TEXT};font:600 13px ${FONT};">${v}</td></tr>`
      : "";
  await sendEmail(
    resendKey,
    site.email,
    `NEW INSPECTION BOOKED · ${a.dayLabel} ${a.timeLabel} · ${a.name}`,
    shell({
      preheader: `${a.name} · ${a.phone} · ${when}`,
      body:
        h1("New inspection booked") +
        `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 18px;">
          ${row("When", when)}${row("Closer", a.closer || "NOT ASSIGNED, place it")}
          ${row("Set by", a.setter || "Website")}
          ${row("Name", a.name)}${row("Phone", a.phone)}
          ${row("Email", a.email)}${row("Address", a.address)}${row("Notes", a.notes)}
        </table>` +
        p(`It's already on the board at <a href="${site.url}/admin/appointments">/admin/appointments</a>.`),
    }),
  );

  return homeowner;
}

/**
 * The closer hears about their own inspection.
 *
 * Bookings used to notify one office inbox and nobody else, so the person
 * actually driving to the house found out by checking a board. In a setter and
 * closer business that is how an 8am inspection gets missed.
 */
export async function sendCloserAssignment(
  resendKey: string,
  to: string,
  a: {
    closer: string;
    name: string;
    phone: string;
    address: string;
    dayLabel: string;
    timeLabel: string;
    setter?: string | null;
    note?: string;
    jobId?: string | null;
  },
) {
  const when = `${a.dayLabel}, ${a.timeLabel}`;
  const first = (a.closer || "there").split(" ")[0];
  const map = `https://maps.google.com/?q=${encodeURIComponent(a.address)}`;
  const row = (k: string, v?: string | null) =>
    v
      ? `<tr><td style="padding:5px 12px 5px 0;color:${MUTED};font:13px ${FONT};">${k}</td><td style="padding:5px 0;color:${TEXT};font:600 14px ${FONT};">${v}</td></tr>`
      : "";
  return sendEmail(
    resendKey,
    to,
    `Inspection: ${a.dayLabel} ${a.timeLabel} · ${a.address}`,
    shell({
      preheader: `${a.name} · ${when}${a.setter ? ` · set by ${a.setter}` : ""}`,
      body:
        h1(`You're on it, ${first}.`) +
        `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 16px;">
          ${row("When", when)}${row("Homeowner", a.name)}${row("Phone", a.phone)}
          ${row("Address", `<a href="${map}" style="color:${LIME_DEEP};">${a.address}</a>`)}
          ${row("Set by", a.setter)}
        </table>` +
        (a.note ? p(`<strong>From the setter:</strong> ${a.note}`) : "") +
        (a.jobId ? button("Open the job", `${site.url}/admin/jobs/${a.jobId}`) : ""),
    }),
    "closer-assignment",
  );
}

/**
 * Day-of reminder for a booked inspection. Short on purpose: the homeowner
 * already said yes, so this only needs to put the window in front of them and
 * make cancelling one tap, because an honest cancel is cheaper than a crew
 * driving out to an empty house.
 */
export async function sendAppointmentReminder(
  resendKey: string,
  a: { id: string; name: string; email: string; address: string; when: string },
) {
  const first = (a.name || "there").split(" ")[0];
  return sendEmail(
    resendKey,
    a.email,
    `Today: your roof inspection ${a.when}`,
    shell({
      preheader: `We'll call before we head over.`,
      body:
        eyebrow("Inspection today") +
        h1(`See you today, ${first}.`) +
        keyPanel({
          label: "Arrival window opens",
          value: a.when,
          sub: a.address || undefined,
        }) +
        p(
          `We&rsquo;ll call before we head over. You don&rsquo;t need to be home for the roof itself, but it helps to be there for the walkthrough.`,
        ) +
        button("Change or cancel", `${site.url}/appointment/${a.id}`, "quiet") +
        small(`Questions? Call or text ${phone(MUTED)}.`),
    }),
    "appointment-reminder",
  );
}

/**
 * The signed agreement, to the homeowner.
 *
 * Carries the statutory cancellation notice with the real deadline date and
 * the address to send it to, because Chapter 601 requires the buyer to be
 * given that in writing. Emailing it also means they keep it, which a page
 * handed over at a kitchen table frequently does not achieve.
 */
/** The work, line by line, as hairline rows. */
function scopeRows(scope?: Array<{ description: string; price: string }>) {
  return rows(
    (scope ?? [])
      .filter((l) => (l.description || "").trim())
      .map((l): Row => [l.description, money(l.price)]),
  );
}

/**
 * The money panel and its ledger.
 *
 * On an insurance job the contract total is mostly not the homeowner's money;
 * the deductible is, and it is the number they are actually deciding about.
 * So the panel carries what they pay, and the rows carry the carrier, the
 * claim number and the split.
 */
function moneyBlock(c: {
  total?: string;
  claimBased: boolean;
  carrier?: string;
  claimNumber?: string;
  deductible?: string;
}) {
  const split = claimSplit(c.total, c.deductible);
  if (!c.claimBased) {
    return {
      panel:
        split.total > 0
          ? keyPanel({ label: "Total price", value: split.totalText, sub: "No deposit is due at signing." })
          : "",
      ledger: "",
    };
  }
  const panel = split.show
    ? keyPanel({
        label: "You pay, your deductible",
        value: split.deductibleText,
        sub: `${c.carrier || "Your insurance"} pays ${split.carrierText} of the ${split.totalText} approved scope.`,
      })
    : split.total > 0
      ? keyPanel({
          label: "Approved scope total",
          value: split.totalText,
          sub: "Your carrier sets the scope and the price. You pay your deductible.",
        })
      : "";
  const ledger =
    section("Your claim") +
    rows([
      c.carrier ? ["Insurance carrier", c.carrier] : null,
      c.claimNumber ? ["Claim number", c.claimNumber] : null,
      split.total > 0 ? ["Approved scope total", split.totalText] : null,
      split.show ? ["Your insurance pays", split.carrierText] : null,
      split.deductible > 0 ? ["You pay (your deductible)", split.deductibleText, true] : null,
    ]);
  return { panel, ledger };
}

export async function sendSignedAgreement(
  resendKey: string,
  c: {
    id: string;
    ownerNames: string;
    address: string;
    email: string;
    scope: Array<{ description: string; price: string }>;
    total?: string;
    claimBased: boolean;
    carrier?: string;
    claimNumber?: string;
    deductible?: string;
    signedOn: string;
    cancelBy: string;
  },
) {
  const first = (c.ownerNames || "there").split(" ")[0];
  const { ledger } = moneyBlock(c);
  const split = claimSplit(c.total, c.deductible);

  return sendEmail(
    resendKey,
    c.email,
    `Your signed agreement with PowerEdge`,
    shell({
      preheader: `Your copy, and your right to cancel until ${c.cancelBy}.`,
      body:
        eyebrow("Your signed copy") +
        h1(`Thanks, ${first}.`) +
        p(
          `Here is your signed agreement for <strong>${c.address}</strong>, dated ${c.signedOn}. Keep this email; it is your copy.`,
        ) +
        keyPanel({
          label: "You can cancel until",
          value: c.cancelBy,
          sub: "Midnight on that date, for any reason, with nothing owed. Reply CANCEL to this email and we will confirm in writing.",
        }) +
        section("The work") +
        scopeRows(c.scope) +
        (c.claimBased
          ? ledger +
            small(
              `The carrier sets the scope and the price; you pay your deductible. We never waive it, because that is a crime in Texas.`,
            )
          : rows([split.total > 0 ? ["Total price", split.totalText, true] : null])) +
        /*
         * Tex. Bus. & Com. Code § 601.053(b) lists what a merchant "may not
         * fail to include" on the notice: the merchant's name, the address of
         * the merchant's place of business, the date of the transaction, and
         * the deadline. Wording is the statutory form; only the styling here
         * is ours.
         */
        `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:26px 0 8px;">
           <tr><td style="border:2px solid ${INK};border-radius:8px;padding:16px 18px;font-family:${FONT};font-size:13px;line-height:20px;font-weight:700;color:${TEXT};">
             NOTICE OF CANCELLATION<br>
             DATE OF TRANSACTION: ${c.signedOn}<br><br>
             YOU MAY CANCEL THIS TRANSACTION, WITHOUT ANY PENALTY OR OBLIGATION, WITHIN THREE
             BUSINESS DAYS FROM THE DATE ABOVE.<br><br>
             TO CANCEL THIS TRANSACTION, MAIL OR DELIVER A SIGNED AND DATED COPY OF THIS NOTICE,
             OR ANY OTHER WRITTEN NOTICE, TO ${site.legalEntity.toUpperCase()}${
               site.mailingAddress ? `, AT ${site.mailingAddress.toUpperCase()}` : ""
             }, OR REPLY TO THIS EMAIL, NOT LATER THAN MIDNIGHT OF
             <span style="text-decoration:underline">${c.cancelBy}</span>.
           </td></tr>
         </table>` +
        small(`Questions about any of it, call or text ${phone(MUTED)}.`),
    }),
    "signed-agreement",
  );
}

/**
 * The signing link, to the homeowner.
 *
 * This used to be handed back to the rep as a URL for them to text from their
 * own phone. That put the agreement on a personal number, left nothing in the
 * record, and meant a rep who got distracted in the truck simply never sent
 * it. We already captured the homeowner's email in step one of the form, so
 * send it from here and write it down.
 *
 * Deliberately short: this is a thing to tap, not a thing to read. The
 * agreement itself, the cancellation notice and the deadline all live on the
 * page behind the link, and the full copy follows by email once they sign.
 */
export async function sendAgreementToSign(
  resendKey: string,
  c: {
    ownerNames: string;
    address: string;
    email: string;
    url: string;
    rep?: string;
    total?: string;
    claimBased: boolean;
    carrier?: string;
    claimNumber?: string;
    deductible?: string;
    scope?: Array<{ description: string; price: string }>;
  },
) {
  const first = (c.ownerNames || "there").split(" ")[0];
  const split = claimSplit(c.total, c.deductible);
  const { panel, ledger } = moneyBlock(c);
  const work = scopeRows(c.scope);

  return sendEmail(
    resendKey,
    c.email,
    `Your PowerEdge agreement for ${c.address}`,
    shell({
      preheader: split.show
        ? `Your part is ${split.deductibleText}. Read it and sign on your phone.`
        : "Read it, then sign on your phone. Takes a minute.",
      body:
        eyebrow("Your agreement") +
        h1(`Ready when you are, ${first}.`) +
        p(
          `${c.rep ? `${c.rep} has` : "We have"} prepared your repair agreement for ` +
            `<strong>${c.address}</strong>. Read it and sign on your phone. No printing, no app.`,
        ) +
        panel +
        button("Read and sign", c.url) +
        small(
          `Nothing is owed and nothing is agreed until you sign. Once you do, you get your own copy and three business days to cancel.`,
        ) +
        (work ? section("The work") + work : "") +
        (c.claimBased
          ? ledger +
            small(
              `Your carrier sets the scope and the price. You pay your deductible, and we never discount it or absorb it, because doing that is a crime in Texas.`,
            )
          : "") +
        small(`Questions first? Call or text ${phone(MUTED)}.`),
    }),
    "agreement-to-sign",
  );
}

/**
 * The written assessment, after every inspection.
 *
 * Every booking confirmation promises it: "You get a written assessment,
 * including 'your roof is fine' if that's the answer." Nothing sent one, and
 * nothing even recorded what an inspection found. That promise is the whole of
 * the positioning, so it goes out for both outcomes, and the "fine" version is
 * written to be read as good news rather than a lost sale.
 */
export async function sendInspectionAssessment(
  resendKey: string,
  a: {
    name: string;
    email: string;
    address: string;
    inspectedOn: string;
    closer?: string | null;
    verdict: "qualifies" | "fine";
    findings?: string;
    jobId?: string;
  },
) {
  const first = (a.name || "there").split(" ")[0];
  const findings = (a.findings || "").trim();
  const fine = a.verdict === "fine";
  const panel = keyPanel({
    label: "Verdict",
    value: fine ? "No storm damage found" : "Storm damage found",
    sub: `${a.address}<br/>Inspected ${a.inspectedOn}${a.closer ? ` by ${a.closer}` : ""}`,
  });
  const saw = findings ? section("What we saw") + quote(findings) : "";

  const body = fine
    ? eyebrow("Your inspection") +
      h1(`Good news, ${first}.`) +
      panel +
      saw +
      gap(18) +
      p(
        `Nothing we saw would support an insurance claim. You do not need to do anything, and we will not call to sell you a roof you do not need.`,
      ) +
      p(
        `Keep this email. It is a dated record of your roof&rsquo;s condition, which helps if a future storm ever leads to a claim.`,
      ) +
      small(
        `If a storm comes through and you want a second look, call or text ${phone(MUTED)}. It is free again.`,
      )
    : eyebrow("Your inspection") +
      h1(`Here is what we found, ${first}.`) +
      panel +
      saw +
      section("What happens next") +
      steps([
        `You file the claim with your carrier. Texas law does not let a contractor file or negotiate it for you, and we would not want to.`,
        `We document what we found and meet your adjuster at the house, so nothing legitimate gets missed.`,
        `Your carrier decides the scope. You pay your deductible.`,
      ]) +
      button(`Call ${site.phone}`, site.phoneHref, "quiet") +
      small(`Questions about any of it, call or text. A person answers.`);

  return sendEmail(
    resendKey,
    a.email,
    fine ? `Your roof inspection: no storm damage found` : `Your roof inspection: what we found`,
    shell({
      preheader: fine
        ? "Your roof is fine. Nothing for you to do."
        : "Damage found. Here is what happens next.",
      body,
    }),
    "inspection-assessment",
  );
}

/** Sign-in link for the team. Short-lived and single use. */
export async function sendLoginLink(resendKey: string, to: string, url: string) {
  return sendEmail(
    resendKey,
    to,
    "Your PowerEdge sign-in link",
    shell({
      preheader: "Expires in 20 minutes, works once.",
      body:
        h1("Sign in") +
        p(`Tap below to open your PowerEdge tools. The link works once and expires in 20 minutes.`) +
        button("Sign me in", url) +
        p(`If you didn't ask for this, you can ignore it. Nobody can sign in without this email.`),
    }),
    "login-link",
  );
}

// ---- Rep onboarding sequence (internal) ------------------------------------
//
// Sent by lib/onboardingSequence.ts: a welcome when someone is added, a few
// reminders for whatever step is next, a note when a step that was closed
// opens, permit renewals, "you're ready", and two notes to the office (your
// turn; this person has gone quiet). Builders return { subject, html } so the
// preview page shows exactly what sends.

const escHtml = (t: string) =>
  t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export type OnbStep = { label: string; time?: string };

export type OnbCtx = {
  first: string;
  name: string;
  role: string;
  team?: string | null;
  /** Primary button: signs a rep in and opens the right step. */
  url: string;
  open: OnbStep[];
  /** Rep steps that can't be done yet, and why. */
  blocked: Array<{ label: string; why: string }>;
  done: number;
  total: number;
  /** Office-only steps still to do. */
  officeOpen?: string[];
  phone?: string | null;
  since?: string;
  lastActivity?: string | null;
  reminders?: number;
  permit?: { city: string; expires: string; days: number; how: string };
  resign?: boolean;
  permitsHeld?: string[];
};

export type OnbEmail = { subject: string; html: string };

function openList(c: OnbCtx) {
  return steps(c.open.map((s) => `<strong>${escHtml(s.label)}</strong>${s.time ? `<br><span style="color:${MUTED};font-size:14px;">${escHtml(s.time)}</span>` : ""}`));
}

/** City permits don't hold up the first door (Parker 11/12); everything else on the rep's side does. */
const isPermit = (s: { label: string }) => /permit/i.test(s.label);
function permitsNote(c: OnbCtx) {
  return c.open.some(isPermit)
    ? small("City permits don't hold up your first door. The checklist shows how to apply in each city you'll work.")
    : "";
}

function blockedNote(c: OnbCtx) {
  if (!c.blocked.length) return "";
  return small(c.blocked.map((b) => `${escHtml(b.label)}: ${escHtml(b.why)}`).join("<br>"));
}

export function onbWelcome(c: OnbCtx): OnbEmail {
  const first = escHtml(c.first);
  const where = c.team ? ` on the ${escHtml(c.team)} team` : "";
  const needs = [
    "A well-lit spot for a badge photo",
    "Someone we can call in an emergency",
    ...(c.open.some((s) => /W-9/.test(s.label)) ? ["Your Social Security number (or your EIN) for the W-9"] : []),
    ...(c.open.some((s) => /deposit/i.test(s.label)) ? ["Your bank's routing and account numbers"] : []),
  ];
  return {
    subject: `Welcome to PowerEdge, ${c.first}`,
    html: shell({
      preheader: "A few things to finish on your phone before your first door. Most people are done in 30 minutes.",
      body:
        h1(`Welcome to PowerEdge, ${first}`) +
        p(`You're on the team as a ${escHtml(c.role.toLowerCase())}${where}. Before your first door there are a few things to finish, all on your phone. Most people are done in about 30 minutes, and it saves as you go.`) +
        openList(c) +
        permitsNote(c) +
        blockedNote(c) +
        section("Have these handy") +
        p(needs.map(escHtml).join("<br>")) +
        button("Start setting up", c.url) +
        p(`After that, the office sets up a ride-along with a lead and gets you your badge, shirt and door hangers.`) +
        small(`The button signs you in. It works once and lasts 3 days; after that, sign in at ${site.domain}/login with this email. Questions? Reply here.`),
    }),
  };
}

export function onbReminder(c: OnbCtx): OnbEmail {
  const n = c.reminders ?? 1;
  const left = c.open.filter((s) => !isPermit(s)).length;
  const onlyPermits = left === 0 && c.open.length > 0;
  const next = c.open[0];
  const started = c.done > 0;
  const subject =
    n === 1
      ? started ? "Pick up where you left off" : "Your PowerEdge setup is waiting"
      : n === 2
        ? onlyPermits ? "Your city permits" : `${left} step${left === 1 ? "" : "s"} left before your first door`
        : n === 3
          ? onlyPermits ? "Still need your city permits" : `Still need ${left === 1 ? "this" : "these"} before you knock`
          : "Last reminder about your setup";
  return {
    subject,
    html: shell({
      preheader: next ? `Next up: ${next.label}${next.time ? `, ${next.time}` : ""}.` : "Finish your setup.",
      body:
        h1(started ? `${c.done} of ${c.total} done, ${escHtml(c.first)}` : `Let's get you set up, ${escHtml(c.first)}`) +
        p(
          started
            ? `Here's what's left on your side. ${next ? `Next is <strong>${escHtml(next.label)}</strong>${next.time ? ` (${escHtml(next.time)})` : ""}.` : ""}`
            : `Nothing's done yet. It's about 30 minutes on your phone, and it saves as you go.`,
        ) +
        openList(c) +
        permitsNote(c) +
        blockedNote(c) +
        button(started ? "Pick up where you left off" : "Start setting up", c.url) +
        (n >= 4
          ? small(`This is our last email about it. After this, the office will check in with you directly.`)
          : small(`The button signs you in and works once. Questions? Reply here.`)),
    }),
  };
}

export function onbGate(c: OnbCtx, gate: "agreement" | "secure"): OnbEmail {
  if (gate === "agreement") {
    return {
      subject: c.resign ? "Your contractor agreement was updated" : "Your contractor agreement is ready to sign",
      html: shell({
        preheader: "About 5 minutes on your phone.",
        body:
          h1(c.resign ? "Please sign the new version" : "Your agreement is ready to sign") +
          p(
            c.resign
              ? `${escHtml(c.first)}, we updated the contractor agreement since you signed it. Read the new version and sign it on your phone. It takes about 5 minutes.`
              : `${escHtml(c.first)}, the contractor agreement is final. Read it and sign it on your phone. It takes about 5 minutes.`,
          ) +
          button("Read and sign", c.url) +
          small(`The button signs you in and works once. Questions about the terms? Reply here before you sign.`),
      }),
    };
  }
  return {
    subject: "Your W-9 and direct deposit are open",
    html: shell({
      preheader: "About 5 minutes. Your numbers are encrypted.",
      body:
        h1("Two steps just opened") +
        p(`${escHtml(c.first)}, the W-9 and direct deposit weren't ready when you started. They are now. It's about 5 minutes, and your Social Security and account numbers are encrypted; the office sees only the last four.`) +
        button("Finish them now", c.url) +
        small(`The button signs you in and works once.`),
    }),
  };
}

export function onbPermit(c: OnbCtx): OnbEmail {
  const pm = c.permit!;
  const when = pm.days < 0 ? "has expired" : pm.days === 0 ? "expires today" : `expires in ${pm.days} day${pm.days === 1 ? "" : "s"}`;
  return {
    subject: `Your ${pm.city} permit ${when}`,
    html: shell({
      preheader: pm.days < 0 ? `Stop knocking in ${pm.city} until it's renewed.` : `Renew it before ${pm.expires}.`,
      body:
        h1(`Your ${escHtml(pm.city)} permit ${when}`) +
        p(
          pm.days < 0
            ? `It ran out on ${escHtml(pm.expires)}. Don't knock in ${escHtml(pm.city)} until it's renewed; the fine is yours, not the company's.`
            : `It runs out on ${escHtml(pm.expires)}. Renew it before then so you don't lose days in ${escHtml(pm.city)}.`,
        ) +
        quote(escHtml(pm.how)) +
        p(`When you have the new one, update the permit number and expiry in your checklist.`) +
        button("Update my permit", c.url),
    }),
  };
}

export function onbReady(c: OnbCtx): OnbEmail {
  return {
    subject: `You're all set, ${c.first}`,
    html: shell({
      preheader: "Setup is done. See you in the field.",
      body:
        h1(`You're all set, ${escHtml(c.first)}`) +
        p(`Everything's done: your paperwork, the compliance check, your permits, the ride-along and your gear.${c.permitsHeld?.length ? ` You're permitted in ${escHtml(c.permitsHeld.join(", "))}.` : ""}`) +
        p(`Carry your permit, honor No Soliciting signs, and never offer to cover a deductible. We'll email you before a permit runs out.`) +
        button("Open PowerEdge", c.url),
    }),
  };
}

export function onbOfficeTurn(c: OnbCtx): OnbEmail {
  const who = escHtml(c.first);
  return {
    subject: `${c.first} ${c.open.some(isPermit) ? "is cleared to knock" : "finished their part"}. ${(c.officeOpen ?? []).length === 1 ? "One step is" : "Two steps are"} yours.`,
    html: shell({
      preheader: `Waiting on you: ${(c.officeOpen ?? []).join(", ")}.`,
      body:
        eyebrow("Onboarding") +
        h1(`${who} is waiting on you`) +
        p(
          `${escHtml(c.name)} (${escHtml(c.role.toLowerCase())}${c.team ? `, ${escHtml(c.team)}` : ""}) ${
            c.open.some(isPermit)
              ? "has finished everything that opens the knock map. Their city permits are still in progress."
              : "has done everything on their side."
          } What's left is yours:`,
        ) +
        steps((c.officeOpen ?? []).map((s) => `<strong>${escHtml(s)}</strong>`)) +
        (c.blocked.length
          ? small(`Still locked on their side: ${escHtml(c.blocked.map((b) => b.label.replace(/^Sign your /, "").replace(/^./, (x) => x.toUpperCase())).join(", "))}. They get an email when it opens.`)
          : "") +
        button(`Open ${who}'s checklist`, c.url) +
        small("Sent to admins only."),
    }),
  };
}

export function onbOfficeStalled(c: OnbCtx): OnbEmail {
  const who = escHtml(c.first);
  return {
    subject: `${c.first} hasn't finished setup`,
    html: shell({
      preheader: `${c.open.length} step${c.open.length === 1 ? "" : "s"} still open after ${c.reminders ?? 4} reminders.`,
      body:
        eyebrow("Onboarding") +
        h1(`${who} has gone quiet`) +
        p(
          `We emailed ${escHtml(c.name)} a welcome on ${escHtml(c.since ?? "")} and ${c.reminders ?? 4} reminders since. ${
            c.lastActivity ? `Their last progress was ${escHtml(c.lastActivity)}.` : "They haven't started."
          } Still open:`,
        ) +
        openList(c) +
        (c.phone ? p(`Worth a call: <strong>${escHtml(c.phone)}</strong>.`) : "") +
        button(`Open ${who}'s checklist`, c.url) +
        small("No more automatic reminders go to them. From their checklist you can send the welcome again, which starts the reminders over."),
    }),
  };
}

export type SignedCtx = { first: string; name: string; version: string; signedAt: string; text: string; url: string };

/** The agreement as signed, for the rep's records. */
export function onbSignedCopy(c: SignedCtx): OnbEmail {
  const blocks = c.text.split(/\n\n+/);
  const body = blocks
    .map((b, i) => {
      const t = escHtml(b);
      if (i === 0) return `<p style="margin:0 0 4px;font-family:${FONT};font-size:17px;font-weight:800;color:${INK};">${t}</p>`;
      if (/^(\d+\.\s|Compensation Schedule$)/.test(b)) return `<p style="margin:16px 0 4px;font-family:${FONT};font-size:15px;font-weight:700;color:${INK};">${t}</p>`;
      return `<p style="margin:0 0 8px;font-family:${FONT};font-size:14px;line-height:21px;color:${TEXT};">${t}</p>`;
    })
    .join("");
  return {
    subject: "Your signed PowerEdge contractor agreement",
    html: shell({
      preheader: `A copy of what you signed on ${c.signedAt}. Keep it for your records.`,
      body:
        h1("Your signed agreement") +
        p(`${escHtml(c.first)}, here's a copy of the agreement you signed on ${escHtml(c.signedAt)}. Keep it for your records; it's also in the app any time.`) +
        button("Open it in the app", c.url) +
        gap(12) +
        body +
        small(`Signed electronically by ${escHtml(c.name)} on ${escHtml(c.signedAt)} (version ${escHtml(c.version)}).`),
    }),
  };
}

/** Tells the office someone signed. */
export function onbSignedOffice(c: SignedCtx): OnbEmail {
  return {
    subject: `${c.name} signed the contractor agreement`,
    html: shell({
      preheader: `Version ${c.version}, signed ${c.signedAt}.`,
      body:
        eyebrow("Onboarding") +
        h1(`${escHtml(c.first)} signed`) +
        p(`${escHtml(c.name)} signed the contractor agreement (version ${escHtml(c.version)}) on ${escHtml(c.signedAt)}. A copy went to them by email.`) +
        button("View the signed copy", c.url) +
        small("Sent to admins only."),
    }),
  };
}

export async function sendOnboardingEmail(resendKey: string, to: string, e: OnbEmail, kind: string) {
  return sendEmail(resendKey, to, e.subject, e.html, kind);
}

// ---- Weekly scorecards (internal) -----------------------------------------
//
// One email per person with their own week and their team's, and one company
// report for admins. Built here so they share the shell, and sent only when
// an admin presses Send on /admin/scoreboard/send after previewing them.

export type ScorecardRow = [label: string, value: string, strong?: boolean];

export type PersonScorecard = {
  firstName: string;
  span: string;
  /** "You were 2nd of 5 knockers on North." */
  headline: string;
  key: { label: string; value: string; sub?: string };
  mine: ScorecardRow[];
  note?: string | null;
  team?: { name: string; rows: ScorecardRow[]; ranking: ScorecardRow[] } | null;
  url: string;
};

export function buildPersonScorecard(c: PersonScorecard) {
  return shell({
    preheader: `${c.headline} ${c.key.label}: ${c.key.value}.`,
    body:
      eyebrow(`Your week · ${c.span}`) +
      h1(c.headline) +
      keyPanel(c.key) +
      section("Your numbers") +
      rows(c.mine) +
      (c.note ? quote(c.note) : "") +
      (c.team
        ? section(`${c.team.name}`) + rows(c.team.rows) + (c.team.ranking.length ? section(`${c.team.name}, ranked`) + rows(c.team.ranking) : "")
        : "") +
      button("Open the scoreboard", c.url) +
      small(`Sent by the office. Your numbers and your team's are on the scoreboard any time.`),
  });
}

export type CompanyReport = {
  span: string;
  key: { label: string; value: string; sub?: string };
  rows: ScorecardRow[];
  teams: ScorecardRow[];
  knockers: ScorecardRow[];
  closers: ScorecardRow[];
  url: string;
};

export function buildCompanyReport(r: CompanyReport) {
  return shell({
    preheader: `${r.key.label}: ${r.key.value}. ${r.span}.`,
    body:
      eyebrow(`Company report · ${r.span}`) +
      h1("The week, door to signature") +
      keyPanel(r.key) +
      rows(r.rows) +
      (r.teams.length ? section("Teams, by profit per roof") + rows(r.teams) : "") +
      (r.knockers.length ? section("Knockers, by inspections set") + rows(r.knockers) : "") +
      (r.closers.length ? section("Closers, by revenue") + rows(r.closers) : "") +
      button("Open the scoreboard", r.url) +
      small("Admins only. Reps get their own scorecard with their team, never the company."),
  });
}

export async function sendScorecard(resendKey: string, to: string, subject: string, html: string, kind: "scorecard" | "company-report") {
  return sendEmail(resendKey, to, subject, html, kind);
}
