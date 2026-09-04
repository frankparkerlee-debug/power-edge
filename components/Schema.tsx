import { site } from "@/lib/site";
import { cities } from "@/lib/cities";
import { services } from "@/lib/services";

/**
 * LocalBusiness structured data (JSON-LD). Uses the precise schema.org subtypes
 * (RoofingContractor under HomeAndConstructionBusiness) carrying
 * NAP, areaServed, rating, and a service catalog — the markup that aids normal
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
      "Storm-first Dallas–Fort Worth roofing company: roof repair, replacement, hail/storm insurance-claim documentation, and deductible financing.",
    areaServed: cities.map((c) => ({
      "@type": "City",
      name: `${c.name}, TX`,
    })),
    address: {
      "@type": "PostalAddress",
      addressRegion: "TX",
      addressCountry: "US",
    },
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: site.googleRating,
      reviewCount: site.googleReviewCount,
      bestRating: "5",
    },
    hasCredential: `Licensed & insured`,
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
