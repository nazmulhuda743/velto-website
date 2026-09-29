import { dictionary, type Dictionary } from "@/content/i18n";
import { CUSTOMER_PORTAL } from "@/content/site";
import { SERVICE_PAGES } from "@/content/services";
import type { FooterColumn, FooterLink } from "@/lib/footer-links";

/** Help column links; labels come from the menu text (content/i18n), so they follow Text & copy edits. */
const HELP: { key: keyof Dictionary["nav"]; href: string }[] = [
  { key: "pricing", href: "/pricing" },
  { key: "howItWorks", href: "/how-it-works" },
  { key: "regularLaundry", href: "/regular-laundry" },
  { key: "requestQuote", href: "/quote" },
  { key: "trackAnOrder", href: "/track" },
  ...(CUSTOMER_PORTAL.enabled ? [{ key: "myAccount" as const, href: CUSTOMER_PORTAL.href }] : []),
  { key: "about", href: "/about" },
];

/** The footer's built-in links, in both languages: what the site shows until a column is saved in the admin. */
export function defaultFooterLinks(): Record<FooterColumn, FooterLink[]> {
  const en = dictionary("en");
  const bn = dictionary("bn");
  return {
    services: [
      { label: en.footer.allServices, labelBn: bn.footer.allServices, href: "/services", hidden: false },
      ...SERVICE_PAGES.map((s) => ({
        label: en.serviceNames[s.slug] ?? s.name,
        labelBn: bn.serviceNames[s.slug] ?? "",
        href: `/services/${s.slug}`,
        hidden: false,
      })),
    ],
    help: HELP.map((h) => ({ label: en.nav[h.key], labelBn: bn.nav[h.key], href: h.href, hidden: false })),
  };
}
