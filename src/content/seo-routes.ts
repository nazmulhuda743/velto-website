/**
 * Default SEO for every public page. Pages read their metadata from here, and
 * the admin dashboard can override title, description, share image and
 * indexing per path (src/lib/seo.ts).
 */
import { SERVICE_PAGES } from "./services";
import { LOCATIONS } from "./site";

export type SeoRoute = { path: string; label: string; group: string; title: string; description: string };

export const SEO_ROUTES: SeoRoute[] = [
  {
    path: "/",
    label: "Homepage",
    group: "Main",
    title: "Laundry & Dry Cleaning in Uttara with Pickup | Velto",
    description:
      "Laundry, dry cleaning and ironing in Uttara, Dhaka. Pickup from your door across Sectors 1–18, every item tagged and checked. Free pickup on ৳499+.",
  },
  {
    path: "/services",
    label: "Services overview",
    group: "Main",
    title: "Velto Services: Dry Cleaning, Wash & Iron, Curtains & More",
    description:
      "Dry cleaning, Wash & Iron, ironing, curtains, carpets, blankets and Express, with pickup across Uttara Sectors 1–18. Find the right service for what you're sending.",
  },
  ...SERVICE_PAGES.map((s) => ({
    path: `/services/${s.slug}`,
    label: s.name,
    group: "Services",
    title: s.meta.title,
    description: s.meta.description,
  })),
  {
    path: "/pricing",
    label: "Pricing",
    group: "Main",
    title: "Laundry & Dry Cleaning Prices in Uttara | Velto",
    description:
      "Search Velto's current price list for dry cleaning, Wash & Iron and ironing in Uttara: shirts, blazers, saris and more. Free pickup and delivery on ৳499+.",
  },
  {
    path: "/how-it-works",
    label: "How It Works",
    group: "Main",
    title: "How Laundry Pickup & Delivery Works in Uttara | Velto",
    description: "From booking to return: how Velto collects, checks in, tags, cleans, checks and returns your order in Uttara.",
  },
  {
    path: "/regular-laundry",
    label: "Regular Laundry",
    group: "Main",
    title: "Weekly Laundry Pickup in Uttara | Velto Regular Laundry",
    description:
      "Set up a weekly or fortnightly laundry and ironing pickup in Uttara. Regular orders of ৳300+ qualify for free pickup and delivery.",
  },
  {
    path: "/locations",
    label: "Locations",
    group: "Locations",
    title: "Velto Laundry Locations in Uttara: Sector 11 & Sector 18",
    description:
      "Velto's laundry and dry cleaning outlets in Uttara Sector 11 and Sector 18 (RUAP), with pickup and delivery from your door across Uttara Sectors 1–18.",
  },
  ...LOCATIONS.map((l) => ({
    path: `/locations/${l.id}`,
    label: `Location: ${l.name}`,
    group: "Locations",
    title: `Laundry & Dry Cleaning in Uttara ${l.name}${l.id === "sector-18" ? ", RUAP" : ""} | Velto`,
    description: `Velto ${l.name}: ${l.address}. Open ${l.hours}. Drop off laundry and dry cleaning here, or book a pickup anywhere in Uttara Sectors 1–18.`,
  })),
  {
    path: "/about",
    label: "About",
    group: "Main",
    title: "About Velto: Laundry & Dry Cleaning in Uttara, Dhaka",
    description:
      "Velto is a laundry and dry cleaning service in Uttara with outlets in Sector 11 and Sector 18 and written procedures for every order.",
  },
  {
    path: "/book",
    label: "Book a Pickup",
    group: "Forms",
    title: "Book a Laundry Pickup in Uttara | Velto",
    description: "Book a laundry or dry cleaning pickup from your door in Uttara Sectors 1–18.",
  },
  {
    path: "/quote",
    label: "Request a Quote",
    group: "Forms",
    title: "Request a Quote: Curtains, Carpets & Bedding | Velto",
    description:
      "Request a quote for curtain, carpet, blanket or comforter cleaning in Uttara. Share approximate sizes and an optional photo.",
  },
  {
    path: "/track",
    label: "Track an Order",
    group: "Forms",
    title: "Track Your Velto Order",
    description: "Check the status of your Velto laundry or dry cleaning order with your order number and phone number.",
  },
];

export const getSeoRoute = (path: string) => SEO_ROUTES.find((r) => r.path === path);
