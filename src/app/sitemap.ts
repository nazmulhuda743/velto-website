import type { MetadataRoute } from "next";
import { banglaEnabled, localizeHref } from "@/lib/i18n/config";
import { absoluteUrl, INDEXABLE_ROUTES } from "@/lib/seo/site";

/**
 * Only the search-facing pages (INDEXABLE_ROUTES). No lastModified: a build
 * timestamp on every URL would tell Google everything changed on every deploy.
 * changefreq/priority are ignored by Google and left out.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const bangla = banglaEnabled();
  // With Bangla on, each page is listed in both languages and names its counterpart.
  const languages = (path: string) =>
    bangla ? { alternates: { languages: { en: absoluteUrl(path), bn: absoluteUrl(localizeHref(path, "bn")) } } } : {};

  return INDEXABLE_ROUTES.flatMap((path) =>
    (bangla ? [path, localizeHref(path, "bn")] : [path]).map((url) => ({ url: absoluteUrl(url), ...languages(path) })),
  );
}
