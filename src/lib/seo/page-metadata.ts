import "server-only";

import type { Metadata } from "next";
import { getSeoRoute } from "@/content/seo-routes";
import { getServicePage } from "@/content/services";
import { dictionary } from "@/content/i18n";
import { banglaIndexable, localizeHref } from "@/lib/i18n/config";
import { getLocale } from "@/lib/i18n/server";
import { getSiteContent } from "../site-content";

/** The generated brand card (src/app/opengraph-image.tsx). */
const DEFAULT_SHARE_IMAGE = { url: "/opengraph-image", width: 1200, height: 630 };

/**
 * Pages with their own share card (public/images/share, made by scripts/generate-share-images.mjs):
 * the page's headline and photo. Other pages use the brand card.
 */
const SHARE_CARD_PAGES = new Set([
  "/", "/services", "/pricing", "/how-it-works", "/regular-laundry", "/locations", "/about", "/book", "/quote", "/track",
  "/locations/sector-11", "/locations/sector-18",
  ...["dry-cleaning", "wash-and-iron", "ironing", "curtain-cleaning", "carpet-cleaning", "blanket-comforter-cleaning", "express"].map((s) => `/services/${s}`),
]);

/** The Bangla cards (name-bn.jpg) are in public/images/share: /bn pages show the Bangla headline. */
const BANGLA_CARDS = true;

/** Pages outside pageMetadata with their own card: sign-in, sign-up and the legal pages (English only). */
const OWN_CARD_PAGES = new Set(["/login", "/signup"]);
const BANGLA_UNINDEXED = new Set(["/book", "/quote", "/track"]);
const ENGLISH_CARD_PAGES = new Set(["/privacy", "/terms", "/cookies"]);

function shareImage(path: string, locale: "en" | "bn") {
  if (ENGLISH_CARD_PAGES.has(path)) locale = "en";
  else if (!SHARE_CARD_PAGES.has(path) && !OWN_CARD_PAGES.has(path)) return DEFAULT_SHARE_IMAGE;
  const name = path === "/" ? "home" : path.slice(1).replace(/\//g, "-");
  return { url: `/images/share/${name}${locale === "bn" && BANGLA_CARDS ? "-bn" : ""}.jpg`, width: 1200, height: 630 };
}

/**
 * Page metadata in the page's language. English: registry defaults, overridden by anything
 * saved in the admin dashboard. Bangla: the admin's Bangla title/description, else the Bangla
 * dictionary's (falling back to English), with the admin's share image and noindex choices
 * applied to both.
 * Translated pages are canonical in each language and point at each other (hreflang). A /bn
 * page that isn't translated yet is noindex (follow), canonicalises to English and has no hreflang.
 */
export async function pageMetadata(path: string, options: { noindex?: boolean } = {}): Promise<Metadata> {
  const locale = await getLocale();
  const route = getSeoRoute(path);
  const override = (await getSiteContent()).seo[path] ?? {};
  const local =
    locale === "bn"
      ? (dictionary("bn").seo[path] ?? (path.startsWith("/services/") ? getServicePage(path.slice(10), "bn")?.meta : undefined))
      : undefined;
  // Bangla: the admin's Bangla text, then the built-in Bangla, then English. English is unchanged.
  const title = (locale === "bn" ? override.titleBn : undefined) ?? local?.title ?? override.title ?? route?.title;
  const description = (locale === "bn" ? override.descriptionBn : undefined) ?? local?.description ?? override.description ?? route?.description;
  const canonical = banglaIndexable(path) ? localizeHref(path, locale) : path;
  const untranslated = locale === "bn" && !banglaIndexable(path);
  // Book, quote and track are in Bangla but kept out of the index, so they count as "untranslated" above.
  const card = shareImage(path, locale === "bn" && (!untranslated || BANGLA_UNINDEXED.has(path)) ? "bn" : "en");
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
      images: override.ogImage ? [{ url: override.ogImage }] : [{ ...card, alt: title ?? dictionary(locale).meta.shareImageAlt }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [override.ogImage ?? card.url],
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

/**
 * Share card for a page that builds its own metadata (sign-in, sign-up, legal pages).
 * A page's openGraph object replaces the root one, so the title goes in with the image.
 */
export async function shareCardMetadata(path: string, title: string, description?: string): Promise<Pick<Metadata, "openGraph" | "twitter">> {
  const locale = await getLocale();
  const card = shareImage(path, locale === "bn" ? "bn" : "en");
  return {
    openGraph: { title, description, siteName: "Velto Premium Laundry", type: "website", images: [{ ...card, alt: title }] },
    twitter: { card: "summary_large_image", title, description, images: [card.url] },
  };
}
