import type { NextConfig } from "next";

const isVercelPreview = Boolean(process.env.VERCEL_ENV) && process.env.VERCEL_ENV !== "production";
const isVercelProduction = process.env.VERCEL_ENV === "production";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-DNS-Prefetch-Control", value: "on" },
  { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=()" },
  ...(isVercelProduction
    ? [{ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" }]
    : []),
  ...(isVercelPreview
    ? [{ key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" }]
    : []),
];

const nextConfig: NextConfig = {
  agentRules: false,
  devIndicators: false,
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      { protocol: "https", hostname: "*.supabase.co", pathname: "/storage/v1/object/public/website-media/**" },
    ],
  },
  experimental: {
    serverActions: { bodySizeLimit: "9mb" },
  },
  async redirects() {
    return [
      { source: "/about-us", destination: "/about", permanent: true },
      { source: "/contact", destination: "/locations", permanent: true },
      { source: "/checkout", destination: "/book", permanent: true },
      { source: "/team", destination: "/about", permanent: true },
      { source: "/services/mens-item", destination: "/services", permanent: true },
      { source: "/services/ladies-item", destination: "/services", permanent: true },
      { source: "/services/house-hold-item", destination: "/services", permanent: true },
      { source: "/services/special-item", destination: "/services", permanent: true },
    ];
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
