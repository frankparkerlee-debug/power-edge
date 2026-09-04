// Service-area city pages — the backbone of local/organic findability.
// Each generates /service-areas/[slug] with localized copy + schema.
// Add or trim cities here; the routes, sitemap, and schema update automatically.
// Copy is storm-roofing-first (the business focus + the keywords that matter).

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
      "Dallas County leads the nation in hail losses — and after every storm the door-knockers follow. PowerEdge is the Dallas roofing company you can actually verify: storm and hail roof repair, full replacements, and insurance claims documented by the book.",
  },
  {
    slug: "fort-worth",
    name: "Fort Worth",
    county: "Tarrant County",
    lat: 32.7555,
    lon: -97.3308,
    blurb:
      "Storm and hail roof repair, full replacements, and insurance-claim roofing across Fort Worth and the mid-cities — with deductible financing so the out-of-pocket never stalls the work.",
  },
  {
    slug: "plano",
    name: "Plano",
    county: "Collin County",
    lat: 33.0198,
    lon: -96.6989,
    blurb:
      "Plano roofs take Collin County hail hard. We inspect free, document the damage for your claim, and replace roofs fast.",
  },
  {
    slug: "frisco",
    name: "Frisco",
    county: "Collin County",
    lat: 33.1507,
    lon: -96.8236,
    blurb:
      "Frisco's newer neighborhoods still lose roofs to hail every season. Free storm inspections and insurance claims documented right.",
  },
  {
    slug: "mckinney",
    name: "McKinney",
    county: "Collin County",
    lat: 33.1972,
    lon: -96.6398,
    blurb:
      "McKinney storm-damage roofing done by the book: free inspection, honest verdict in writing, and you typically pay only your deductible on a covered claim.",
  },
  {
    slug: "arlington",
    name: "Arlington",
    county: "Tarrant County",
    lat: 32.7357,
    lon: -97.1081,
    blurb:
      "Arlington hail and wind roof repair from a licensed, verifiable contractor — not a storm-chaser with a magnet sign. Insurance claims documented, deductibles financeable.",
  },
  {
    slug: "irving",
    name: "Irving",
    county: "Dallas County",
    lat: 32.814,
    lon: -96.9489,
    blurb:
      "Residential and commercial storm roofing throughout Irving and Las Colinas — repair, replacement, and hail claims handled with photos, measurements, and a written scope.",
  },
  {
    slug: "denton",
    name: "Denton",
    county: "Denton County",
    lat: 33.2148,
    lon: -97.1331,
    blurb:
      "Denton-area roof repair and replacement with free storm inspections and straight answers — if your roof is fine, we say so in writing.",
  },
  {
    slug: "garland",
    name: "Garland",
    county: "Dallas County",
    lat: 32.9126,
    lon: -96.6389,
    blurb:
      "Garland sits square in DFW's hail alley. Free roof inspections, storm-claim documentation, and replacement roofs at an honest price — deductible financing from $250 down.",
  },
  {
    slug: "richardson",
    name: "Richardson",
    county: "Dallas County",
    lat: 32.9483,
    lon: -96.7299,
    blurb:
      "Richardson roof repair and hail-claim replacements from a licensed contractor you can look up before you sign — free inspection, honest verdict, one accountable crew.",
  },
  {
    slug: "carrollton",
    name: "Carrollton",
    county: "Denton County",
    lat: 32.9756,
    lon: -96.89,
    blurb:
      "Carrollton storm and hail roofing: we document the damage the way your adjuster needs it, coordinate by the book, and get the roof done fast.",
  },
  {
    slug: "allen",
    name: "Allen",
    county: "Collin County",
    lat: 33.1032,
    lon: -96.6706,
    blurb:
      "Allen homeowners get a straight read after every storm — free inspection, written verdict, and insurance-claim roofing with the deductible financeable.",
  },
  {
    slug: "grand-prairie",
    name: "Grand Prairie",
    county: "Dallas County",
    lat: 32.746,
    lon: -96.9978,
    blurb:
      "Grand Prairie roof replacement and storm-damage repair — licensed, insured, and rated by North Texas homeowners, with capacity to be there this week.",
  },
  {
    slug: "flower-mound",
    name: "Flower Mound",
    county: "Denton County",
    lat: 33.0146,
    lon: -97.097,
    blurb:
      "Flower Mound hail-damage roofing done honestly: evidence-based inspections, claims documented by the book.",
  },
  {
    slug: "mansfield",
    name: "Mansfield",
    county: "Tarrant County",
    lat: 32.5632,
    lon: -97.1417,
    blurb:
      "Mansfield storm roof repair and full replacements — free inspection, honest scope in writing, and you typically pay just your deductible on a covered claim.",
  },
  {
    slug: "rockwall",
    name: "Rockwall",
    county: "Rockwall County",
    lat: 32.9312,
    lon: -96.4597,
    blurb:
      "Rockwall takes some of the metro's biggest hail. We check your address against NWS storm records free, then document the claim and do the roof right.",
  },
];

export function getCity(slug: string) {
  return cities.find((c) => c.slug === slug);
}
