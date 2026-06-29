// Service-area city pages — the backbone of local/organic findability.
// Each generates /service-areas/[slug] with localized copy + schema.
// Add or trim cities here; the routes and sitemap update automatically.

export type City = {
  slug: string;
  name: string;
  county: string;
  blurb: string;
  lat: number;
  lon: number;
};

export const cities: City[] = [
  {
    slug: "dallas",
    name: "Dallas",
    county: "Dallas County",
    lat: 32.7767,
    lon: -96.797,
    blurb:
      "From older homes near downtown needing panel upgrades to hail-battered roofs across the metro, PowerEdge serves Dallas with licensed electrical and roofing crews.",
  },
  {
    slug: "fort-worth",
    name: "Fort Worth",
    county: "Tarrant County",
    lat: 32.7555,
    lon: -97.3308,
    blurb:
      "Roof replacements, storm claims, and electrical service across Fort Worth and the mid-cities — backed by a 40-year Master Electrician.",
  },
  {
    slug: "plano",
    name: "Plano",
    county: "Collin County",
    lat: 33.0198,
    lon: -96.6989,
    blurb:
      "Plano homeowners and businesses get same-day electrical and fast roofing turnaround from a licensed, insured local crew.",
  },
  {
    slug: "frisco",
    name: "Frisco",
    county: "Collin County",
    lat: 33.1507,
    lon: -96.8236,
    blurb:
      "Growing Frisco neighborhoods trust PowerEdge for panel upgrades, EV chargers, roof repairs, and insurance-claim roofing done right.",
  },
  {
    slug: "mckinney",
    name: "McKinney",
    county: "Collin County",
    lat: 33.1972,
    lon: -96.6398,
    blurb:
      "Licensed electrical and roofing service across McKinney — transparent pricing on electrical, free inspections on roofs.",
  },
  {
    slug: "arlington",
    name: "Arlington",
    county: "Tarrant County",
    lat: 32.7357,
    lon: -97.1081,
    blurb:
      "Arlington roofing and electrical, from storm-damage replacements to service upgrades, handled by verifiable licensed pros.",
  },
  {
    slug: "irving",
    name: "Irving",
    county: "Dallas County",
    lat: 32.814,
    lon: -96.9489,
    blurb:
      "Residential and commercial roofing plus full electrical service throughout Irving and Las Colinas.",
  },
  {
    slug: "denton",
    name: "Denton",
    county: "Denton County",
    lat: 33.2148,
    lon: -97.1331,
    blurb:
      "Denton-area roofing and electrical with up-front electrical pricing and free roof inspections.",
  },
];

export function getCity(slug: string) {
  return cities.find((c) => c.slug === slug);
}
