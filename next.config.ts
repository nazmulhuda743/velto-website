import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // AGENTS.md is project-owned (Marchitect build instructions); do not let Next.js edit it.
  agentRules: false,
  devIndicators: false,
  images: {
    formats: ["image/avif", "image/webp"],
  },
};

export default nextConfig;
