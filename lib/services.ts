// Service catalog + electrical flat-rate menu.
//
// PRICING NOTE (read this, Parker):
// The dollar figures below are PLACEHOLDERS structured for a penetration/
// land-grab strategy (priced to win share, thin margin now). They are NOT
// verified market numbers — the research could not confirm reliable TX price
// benchmarks. Set your real numbers here in ONE place and they update the whole
// site. Roofing & storm/insurance work is intentionally quote-only (you can't
// legally publish insurance-claim pricing anyway).

export type FlatRateItem = {
  job: string;
  detail: string;
  price: string; // display string, e.g. "$89" or "from $1,850"
  note?: string;
};

export const electricalMenu: { group: string; items: FlatRateItem[] }[] = [
  {
    group: "Service calls & diagnostics",
    items: [
      {
        job: "Diagnostic / service visit",
        detail: "Licensed electrician to your door, problem diagnosed, written quote before any work.",
        price: "$89",
        note: "Waived if you book the repair the same visit.",
      },
      {
        job: "Dead outlet or switch",
        detail: "Troubleshoot and repair a non-working outlet, switch, or circuit.",
        price: "from $149",
      },
      {
        job: "Tripping breaker repair",
        detail: "Find the fault, fix or replace the breaker, verify the circuit.",
        price: "from $189",
      },
    ],
  },
  {
    group: "Panels & capacity",
    items: [
      {
        job: "Breaker replacement",
        detail: "Replace a single failed breaker, tested and code-checked.",
        price: "from $229",
      },
      {
        job: "Panel swap (same amperage)",
        detail: "Replace an aging or recalled panel like-for-like.",
        price: "from $1,850",
        note: "Final price after free on-site assessment.",
      },
      {
        job: "Service upgrade to 200A",
        detail: "Heavy-up from 100A to 200A — permit, panel, and inspection included.",
        price: "from $2,650",
        note: "Final price after free on-site assessment.",
      },
    ],
  },
  {
    group: "Installs & safety",
    items: [
      {
        job: "Ceiling fan / fixture install",
        detail: "Mount and wire a customer-supplied fixture on an existing box.",
        price: "from $159",
      },
      {
        job: "EV charger circuit",
        detail: "Dedicated 240V circuit for a Level 2 home charger.",
        price: "from $695",
        note: "Final price depends on run length and panel capacity.",
      },
      {
        job: "Whole-home surge protection",
        detail: "Panel-mounted surge protective device, installed and tested.",
        price: "from $349",
      },
    ],
  },
];

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
    slug: "electrical",
    title: "Electrical service & panels",
    short: "Electrical",
    blurb:
      "Same-day service, repairs, panel upgrades, and installs — run under a 40-year Master Electrician's license, with prices published up front.",
    pricingMode: "transparent",
    bullets: [
      "Same-day diagnostics and repairs",
      "Panel swaps and 200A service upgrades",
      "EV chargers, surge protection, fixtures, and circuits",
      "Up-front flat-rate pricing — no surprise invoices",
    ],
  },
  {
    slug: "solar",
    title: "Solar repair & replacement",
    short: "Solar",
    blurb:
      "We service and replace existing solar — the electrical work solar legally requires a licensed contractor to perform. (We do not sell new installs.)",
    pricingMode: "quote",
    bullets: [
      "Repair underperforming or dead panels and microinverters",
      "Replace damaged panels after storms",
      "Re-connect and re-energize systems during a roof replacement",
      "Performed under our Master Electrician license — as Texas law requires",
    ],
  },
  {
    slug: "commercial",
    title: "Commercial electrical & roofing",
    short: "Commercial",
    blurb:
      "One licensed partner for property managers and business owners across roofing and electrical — scheduled, documented, and warrantied.",
    pricingMode: "quote",
    bullets: [
      "Commercial roof systems, repairs, and replacements",
      "Electrical installs, upgrades, and routine maintenance",
      "24/7 emergency response",
      "Single point of contact for both trades",
    ],
  },
];

export function getService(slug: string) {
  return services.find((s) => s.slug === slug);
}
