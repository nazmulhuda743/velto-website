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
