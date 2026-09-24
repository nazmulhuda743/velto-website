/**
 * Absolute site origin for canonical URLs and structured data. SITE_URL wins;
 * otherwise Vercel's production domain; otherwise local development.
 */
export const SITE_URL = (
  process.env.SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "http://localhost:3000")
).replace(/\/$/, "");

export const absoluteUrl = (path: string) => `${SITE_URL}${path}`;
