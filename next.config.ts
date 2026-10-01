import type { NextConfig } from "next";

const isVercelPreview = Boolean(process.env.VERCEL_ENV) && process.env.VERCEL_ENV !== "production";

/**
 * Content-Security-Policy, in two layers.
 *
 * ENFORCED — only directives that cannot break a working page: no framing of the site, no
 * <base> hijack, no plugins. This already stops clickjacking of the customer portal and the
 * staff admin, which carry sessions with real authority.
 *
 * REPORT-ONLY — the full allowlist the site should converge on (GTM after consent, Supabase,
 * Google Maps embeds). Browsers log every violation without blocking anything, so it can be
 * checked in the browser console on each page type before it is promoted to enforced.
 * `'unsafe-inline'` remains for scripts because Next.js injects inline bootstrap scripts;
 * removing it needs nonce-based CSP (middleware + dynamic rendering), a separate change.
 */
const enforcedCsp = ["frame-ancestors 'none'", "base-uri 'self'", "object-src 'none'"].join("; ");

const reportOnlyCsp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://www.googletagmanager.com https://*.googletagmanager.com https://*.google-analytics.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' https://*.supabase.co https://*.google-analytics.com https://*.analytics.google.com https://*.googletagmanager.com",
  "frame-src https://maps.google.com https://www.google.com https://www.googletagmanager.com",
  "form-action 'self' https://accounts.google.com https://*.supabase.co",
  "worker-src 'self'",
  "manifest-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "object-src 'none'",
].join("; ");

const securityHeaders = [
  // One year, this host only: no includeSubDomains/preload until every velto.com.bd
  // subdomain is confirmed HTTPS-only (preload is effectively irreversible).
  { key: "Strict-Transport-Security", value: "max-age=31536000" },
  { key: "Content-Security-Policy", value: enforcedCsp },
  { key: "Content-Security-Policy-Report-Only", value: reportOnlyCsp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-DNS-Prefetch-Control", value: "on" },
  {
    key: "Permissions-Policy",
    value: "camera=(self), microphone=(), geolocation=()",
  },
  ...(isVercelPreview
    ? [{ key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" }]
    : []),
];

const nextConfig: NextConfig = {
  // AGENTS.md is project-owned (Marchitect build instructions); do not let Next.js edit it.
  agentRules: false,
  devIndicators: false,
  images: {
    formats: ["image/avif", "image/webp"],
    // Photos uploaded from the admin dashboard live in the website-media Storage bucket.
    remotePatterns: [
      { protocol: "https", hostname: "*.supabase.co", pathname: "/storage/v1/object/public/website-media/**" },
    ],
  },
  experimental: {
    // Admin image uploads are capped at 8 MB; leave room for multipart overhead.
    serverActions: { bodySizeLimit: "9mb" },
  },
  /**
   * Old Webflow URLs (from www.velto.com.bd/sitemap.xml, 25 Sep 2026), kept alive after the
   * DNS cutover so bookmarks, Google results and old ads land on the closest page.
   * Old Webflow account URLs point at their Customer Portal equivalents. Customers sign in with
   * a mobile number or Google, so the old password pages go to sign-in (temporary redirects).
   */
  async redirects() {
    const to = (source: string, destination: string) => ({ source, destination, permanent: true });
    const moved = (source: string, destination: string) => ({ source, destination, permanent: false });
    return [
      to("/contact", "/locations"),
      to("/about-us", "/about"),
      to("/team", "/about"),
      to("/checkout", "/book"),
      to("/paypal-checkout", "/book"),
      to("/order-confirmation", "/track"),
      to("/utility/:path*", "/"),
      to("/services/mens-ethnic-wear", "/services/dry-cleaning"),
      to("/services/womens-ethnic-wear", "/services/dry-cleaning"),
      to("/services/occasion-wear", "/services/dry-cleaning"),
      to("/services/winter-and-outerwear", "/services/dry-cleaning"),
      to("/services/casual-wear", "/services/wash-and-iron"),
      to("/services/bottom-wear", "/services/wash-and-iron"),
      to("/services/innerwear-and-accessories", "/services/wash-and-iron"),
      to("/services/home-and-lifestyle", "/services"),
      to("/log-in", "/login"),
      to("/sign-up", "/signup"),
      to("/update-password", "/login"),
      to("/access-denied", "/login"),
      to("/user-account", "/account"),
      moved("/forgot-password", "/login"),
      moved("/reset-password", "/login"),
      moved("/bn/forgot-password", "/bn/login"),
      moved("/bn/reset-password", "/bn/login"),
    ];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
