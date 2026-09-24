import type { NextConfig } from "next";

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
};

export default nextConfig;
