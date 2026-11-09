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
      "Storm-first Dallas–Fort Worth roofing company: roof repair, replacement, and hail/storm insurance-claim documentation, with an honest verdict in writing on every inspection.",
    areaServed: cities.map((c) => ({
      "@type": "City",
      name: `${c.name}, TX`,
    })),
    address: {
      "@type": "PostalAddress",
      addressLocality: "Dallas",
      addressRegion: "TX",
      addressCountry: "US",
    },
    // Entity resolution: without sameAs, Google and the AI engines can't tie
    // this markup to the Google Business Profile that actually ranks locally.
    // TODO(parker): add Facebook / BBB / Yelp URLs here as they go live.
    sameAs: [site.googleReviewsUrl as string],
    geo: {
      "@type": "GeoCoordinates",
      latitude: 32.7767,
      longitude: -96.797,
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
      "Roof deductible financing",
      "Commercial roofing",
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
