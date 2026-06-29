// Central source of truth for NAP (name/address/phone), licensing, and trust signals.
// Edit values here once; they propagate across the whole site, schema, and footer.

export const site = {
  name: "PowerEdge",
  legalName: "PowerEdge Electric & Roofing",
  tagline: "Roofing and electrical, under one license you can actually verify.",
  // Primary + secondary lines pulled from the current live site.
  phone: "469-689-0614",
  phoneSecondary: "469-402-0396",
  phoneHref: "tel:+14696890614",
  email: "info@poweredgetx.com", // TODO(parker): confirm the real inbox for web leads
  domain: "poweredgetx.com",
  url: "https://poweredgetx.com",

  // Trust signals — all verifiable, which is the entire point.
  teclLicense: "39773",
  tdlrVerifyUrl: "https://www.tdlr.texas.gov/LicenseSearch/",
  liabilityCoverage: "$2,000,000",
  googleRating: "4.7",
  googleReviewCount: "48",
  // TODO(parker): paste the public Google review/maps URL here for the "read reviews" link.
  googleReviewsUrl: "#",
  // TODO(parker): paste the Jobber "Request work" / booking URL the current site uses.
  jobberBookingUrl: "#",

  // Workmanship guarantee from current site FAQ.
  workmanshipGuarantee: "1-year workmanship guarantee",

  // The people. Real names build more trust than any stock photo.
  team: [
    {
      name: "John Lott",
      role: "Master Electrician",
      cred: "40 years of electrical work",
      bio: "Holds the Master Electrician license every legitimate electrical and solar job in Texas is legally required to run under. Forty years on the tools across residential, commercial, and industrial work.",
    },
    {
      name: "Ernesto Sandoval",
      role: "Roofing Project Manager",
      cred: "20 years roofing & construction",
      bio: "Runs the roofing side end to end — inspection, insurance documentation, crew scheduling, and the final walk. Two decades of roofing and construction across North Texas.",
    },
  ],

  // Capacity / scale — a real differentiator vs. a two-truck operation.
  capacity: {
    crews: 4,
    roofsPerMonth: 100,
    electricians: 15,
  },

  serviceArea:
    "Dallas–Fort Worth metroplex and surrounding North Texas communities",
} as const;

export type Site = typeof site;
