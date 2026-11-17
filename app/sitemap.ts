import type { MetadataRoute } from "next";
import { site } from "@/lib/site";
import { services } from "@/lib/services";
import { cities } from "@/lib/cities";
import { guides } from "@/lib/guides";
import { PAGE_MIN_IN, serviceAreaHail, stormDays } from "@/lib/hailHistory";

// Rebuilt every 6 hours so a new storm day's page is listed the day it happens.
export const revalidate = 21600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = site.url;
  const staticRoutes = [
    "",
    "/about",
    "/contact",
    "/roof-claim-check",
    "/free-inspection",
    "/schedule",
    "/agreement",
    "/roof-check",
    "/financing",
    "/careers",
    "/privacy",
    "/terms",
    "/guides",
  ];
  const serviceRoutes = services.map((s) => `/${s.slug}`);
  const cityRoutes = cities.map((c) => `/service-areas/${c.slug}`);
  const guideRoutes = guides.map((g) => `/guides/${g.slug}`);

  const pages: MetadataRoute.Sitemap = [...staticRoutes, ...serviceRoutes, ...guideRoutes].map((path) => ({
    url: `${base}${path}`,
    changeFrequency: "weekly",
    priority: path === "" ? 1 : 0.7,
  }));

  // Pages whose content follows the weather: they change whenever hail is reported.
  const now = new Date();
  const days = stormDays(await serviceAreaHail("2025-08-01T00:00:00Z")).filter((d) => d.maxIn >= PAGE_MIN_IN);
  const live: MetadataRoute.Sitemap = [
    { url: `${base}/hail-reports`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    ...cityRoutes.map((path) => ({ url: `${base}${path}`, lastModified: now, changeFrequency: "daily" as const, priority: 0.8 })),
    ...days.map((d) => ({
      url: `${base}/hail-reports/${d.date}`,
      lastModified: new Date(`${d.date}T23:59:00-05:00`),
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
  ];

  return [...pages, ...live];
}
