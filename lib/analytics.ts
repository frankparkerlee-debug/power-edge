// Thin analytics wrapper for GA4 + Meta Pixel. No-ops safely if neither is
// loaded (e.g. before the env IDs are set), so calls are always safe.
//
// Lead-submit events also fire the Meta standard `Lead` conversion (what the ad
// campaigns optimize toward); other tracked interactions fire as custom events.

const LEAD_EVENTS = [
  "lead_submit",
  "roof_claim_check",
  "financing_prequal",
  "financing_prequal_plaid",
];

export function track(event: string, params: Record<string, unknown> = {}) {
  if (typeof window === "undefined") return;
  const w = window as unknown as {
    gtag?: (...args: unknown[]) => void;
    fbq?: (...args: unknown[]) => void;
  };

  if (typeof w.gtag === "function") {
    w.gtag("event", event, params);
  }

  if (typeof w.fbq === "function") {
    if (LEAD_EVENTS.includes(event)) {
      w.fbq("track", "Lead", params);
    } else {
      w.fbq("trackCustom", event, params);
    }
  }
}
