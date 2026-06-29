// Featured reviews shown on the site.
// TODO(parker): replace these with real quotes pulled from your Google profile.
// Keep 3–6 of your strongest, most specific recent ones (recency matters for
// trust after the year-end service dip — favor the freshest 5-star reviews).

export type Review = {
  quote: string;
  author: string;
  location: string;
  service: string;
};

export const reviews: Review[] = [
  {
    quote:
      "Showed up same day, found the breaker that kept tripping in ten minutes, and the price was exactly what they quoted. No upsell, no nonsense.",
    author: "Marcus T.",
    location: "Plano, TX",
    service: "Electrical service",
  },
  {
    quote:
      "After the hail storm they walked the roof with me, took photos, and handled the whole insurance claim straight. New roof on in two days.",
    author: "Danielle R.",
    location: "Fort Worth, TX",
    service: "Storm / insurance roof",
  },
  {
    quote:
      "Had three other companies out for a panel upgrade. PowerEdge was the only one who showed me their license number and explained the actual work. Easy call.",
    author: "Steve K.",
    location: "Dallas, TX",
    service: "200A service upgrade",
  },
];
