import { site } from "@/lib/site";
import { cities } from "@/lib/cities";

/**
 * LocalBusiness structured data (JSON-LD) — helps Google understand the
 * business, surface the star rating, and rank in the local/map pack.
 * Rendered once in the root layout.
 */
export function Schema() {
  const data = {
    "@context": "https://schema.org",
    "@type": ["RoofingContractor", "Electrician"],
    name: site.legalName,
    url: site.url,
    telephone: site.phone,
    email: site.email,
    description:
      "Licensed Texas electrical contractor and roofing company serving the Dallas–Fort Worth metroplex.",
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
    hasCredential: `Texas Electrical Contractor License (TECL) #${site.teclLicense}`,
    knowsAbout: [
      "Roof replacement",
      "Roof repair",
      "Storm and hail damage",
      "Electrical panel upgrades",
      "EV charger installation",
      "Solar panel repair",
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
