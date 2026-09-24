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
    title: "Velto Premium Laundry — Laundry & dry cleaning in Uttara",
    description: "Laundry and dry cleaning in Uttara, with pickup from your door. We collect across Uttara Sectors 1–18.",
  },
  {
    path: "/services",
    label: "Services overview",
    group: "Main",
    title: "Laundry and dry cleaning services in Uttara | Velto",
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
    title: "Pricing — Velto Premium Laundry, Uttara",
    description: "Search the current Velto price for an item and service. Free pickup and delivery on orders of ৳499+ in Uttara.",
  },
  {
    path: "/how-it-works",
    label: "How It Works",
    group: "Main",
    title: "How It Works — Velto Premium Laundry, Uttara",
    description: "From booking to return: how Velto collects, checks in, tags, cleans, checks and returns your order in Uttara.",
  },
  {
    path: "/regular-laundry",
    label: "Regular Laundry",
    group: "Main",
    title: "Regular Laundry Pickup — Velto, Uttara",
    description: "Set up a recurring laundry and ironing pickup in Uttara so you don't need to book from scratch every week.",
  },
  {
    path: "/locations",
    label: "Locations",
    group: "Locations",
    title: "Locations — Velto in Uttara Sector 11 and Sector 18",
    description: "Velto outlets in Uttara Sector 11 and Sector 18, with pickup and delivery across Uttara Sectors 1–18.",
  },
  ...LOCATIONS.map((l) => ({
    path: `/locations/${l.id}`,
    label: `Location: ${l.name}`,
    group: "Locations",
    title: `Velto ${l.name}, Uttara — address and hours`,
    description: `Velto ${l.name} outlet: ${l.address}. Open ${l.hours}.`,
  })),
  {
    path: "/about",
    label: "About",
    group: "Main",
    title: "About Velto — laundry and dry cleaning in Uttara",
    description:
      "Velto is a laundry and dry cleaning service in Uttara with outlets in Sector 11 and Sector 18 and written procedures for every order.",
  },
  {
    path: "/book",
    label: "Book a Pickup",
    group: "Forms",
    title: "Book a Pickup — Velto, Uttara",
    description: "Book a laundry or dry cleaning pickup from your door in Uttara Sectors 1–18.",
  },
  {
    path: "/quote",
    label: "Request a Quote",
    group: "Forms",
    title: "Request a Quote — curtains, carpets and bedding | Velto",
    description:
      "Request a quote for curtain, carpet, blanket or comforter cleaning in Uttara. Share approximate sizes and an optional photo.",
  },
  {
    path: "/track",
    label: "Track an Order",
    group: "Forms",
    title: "Track your order — Velto, Uttara",
    description: "Check the status of your Velto laundry or dry cleaning order with your order number and phone number.",
  },
];

export const getSeoRoute = (path: string) => SEO_ROUTES.find((r) => r.path === path);
