import "server-only";

import type { Metadata } from "next";
import { getSeoRoute } from "@/content/seo-routes";
import { getSiteContent } from "../site-content";

/** The generated brand card (src/app/opengraph-image.tsx). */
const DEFAULT_SHARE_IMAGE = {
  url: "/opengraph-image",
  width: 1200,
  height: 630,
  alt: "Velto Premium Laundry: laundry and dry cleaning in Uttara, with pickup from your door.",
};

/** Page metadata: registry defaults, overridden by anything saved in the admin dashboard. */
export async function pageMetadata(path: string, options: { noindex?: boolean } = {}): Promise<Metadata> {
  const route = getSeoRoute(path);
  const override = (await getSiteContent()).seo[path] ?? {};
  const title = override.title ?? route?.title;
  const description = override.description ?? route?.description;
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      title,
      description,
      url: path,
      siteName: "Velto Premium Laundry",
      locale: "en_BD",
      type: "website",
      // Explicit, because a page-level openGraph object replaces the root opengraph-image file.
      images: override.ogImage ? [{ url: override.ogImage }] : [DEFAULT_SHARE_IMAGE],
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
