const FALLBACK_SITE_URL = "https://www.velto.com.bd";

function normalizeSiteUrl(value: string | undefined) {
  const candidate = value?.trim() || FALLBACK_SITE_URL;
  try {
    const url = new URL(candidate);
    if (url.protocol !== "https:" && url.protocol !== "http:") return FALLBACK_SITE_URL;
    return url.origin;
  } catch {
    return FALLBACK_SITE_URL;
  }
}

export const SITE_URL = normalizeSiteUrl(process.env.NEXT_PUBLIC_SITE_URL);
export const SITE_NAME = "Velto Premium Laundry";
export const DEFAULT_TITLE = "Laundry & dry cleaning in Uttara | Velto Premium Laundry";
export const DEFAULT_DESCRIPTION =
  "Laundry, dry cleaning and ironing in Uttara, with pickup across Sectors 1–18. View pricing, request a quote or book a pickup with Velto.";

export function absoluteUrl(path = "/") {
  return new URL(path, `${SITE_URL}/`).toString();
}

/**
 * Search-facing launch routes only. Utility/conversion pages such as /book,
 * /quote, /privacy and /terms intentionally stay out of the sitemap.
 */
export const INDEXABLE_ROUTES = [
  "/",
  "/services",
  "/services/dry-cleaning",
  "/services/wash-and-iron",
  "/services/ironing",
  "/services/curtain-cleaning",
  "/services/carpet-cleaning",
  "/services/blanket-comforter-cleaning",
  "/services/express",
  "/regular-laundry",
  "/pricing",
  "/how-it-works",
  "/locations",
  "/locations/sector-11",
  "/locations/sector-18",
  "/about",
] as const;
