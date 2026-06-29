import type { MetadataRoute } from "next";
import { site } from "@/lib/site";
import { services } from "@/lib/services";
import { cities } from "@/lib/cities";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = site.url;
  const staticRoutes = ["", "/about", "/contact"];
  const serviceRoutes = services.map((s) => `/${s.slug}`);
  const cityRoutes = cities.map((c) => `/service-areas/${c.slug}`);

  return [...staticRoutes, ...serviceRoutes, ...cityRoutes].map((path) => ({
    url: `${base}${path}`,
    changeFrequency: "weekly",
    priority: path === "" ? 1 : 0.7,
  }));
}
