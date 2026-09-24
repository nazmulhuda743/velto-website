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
  areaServed: { "@type": "Place", name: "Uttara, Dhaka" },
};

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
    areaServed: { "@type": "Place", name: "Uttara, Dhaka" },
  };
}

export function buildServiceSchema(service: { slug: string; name: string; meta: { description: string } }) {
  return {
    "@context": "https://schema.org",
    "@type": "Service",
    "@id": `${absoluteUrl(`/services/${service.slug}`)}#service`,
    name: service.name,
    description: service.meta.description,
    url: absoluteUrl(`/services/${service.slug}`),
    provider: { "@id": `${SITE_URL}/#organization` },
    areaServed: { "@type": "Place", name: "Uttara, Dhaka" },
  };
}

export function buildBreadcrumbSchema(items: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}
