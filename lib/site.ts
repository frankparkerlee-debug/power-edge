// Central source of truth for NAP (name/address/phone), licensing, and trust signals.
// Edit values here once; they propagate across the whole site, schema, and footer.

export const site = {
  name: "PowerEdge",
  legalName: "PowerEdge Roofing & Home Repair",
  legalEntity: "Power Edge, LLC", // registered entity (formerly Solar Shield LLC), used in legal/SMS copy
  tagline: "Roofing and home repair, done by an insured, accountable team you can actually verify.",
  // Primary + secondary lines pulled from the current live site.
  phone: "469-277-9594",
  phoneHref: "tel:+14692779594",
  // Text line = the floating-bar pool number (per Parker).
  textNumber: "469-277-9594",
  textHref: "sms:+14692779594",
  email: "contact@poweredgetx.com", // confirmed by Parker 2026-11-09
  domain: "poweredgetx.com",
  url: "https://poweredgetx.com",

  // Trust signals, all verifiable, which is the entire point.
  // teclLicense retired for good: it was John Lott's electrical TECL, and
  // electrical is being dropped from the business (decision #19, 2026-09-06).
  // No licence backs "licensed & insured" anymore, Texas doesn't license
  // roofers either. Sitewide copy was rewritten to lean on liabilityCoverage,
  // workmanshipGuarantee, and the Google rating instead (grep "insured &
  // accountable"). Only restore teclLicense if a real, current credential
  // (e.g. a roofing-specific certification) is confirmed.
  teclLicense: "",
  tdlrVerifyUrl: "https://www.tdlr.texas.gov/LicenseSearch/",
  liabilityCoverage: "$2,000,000",
  googleRating: "4.7",
  googleReviewCount: "48",
  // Google Business Profile (knowledge graph id /g/11w7qkc808). Confirmed by
  // Parker 2026-11-09. This is the PROFILE link, which is what sameAs needs.
  googleReviewsUrl: "https://share.google/KrfxkKBSh3Zd0XMSt",
  // TODO(parker): paste your Google "write a review" link here (GBP dashboard →
  // "Ask for reviews" → copy link; looks like https://g.page/r/XXXXXXXX/review).
  // Powers the /review short link your team texts to customers.
  googleWriteReviewUrl: "#",
  // jobberBookingUrl removed 2026-11-08: nothing read it, and /schedule now
  // books inspections natively rather than handing people to Jobber.

  // Workmanship guarantee from current site FAQ.
  workmanshipGuarantee: "1-year workmanship guarantee",

  // The people. Real names build more trust than any stock photo.
  team: [
    {
      name: "John Lott",
      role: "Senior Crew Lead",
      cred: "40 years in the trades",
      bio: "Forty years on the tools across residential, commercial, and industrial work, the senior hand on PowerEdge's crews.",
    },
    {
      name: "Ernesto Sandoval",
      role: "Roofing Project Manager",
      cred: "20 years roofing & construction",
      bio: "Runs the roofing side end to end, inspection, insurance documentation, crew scheduling, and the final walk. Two decades of roofing and construction across North Texas.",
    },
  ],

  // Capacity. NOT rendered publicly as of 2026-11-08: "four crews, ~100 roofs
  // a month" was on nine pages and in the email engine, and on a site whose
  // whole argument is that a homeowner can verify us, it is the one number a
  // homeowner could test and find wanting. Parker had already pulled it from
  // the email signature. Public copy now says "our own crews" instead, which
  // is true at any crew count. Restore the numbers here only if they are
  // currently accurate and you want them back on the site.
  capacity: {
    crews: 4,
    roofsPerMonth: 100,
  },

  // Parker 2026-11-09: the whole of North Texas, not just the metroplex. DFW
  // stays the primary SEO anchor because that is where the search volume is;
  // North Texas is how the coverage is stated.
  serviceArea: "North Texas, including the Dallas–Fort Worth metroplex",
} as const;

export type Site = typeof site;
