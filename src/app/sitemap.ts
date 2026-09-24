import type { MetadataRoute } from "next";
import { absoluteUrl, INDEXABLE_ROUTES } from "@/lib/seo/site";

const HIGH_VALUE_ROUTES = new Set([
  "/",
  "/services",
  "/pricing",
  "/locations",
]);

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  return INDEXABLE_ROUTES.map((path) => ({
    url: absoluteUrl(path),
    lastModified: now,
    changeFrequency: path === "/" ? "weekly" : "monthly",
    priority: path === "/" ? 1 : HIGH_VALUE_ROUTES.has(path) ? 0.9 : 0.8,
  }));
}
