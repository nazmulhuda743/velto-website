import type { MetadataRoute } from "next";
import { absoluteUrl, INDEXABLE_ROUTES } from "@/lib/seo/site";

/**
 * Only the search-facing pages (INDEXABLE_ROUTES). No lastModified: a build
 * timestamp on every URL would tell Google everything changed on every deploy.
 * changefreq/priority are ignored by Google and left out.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return INDEXABLE_ROUTES.map((path) => ({ url: absoluteUrl(path) }));
}
