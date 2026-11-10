/**
 * Scoring inbound leads, because almost none of them are homeowners.
 *
 * Of the last thirty leads on this site, two were real. The rest were B2B
 * solicitation: virtual assistant agencies, estimating services, business
 * brokers, lending, SEO and review sellers. Several had already become jobs
 * in the CRM, so the pipeline was mostly strangers selling us things.
 *
 * Two rules shape this:
 *
 * Nothing is deleted and nothing is silently dropped. An earlier spam guard
 * here rejected real people and returned ok:true, so a homeowner got a thank
 * you and we got nothing. Scored leads are kept, flagged, and visible in the
 * admin under a filter. The only things suppressed are the notification email
 * and the CRM job.
 *
 * It scores rather than matches. One signal is a hint; several together are a
 * decision. A real homeowner trips at most one of these by accident.
 */

export type SpamVerdict = { score: number; reasons: string[]; spam: boolean };

/** At or above this, it does not reach the pipeline. */
export const SPAM_THRESHOLD = 5;

/**
 * Phrases that belong to someone pitching a business, not to someone whose
 * roof is leaking. Taken from the actual messages received.
 */
const PITCH = [
  "tried emailing you",
  "pass this to the owner",
  "pass this along to the owner",
  "selling your business",
  "sell your business",
  "business broker",
  "virtual assistant",
  "vetted va",
  "we provide",
  "we offer",
  "we help businesses",
  "we help small",
  "our team can",
  "quantity takeoff",
  "takeoffs",
  "estimating",
  "free proposal",
  "bid confidently",
  "more customers from google",
  "free reviews",
  "rank your",
  "seo",
  "website design",
  "web design",
  "lead generation",
  "we generate",
  "per month",
  "funding",
  "capital for your",
  "business loan",
  "merchant cash",
  "isn't a customer service request",
  "is not a customer service request",
  "partnership opportunity",
  "collaborate with your",
  "interested in purchasing your products",
  "requesting electricians",
  "planning a commercial project",
  /*
   * Procurement fraud. The pattern is a purchase order from a spoofed
   * institution for equipment we do not sell, on net terms, so the goods ship
   * before anyone notices the invoice will never be paid. The one we received
   * claimed to be Texas A&M from the domain tamuedu.net, which is not tamu.edu,
   * and ordered vibration testers from a roofing company. A homeowner does not
   * write any of these phrases.
   */
  "purchasing manager",
  "director of purchasing",
  "net terms",
  "net 30",
  "purchase these items",
  "kindly calculate",
  "quote will expire",
  "proforma invoice",
];

/** Senders that exist to send this. Grows as new ones turn up. */
const VENDOR_DOMAINS = [
  "vettedvas.com",
  "vas4hire.com",
  "businessbrokersleads.com",
  "withintrolab.com",
  "engelsbergpartners.com",
  "getneonlab.com",
  "heylending.com",
  "theflowtic.com",
  "the108grp.com",
  "luminarlink.com",
  "vulcansmachinery.com",
  "bordlerstates.com",
];

const FREE_MAIL = ["gmail.com", "yahoo.com", "hotmail.com", "outlook.com", "aol.com", "icloud.com"];

/** Texas ZIPs are 75000-79999 plus the 885xx block. */
function zipLooksTexan(zip: string) {
  const z = (zip.match(/\d{5}/) || [])[0];
  if (!z) return null; // no opinion
  const n = Number(z);
  return (n >= 75000 && n <= 79999) || (n >= 88500 && n <= 88599);
}

export function scoreLead(lead: {
  name?: string;
  email?: string;
  phone?: string;
  zip?: string;
  address?: string;
  message?: string;
  service?: string;
}): SpamVerdict {
  const name = (lead.name || "").trim();
  const email = (lead.email || "").trim().toLowerCase();
  const message = (lead.message || "").trim();
  const domain = email.includes("@") ? email.split("@")[1] : "";
  const hay = `${name} ${message}`.toLowerCase();

  let score = 0;
  const reasons: string[] = [];
  const hit = (n: number, why: string) => {
    score += n;
    reasons.push(why);
  };

  // A sales pitch in the body is the single clearest signal.
  const phrase = PITCH.find((p) => hay.includes(p));
  if (phrase) hit(5, `pitch language ("${phrase}")`);

  if (VENDOR_DOMAINS.includes(domain)) hit(5, `known solicitation domain (${domain})`);

  // Someone pasted their whole pitch into the name box.
  if (name.length > 60) hit(5, "the name field contains a paragraph");

  // Homeowners do not decorate a roof enquiry.
  if (/[\u{1F300}-\u{1FAFF}\u{2700}-\u{27BF}]/u.test(`${name} ${message}`)) {
    hit(4, "emoji in the name or message");
  }

  /*
   * The sender is in the trade, selling to the trade. "estimator" or
   * "estimating" in a mailbox is not something a homeowner has.
   */
  if (/estimat/i.test(email)) hit(4, "estimating service address");

  /*
   * A phone number with a country code that is not ours. Every one of these
   * so far has been an overseas marketing agency. A DFW homeowner does not
   * write their number as +880.
   */
  const rawPhone = (lead.phone || "").trim();
  if (/^\+(?!1\b)\d/.test(rawPhone)) hit(4, "non-US phone country code");

  // A name that is really a login.
  if (/^[a-z]+\.[a-z]+$/.test(name.toLowerCase()) && !name.includes(" ")) {
    hit(2, "the name is an email handle");
  }

  // Out of area. Only counts when they told us where they are.
  const texan = zipLooksTexan(lead.zip || lead.address || "");
  if (texan === false) hit(3, "ZIP is outside Texas");

  // Addressing the company as a business rather than asking about a roof.
  if (/\byour (business|company|firm)\b/i.test(message)) hit(3, "addresses us as a business");

  // Long body with a link in it.
  if (message.length > 400) hit(2, "unusually long message");
  if (/https?:\/\//i.test(message) && message.length > 120) hit(2, "contains a link");

  /*
   * The quiet pattern: a free mailbox, no message at all, and a phone written
   * with a leading country code. On its own this is weak, which is why it is
   * worth 2 and not 5. A real homeowner who leaves the message blank scores 2
   * and still comes through.
   */
  const phoneDigits = (lead.phone || "").replace(/\D/g, "");
  if (
    FREE_MAIL.includes(domain) &&
    !message &&
    phoneDigits.length === 11 &&
    phoneDigits.startsWith("1")
  ) {
    hit(2, "no message, free mailbox, country-coded number");
  }

  return { score, reasons, spam: score >= SPAM_THRESHOLD };
}
