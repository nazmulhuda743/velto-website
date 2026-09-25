import type { NextConfig } from "next";

const isVercelPreview = Boolean(process.env.VERCEL_ENV) && process.env.VERCEL_ENV !== "production";

const securityHeaders = [
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
   * Old account URLs (/log-in, /sign-up, /reset-password, /update-password, /user-account,
   * /access-denied) are left to the Customer Portal work; see docs/technical/DNS-CUTOVER.md.
   */
  async redirects() {
    const to = (source: string, destination: string) => ({ source, destination, permanent: true });
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
