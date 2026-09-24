import type { Location } from "@/content/site";
import { absoluteUrl, SITE_NAME, SITE_URL } from "@/lib/seo/site";

export const WEBSITE_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  "@id": `${SITE_URL}/#website`,
  name: SITE_NAME,
  url: SITE_URL,
};

export const ORGANIZATION_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "Organization",
  "@id": `${SITE_URL}/#organization`,
  name: SITE_NAME,
  url: SITE_URL,
  logo: absoluteUrl("/brand/velto-logo.png"),
  areaServed: {
    "@type": "Place",
    name: "Uttara, Dhaka",
  },
};

/**
 * Location pages can use this once their page content is launch-approved.
 * It deliberately uses only facts already present in the project source of truth.
 */
export function buildLaundryLocationSchema(location: Location) {
  return {
    "@context": "https://schema.org",
    "@type": "LaundryService",
    "@id": `${absoluteUrl(`/locations/${location.id}`)}#location`,
    name: `${SITE_NAME} — ${location.name}`,
    url: absoluteUrl(`/locations/${location.id}`),
    image: absoluteUrl("/brand/velto-logo.png"),
    address: {
      "@type": "PostalAddress",
      streetAddress: location.address,
      addressLocality: "Uttara",
      addressRegion: "Dhaka",
      addressCountry: "BD",
    },
    areaServed: {
      "@type": "Place",
      name: "Uttara, Dhaka",
    },
  };
}
