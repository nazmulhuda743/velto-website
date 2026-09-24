import "server-only";

import type { Metadata } from "next";
import { getSeoRoute } from "@/content/seo-routes";
import { getSiteContent } from "./site-content";

/** Page metadata: registry defaults, overridden by anything saved in the admin dashboard. */
export async function pageMetadata(path: string): Promise<Metadata> {
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
      ...(override.ogImage ? { images: [{ url: override.ogImage }] } : {}),
    },
    ...(override.noindex ? { robots: { index: false, follow: true } } : {}),
  };
}
