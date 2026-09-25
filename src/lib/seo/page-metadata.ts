import "server-only";

import type { Metadata } from "next";
import { getSeoRoute } from "@/content/seo-routes";
import { dictionary } from "@/content/i18n";
import { banglaEnabled, localizeHref } from "@/lib/i18n/config";
import { getLocale } from "@/lib/i18n/server";
import { getSiteContent } from "../site-content";

/** The generated brand card (src/app/opengraph-image.tsx). */
const DEFAULT_SHARE_IMAGE = { url: "/opengraph-image", width: 1200, height: 630 };

/**
 * Page metadata in the page's language. English: registry defaults, overridden by anything
 * saved in the admin dashboard. Bangla: the Bangla dictionary's title/description (falling
 * back to English), with the admin's share image and noindex choices applied to both.
 * Each language is canonical at its own URL, and the two point at each other (hreflang).
 */
export async function pageMetadata(path: string, options: { noindex?: boolean } = {}): Promise<Metadata> {
  const locale = await getLocale();
  const route = getSeoRoute(path);
  const override = (await getSiteContent()).seo[path] ?? {};
  const local = locale === "bn" ? dictionary("bn").seo[path] : undefined;
  const title = local?.title ?? override.title ?? route?.title;
  const description = local?.description ?? override.description ?? route?.description;
  const canonical = localizeHref(path, locale);
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
    ...(override.noindex || options.noindex ? { robots: { index: false, follow: true } } : {}),
  };
}

/** Canonical URL for the current language, plus hreflang links while Bangla is on. */
export async function alternatesFor(path: string): Promise<NonNullable<Metadata["alternates"]>> {
  const locale = await getLocale();
  return {
    canonical: localizeHref(path, locale),
    ...(banglaEnabled() ? { languages: { en: path, bn: localizeHref(path, "bn"), "x-default": path } } : {}),
  };
}
