import { site } from "@/lib/site";

/**
 * The storm-alert consent, word for word. The form shows exactly this and the
 * API stores exactly this with every signup, so what a homeowner agreed to is
 * never a reconstruction. Change the wording only by bumping the version.
 *
 * Texts that mention a free roof check are marketing, so this is written as
 * prior express written consent (47 CFR 64.1200(f)(9)): it names the sender,
 * the number, automated sending, and that consent is not a condition of
 * purchase. Counsel should review before the first text goes out.
 */
export const CONSENT_VERSION = "storm-alerts-v1-2026-11-10";

export const CONSENT_TEXT =
  `I agree that ${site.legalEntity} ("PowerEdge") may text the mobile number above, ` +
  `including with automated technology, when a hail or tornado warning covers this address, ` +
  `and to offer a free roof check. Consent is not a condition of any purchase. ` +
  `Messages are sent only when a warning covers this address. Message and data rates may apply. ` +
  `Reply STOP to opt out or HELP for help. Privacy: ${site.url}/privacy. Terms: ${site.url}/terms.`;
