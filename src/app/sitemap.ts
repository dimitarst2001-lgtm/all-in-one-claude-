import type { MetadataRoute } from "next";

import { siteConfig } from "@/config/site";
import { getBusinessPaths, getCities } from "@/features/marketplace/queries";

/**
 * Lists only pages with real content: active cities with listings, their
 * non-empty category pages and public business profiles (demo profiles are
 * noindex and therefore excluded).
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteConfig.url;
  const [cities, businesses] = await Promise.all([
    getCities().catch(() => []),
    getBusinessPaths().catch(() => []),
  ]);

  const staticPages: MetadataRoute.Sitemap = [
    "/",
    "/for-businesses",
    "/privacy",
    "/terms",
    "/cookies",
  ].map((path) => ({
    url: `${base}${path}`,
    changeFrequency: path === "/" ? "daily" : "monthly",
    priority: path === "/" ? 1 : 0.3,
  }));

  const cityPages = cities.flatMap((city) => {
    const categories = Object.entries(city.category_counts).filter(
      ([, count]) => count > 0,
    );
    if (categories.length === 0) return [];
    return [
      {
        url: `${base}/${city.slug}`,
        changeFrequency: "daily" as const,
        priority: 0.8,
      },
      ...categories.map(([category]) => ({
        url: `${base}/${city.slug}/${category}`,
        changeFrequency: "daily" as const,
        priority: 0.7,
      })),
    ];
  });

  const profilePages = businesses
    .filter((business) => !business.is_demo)
    .map((business) => ({
      url: `${base}/businesses/${business.city}/${business.slug}`,
      lastModified: new Date(business.updated_at),
      changeFrequency: "weekly" as const,
      priority: 0.6,
    }));

  return [...staticPages, ...cityPages, ...profilePages];
}
