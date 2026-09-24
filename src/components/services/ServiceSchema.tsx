import { LOCATIONS } from "@/content/site";
import { SITE_URL, absoluteUrl } from "@/lib/site-url";

const BUSINESS_ID = `${SITE_URL}/#business`;

const outlet = (loc: (typeof LOCATIONS)[number]) => ({
  "@type": "DryCleaningOrLaundry",
  name: `Velto Premium Laundry, ${loc.name}`,
  address: {
    "@type": "PostalAddress",
    streetAddress: loc.address.replace(/, Uttara, Dhaka$/, ""),
    addressLocality: "Uttara, Dhaka",
    addressCountry: "BD",
  },
});

/**
 * Service + breadcrumb structured data. Only verified, non-volatile facts:
 * no prices (they change in Ops) and no ratings (counts need re-verification).
 */
export function ServiceSchema({
  name,
  description,
  path,
  crumbs,
}: {
  name: string;
  description: string;
  path: string;
  crumbs: { label: string; path: string }[];
}) {
  const data = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Service",
        name,
        serviceType: name,
        description,
        url: absoluteUrl(path),
        areaServed: { "@type": "Place", name: "Uttara, Dhaka" },
        provider: { "@id": BUSINESS_ID },
      },
      {
        ...outlet(LOCATIONS[0]),
        "@id": BUSINESS_ID,
        name: "Velto Premium Laundry",
        url: SITE_URL,
        department: LOCATIONS.slice(1).map(outlet),
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: crumbs.map((c, i) => ({
          "@type": "ListItem",
          position: i + 1,
          name: c.label,
          item: absoluteUrl(c.path),
        })),
      },
    ],
  };
  return (
    <script
      type="application/ld+json"
      // JSON.stringify output with "<" escaped cannot break out of the script element.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}
