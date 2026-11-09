import { site } from "@/lib/site";
import { cities } from "@/lib/cities";
import { services } from "@/lib/services";

/**
 * LocalBusiness structured data (JSON-LD). Uses the precise schema.org subtypes
 * (RoofingContractor under HomeAndConstructionBusiness) carrying
 * NAP, areaServed, rating, and a service catalog, the markup that aids normal
 * SEO rich-result eligibility and gives engines clean entity data.
 * Rendered once in the root layout.
 */
export function Schema() {
  const logo = `${site.url}/brand/poweredge-icon.png`;
  const data = {
    "@context": "https://schema.org",
    "@type": ["RoofingContractor", "HomeAndConstructionBusiness"],
    "@id": `${site.url}/#business`,
    name: site.legalName,
    legalName: site.legalEntity,
    url: site.url,
    logo,
    image: logo,
    telephone: site.phone,
    email: site.email,
    priceRange: "$$",
    description:
      "Storm-first roofing company serving North Texas and the Dallas–Fort Worth metroplex: roof repair, replacement, and hail/storm insurance-claim documentation, with in-house deductible financing and an honest verdict in writing on every inspection.",
    // Counties first, then the cities we have pages for. Stating the counties
    // is how an engine answers "do they cover Weatherford" when there is no
    // Weatherford page. These are the 11 counties the storm engine already
    // ingests, so the claim matches what we can actually act on.
    areaServed: [
      ...[
        "Tarrant", "Dallas", "Denton", "Collin", "Parker", "Johnson",
        "Wise", "Rockwall", "Ellis", "Kaufman", "Hunt",
      ].map((c) => ({ "@type": "AdministrativeArea", name: `${c} County, TX` })),
      ...cities.map((c) => ({ "@type": "City", name: `${c.name}, TX` })),
    ],
    address: {
      "@type": "PostalAddress",
      addressLocality: "Dallas",
      addressRegion: "TX",
      addressCountry: "US",
    },
    // Entity resolution: without sameAs, Google and the AI engines can't tie
    // this markup to the Google Business Profile that actually ranks locally.
    // Confirmed profile 2026-11-09 (knowledge graph id /g/11w7qkc808).
    // TODO(parker): add Facebook / BBB / Yelp URLs here as they go live.
    sameAs: [site.googleReviewsUrl as string],
    // Actual business location from the verified Google profile, not a
    // downtown-Dallas centroid. Local ranking keys off proximity.
    geo: {
      "@type": "GeoCoordinates",
      latitude: 32.8408977,
      longitude: -96.7722327,
    },
    openingHoursSpecification: [
      {
        "@type": "OpeningHoursSpecification",
        dayOfWeek: [
          "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday",
        ],
        opens: "07:00",
        closes: "19:00",
      },
    ],
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: site.googleRating,
      reviewCount: site.googleReviewCount,
      bestRating: "5",
    },
    hasOfferCatalog: {
      "@type": "OfferCatalog",
      name: "Roofing & home repair services",
      itemListElement: services.map((s) => ({
        "@type": "Offer",
        itemOffered: {
          "@type": "Service",
          name: s.title,
          areaServed: site.serviceArea,
        },
      })),
    },
    knowsAbout: [
      "Roof replacement",
      "Roof repair",
      "Hail damage roof insurance claims",
      "Storm damage restoration",
      "In-house roof deductible financing",
      "Commercial roofing",
      "Siding repair and replacement",
      "Gutter and fascia replacement",
      "Fence repair and replacement",
    ],
  };

  return (
    <script
      type="application/ld+json"
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
