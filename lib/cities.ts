// Service-area city pages — the backbone of local/organic findability.
// Each generates /service-areas/[slug] with localized copy + schema.
// Add or trim cities here; the routes and sitemap update automatically.

export type City = {
  slug: string;
  name: string;
  county: string;
  blurb: string;
};

export const cities: City[] = [
  {
    slug: "dallas",
    name: "Dallas",
    county: "Dallas County",
    blurb:
      "From older homes near downtown needing panel upgrades to hail-battered roofs across the metro, PowerEdge serves Dallas with licensed electrical and roofing crews.",
  },
  {
    slug: "fort-worth",
    name: "Fort Worth",
    county: "Tarrant County",
    blurb:
      "Roof replacements, storm claims, and electrical service across Fort Worth and the mid-cities — backed by a 40-year Master Electrician.",
  },
  {
    slug: "plano",
    name: "Plano",
    county: "Collin County",
    blurb:
      "Plano homeowners and businesses get same-day electrical and fast roofing turnaround from a licensed, insured local crew.",
  },
  {
    slug: "frisco",
    name: "Frisco",
    county: "Collin County",
    blurb:
      "Growing Frisco neighborhoods trust PowerEdge for panel upgrades, EV chargers, roof repairs, and insurance-claim roofing done right.",
  },
  {
    slug: "mckinney",
    name: "McKinney",
    county: "Collin County",
    blurb:
      "Licensed electrical and roofing service across McKinney — transparent pricing on electrical, free inspections on roofs.",
  },
  {
    slug: "arlington",
    name: "Arlington",
    county: "Tarrant County",
    blurb:
      "Arlington roofing and electrical, from storm-damage replacements to service upgrades, handled by verifiable licensed pros.",
  },
  {
    slug: "irving",
    name: "Irving",
    county: "Dallas County",
    blurb:
      "Residential and commercial roofing plus full electrical service throughout Irving and Las Colinas.",
  },
  {
    slug: "denton",
    name: "Denton",
    county: "Denton County",
    blurb:
      "Denton-area roofing and electrical with up-front electrical pricing and free roof inspections.",
  },
];

export function getCity(slug: string) {
  return cities.find((c) => c.slug === slug);
}
