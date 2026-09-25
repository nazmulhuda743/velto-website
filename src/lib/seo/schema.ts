import type { Location } from "@/content/site";
import { LOCATIONS } from "@/content/site";
import { absoluteUrl, SITE_NAME, SITE_URL } from "@/lib/seo/site";

/**
 * Structured data, one entity graph for the whole site:
 *
 *   #organization  Organization (the Velto brand)          site-wide
 *   #website       WebSite, published by #organization     site-wide
 *   /locations/x#business  DryCleaningOrLaundry per outlet  location pages (+ referenced elsewhere)
 *   Service        per service page, provided by #organization
 *   BreadcrumbList per page
 *
 * Only verified facts from docs/PROJECT-BUILD-SPEC.md: no telephone, opening
 * hours, coordinates, prices or ratings (see docs/seo/VELTO-SEO-MASTER-PLAN.md
 * §Schema for what is deliberately left out and why).
 */

export const ORGANIZATION_ID = `${SITE_URL}/#organization`;
export const locationId = (loc: Pick<Location, "id">) => `${absoluteUrl(`/locations/${loc.id}`)}#business`;

/** The confirmed pickup and delivery area (§4). */
export const SERVICE_AREA_SCHEMA = {
  "@type": "Place",
  name: "Uttara Sectors 1–18, Dhaka",
  address: { "@type": "PostalAddress", addressLocality: "Uttara", addressRegion: "Dhaka", addressCountry: "BD" },
};

export const WEBSITE_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  "@id": `${SITE_URL}/#website`,
  name: SITE_NAME,
  alternateName: "Velto",
  url: SITE_URL,
  inLanguage: "en-BD",
  publisher: { "@id": ORGANIZATION_ID },
};

export const ORGANIZATION_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "Organization",
  "@id": ORGANIZATION_ID,
  name: SITE_NAME,
  alternateName: "Velto",
  url: SITE_URL,
  logo: absoluteUrl("/brand/velto-logo.png"),
  description:
    "Laundry, dry cleaning and ironing in Uttara, Dhaka, with pickup and delivery across Uttara Sectors 1–18 and outlets in Sector 11 and Sector 18.",
  areaServed: SERVICE_AREA_SCHEMA,
  location: LOCATIONS.map((l) => ({ "@id": locationId(l) })),
};

/** One outlet as a local business. Street address is split so it isn't repeated in the locality. */
export function buildLaundryLocationSchema(location: Location) {
  return {
    "@context": "https://schema.org",
    "@type": "DryCleaningOrLaundry",
    "@id": locationId(location),
    name: `${SITE_NAME}, ${location.name}`,
    url: absoluteUrl(`/locations/${location.id}`),
    image: absoluteUrl("/brand/velto-logo.png"),
    logo: absoluteUrl("/brand/velto-logo.png"),
    parentOrganization: { "@id": ORGANIZATION_ID },
    address: {
      "@type": "PostalAddress",
      streetAddress: location.address.replace(/, Uttara, Dhaka$/, ""),
      addressLocality: "Uttara",
      addressRegion: "Dhaka",
      addressCountry: "BD",
    },
    hasMap: location.directionsUrl,
    areaServed: SERVICE_AREA_SCHEMA,
  };
}

export function buildBreadcrumbSchema(crumbs: { label: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: c.label,
      item: absoluteUrl(c.path),
    })),
  };
}

export function buildServiceSchema({ name, description, path }: { name: string; description: string; path: string }) {
  return {
    "@context": "https://schema.org",
    "@type": "Service",
    "@id": `${absoluteUrl(path)}#service`,
    name,
    serviceType: name,
    description,
    url: absoluteUrl(path),
    provider: { "@id": ORGANIZATION_ID },
    areaServed: SERVICE_AREA_SCHEMA,
    availableChannel: [
      { "@type": "ServiceChannel", name: "Pickup and delivery", serviceUrl: absoluteUrl("/book") },
      ...LOCATIONS.map((l) => ({ "@type": "ServiceChannel", name: `Drop off at Velto ${l.name}`, serviceLocation: { "@id": locationId(l) } })),
    ],
  };
}
