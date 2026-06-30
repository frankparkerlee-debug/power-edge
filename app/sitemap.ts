import type { MetadataRoute } from "next";
import { site } from "@/lib/site";
import { services } from "@/lib/services";
import { cities } from "@/lib/cities";
import { guides } from "@/lib/guides";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = site.url;
  const staticRoutes = [
    "",
    "/about",
    "/contact",
    "/roof-check",
    "/storm-check",
    "/roof-estimate",
    "/privacy",
    "/terms",
    "/guides",
  ];
  const serviceRoutes = services.map((s) => `/${s.slug}`);
  const cityRoutes = cities.map((c) => `/service-areas/${c.slug}`);
  const guideRoutes = guides.map((g) => `/guides/${g.slug}`);

  return [...staticRoutes, ...serviceRoutes, ...cityRoutes, ...guideRoutes].map((path) => ({
    url: `${base}${path}`,
    changeFrequency: "weekly",
    priority: path === "" ? 1 : 0.7,
  }));
}
