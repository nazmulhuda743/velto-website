import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo/site";

export default function robots(): MetadataRoute.Robots {
  const isVercelPreview =
    Boolean(process.env.VERCEL_ENV) && process.env.VERCEL_ENV !== "production";

  if (isVercelPreview) {
    return {
      rules: [{ userAgent: "*", disallow: "/" }],
    };
  }

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/admin", "/go/"],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
