/**
 * Absolute site origin for canonical URLs and structured data.
 * NEXT_PUBLIC_SITE_URL is the reviewed canonical production origin used by
 * metadata/sitemap checks. SITE_URL remains a server-side compatibility
 * fallback, followed by Vercel's production domain and local development.
 */
function normalizeOrigin(value: string | undefined) {
  if (!value) return null;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return url.origin;
  } catch {
    return null;
  }
}

export const SITE_URL =
  normalizeOrigin(process.env.NEXT_PUBLIC_SITE_URL) ??
  normalizeOrigin(process.env.SITE_URL) ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "http://localhost:3000");

export const absoluteUrl = (path: string) => new URL(path, `${SITE_URL}/`).toString();
