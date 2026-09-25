import "server-only";

import type { Metadata } from "next";
import { getSeoRoute } from "@/content/seo-routes";
import { dictionary } from "@/content/i18n";
import { banglaIndexable, localizeHref } from "@/lib/i18n/config";
import { getLocale } from "@/lib/i18n/server";
import { getSiteContent } from "../site-content";

/** The generated brand card (src/app/opengraph-image.tsx). */
const DEFAULT_SHARE_IMAGE = { url: "/opengraph-image", width: 1200, height: 630 };

/**
 * Page metadata in the page's language. English: registry defaults, overridden by anything
 * saved in the admin dashboard. Bangla: the Bangla dictionary's title/description (falling
 * back to English), with the admin's share image and noindex choices applied to both.
 * Translated pages are canonical in each language and point at each other (hreflang). A /bn
 * page that isn't translated yet is noindex (follow), canonicalises to English and has no hreflang.
 */
export async function pageMetadata(path: string, options: { noindex?: boolean } = {}): Promise<Metadata> {
  const locale = await getLocale();
  const route = getSeoRoute(path);
  const override = (await getSiteContent()).seo[path] ?? {};
  const local = locale === "bn" ? dictionary("bn").seo[path] : undefined;
  const title = local?.title ?? override.title ?? route?.title;
  const description = local?.description ?? override.description ?? route?.description;
  const canonical = banglaIndexable(path) ? localizeHref(path, locale) : path;
  const untranslated = locale === "bn" && !banglaIndexable(path);
  return {
    title,
    description,
    alternates: await alternatesFor(path),
    openGraph: {
      title,
      description,
      url: canonical,
      siteName: "Velto Premium Laundry",
      locale: dictionary(locale).meta.ogLocale,
      type: "website",
      // Explicit, because a page-level openGraph object replaces the root opengraph-image file.
      images: override.ogImage ? [{ url: override.ogImage }] : [{ ...DEFAULT_SHARE_IMAGE, alt: dictionary(locale).meta.shareImageAlt }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [override.ogImage ?? DEFAULT_SHARE_IMAGE.url],
    },
    ...(override.noindex || options.noindex || untranslated ? { robots: { index: false, follow: true } } : {}),
  };
}

/**
 * Canonical URL for the current language, plus hreflang links, for pages with a finished
 * Bangla version. A /bn page that is not translated yet canonicalises to its English page.
 */
export async function alternatesFor(path: string): Promise<NonNullable<Metadata["alternates"]>> {
  if (!banglaIndexable(path)) return { canonical: path };
  return {
    canonical: localizeHref(path, await getLocale()),
    languages: { en: path, bn: localizeHref(path, "bn"), "x-default": path },
  };
}
