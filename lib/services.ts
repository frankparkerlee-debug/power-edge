// Service catalog.
//
// PRICING NOTE (read this, Parker):
// The dollar figures below are PLACEHOLDERS structured for a penetration/
// land-grab strategy (priced to win share, thin margin now). They are NOT
// verified market numbers — the research could not confirm reliable TX price
// benchmarks. Set your real numbers here in ONE place and they update the whole
// site. Roofing & storm/insurance work is intentionally quote-only (you can't
// legally publish insurance-claim pricing anyway).
//
// Electrical is no longer offered (Parker, 2026-09-04) — the electrical
// flat-rate menu was removed here. Solar is no longer offered either
// (decision #14, 2026-09-04) — the solar service entry was removed here.

export type FlatRateItem = {
  job: string;
  detail: string;
  price: string; // display string, e.g. "$89" or "from $1,850"
  note?: string;
};

export type Service = {
  slug: string;
  title: string;
  short: string; // nav / card label
  blurb: string;
  pricingMode: "transparent" | "quote";
  bullets: string[];
};

export const services: Service[] = [
  {
    slug: "roofing",
    title: "Roofing repair & replacement",
    short: "Roofing",
    blurb:
      "Residential and commercial roofs — repairs, full replacements, and storm/insurance claims documented by the book.",
    pricingMode: "quote",
    bullets: [
      "Free, no-pressure roof inspection with photo documentation",
      "Residential re-roofs and commercial systems",
      "Storm & hail insurance claims documented to the letter of Texas law",
      "4 crews — capacity for up to 100 roofs a month, so you're not waiting weeks",
    ],
  },
  {
    slug: "commercial",
    title: "Commercial roofing",
    short: "Commercial",
    blurb:
      "One licensed, insured partner for property managers and business owners — scheduled, documented, and warrantied roof work.",
    pricingMode: "quote",
    bullets: [
      "Commercial roof systems, repairs, and replacements",
      "24/7 emergency response",
      "Single point of contact, one accountable crew",
    ],
  },
];

export function getService(slug: string) {
  return services.find((s) => s.slug === slug);
}
