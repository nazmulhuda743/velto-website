/**
 * Business facts confirmed in docs/PROJECT-BUILD-SPEC.md (§4, §20, §36).
 * Anything that still needs live verification before launch is marked
 * TODO_VERIFY. Do not add facts here that are not in the specification.
 */

/** Confirmed core pickup sectors (§4). Word joiners keep "1–18" on one line. */
export const SERVICE_SECTORS = "1\u2060–\u206018";
export const SERVICE_AREA = `Uttara Sectors ${SERVICE_SECTORS}`;

/** Dry Cleaning and Wash & Iron are usually around 72 hours (§4). A planning figure, never a promise. */
export const USUAL_TURNAROUND_HOURS = 72;

/** Free pickup & delivery threshold (§4). */
export const FREE_DELIVERY_THRESHOLD = "৳499";

/** Owner-confirmed: on a fixed weekly or fortnightly pickup, regular orders qualify from this amount. */
export const REGULAR_FREE_DELIVERY_THRESHOLD = "৳300";

/**
 * Homepage durable Google proof (§21). Refers to the Sector 11 profile only.
 * Fallback is used if live rating data is unavailable (§20 hero).
 */
export const GOOGLE_PROOF = {
  label: "5.0 on Google · 100+ reviews",
  fallback: "100+ Google reviews",
  rating: 5,
};

/**
 * All WhatsApp actions go through this redirect, which opens the number set in
 * the admin dashboard (default: the owner-confirmed +880 1605-162788).
 */
export const WHATSAPP_URL = "/go/whatsapp";

export type Location = {
  id: "sector-11" | "sector-18";
  name: string;
  /** TODO_VERIFY: review counts must be re-checked immediately before launch (§20, §36). */
  rating: string;
  reviewCount: number;
  address: string;
  hours: string;
  /** TODO_VERIFY: final Google Maps directions links (§36). */
  directionsUrl: string;
  /** TODO_VERIFY: final Google review source links (§36). */
  reviewsUrl: string;
};

const mapsQuery = (q: string) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;

export const LOCATIONS: Location[] = [
  {
    id: "sector-11",
    name: "Sector 11",
    rating: "5.0",
    reviewCount: 102,
    address: "House 2, Road 14, Sector 11, Uttara, Dhaka",
    hours: "9:00 AM–10:00 PM",
    directionsUrl: mapsQuery("Velto Premium Laundry, House 2, Road 14, Sector 11, Uttara, Dhaka"),
    reviewsUrl: mapsQuery("Velto Premium Laundry Sector 11 Uttara"),
  },
  {
    id: "sector-18",
    name: "Sector 18",
    rating: "4.9",
    reviewCount: 8,
    address: "RUAP, North Side of Gate 1, Poncoboti Bazar, Sector 18, Uttara, Dhaka",
    hours: "10:00 AM–9:00 PM",
    directionsUrl: mapsQuery("Velto Premium Laundry, RUAP, Poncoboti Bazar, Sector 18, Uttara, Dhaka"),
    reviewsUrl: mapsQuery("Velto Premium Laundry Sector 18 Uttara"),
  },
];

/** Booking entry point with source attribution (§22). */
export const bookHref = (source: string, service?: string) => {
  const params = new URLSearchParams();
  if (service) params.set("service", service);
  params.set("source", source);
  return `/book?${params.toString()}`;
};

/** Household quote entry point, preserving the selected service (§7, §22). */
export const quoteHref = (service: string | undefined, source: string) => {
  const params = new URLSearchParams();
  if (service) params.set("service", service);
  params.set("source", source);
  return `/quote?${params.toString()}`;
};

export const SERVICES = {
  dryCleaning: { slug: "dry-cleaning", href: "/services/dry-cleaning" },
  washAndIron: { slug: "wash-and-iron", href: "/services/wash-and-iron" },
  ironing: { slug: "ironing", href: "/services/ironing" },
  curtains: { slug: "curtain-cleaning", href: "/services/curtain-cleaning" },
  carpets: { slug: "carpet-cleaning", href: "/services/carpet-cleaning" },
  blankets: { slug: "blanket-comforter-cleaning", href: "/services/blanket-comforter-cleaning" },
  express: { slug: "express", href: "/services/express" },
} as const;

/**
 * Customer Portal hand-off. The portal team owns /account and auth; when it
 * lands, flip `enabled` (or replace it with the signed-in state) and "My
 * Account" appears in the header utility links, mobile menu and footer.
 * Nothing here checks a session or builds auth.
 */
export const CUSTOMER_PORTAL = { enabled: false, href: "/account", label: "My Account" } as const;

const ACCOUNT_LINK = CUSTOMER_PORTAL.enabled ? [{ key: "myAccount", label: CUSTOMER_PORTAL.label, href: CUSTOMER_PORTAL.href }] : [];

/** `key` names the label in the UI dictionary (content/i18n) so menus follow the page language. */
export type NavItem = { key: "services" | "howItWorks" | "pricing" | "locations" | "regularLaundry" | "trackAnOrder" | "trackOrder" | "myAccount"; label: string; href: string };

export const NAV: { desktop: NavItem[]; mobile: NavItem[]; utility: NavItem[] } = {
  desktop: [
    { key: "services", label: "Services", href: "/services" },
    { key: "howItWorks", label: "How It Works", href: "/how-it-works" },
    { key: "pricing", label: "Pricing", href: "/pricing" },
    { key: "locations", label: "Locations", href: "/locations" },
  ],
  mobile: [
    { key: "services", label: "Services", href: "/services" },
    { key: "howItWorks", label: "How It Works", href: "/how-it-works" },
    { key: "pricing", label: "Pricing", href: "/pricing" },
    { key: "regularLaundry", label: "Regular Laundry", href: "/regular-laundry" },
    { key: "locations", label: "Locations", href: "/locations" },
    { key: "trackAnOrder", label: "Track an Order", href: "/track" },
    ...(ACCOUNT_LINK as NavItem[]),
  ],
  /** Quiet header links for returning customers (desktop, ≥1280px). */
  utility: [{ key: "trackOrder", label: "Track Order", href: "/track" }, ...(ACCOUNT_LINK as NavItem[])],
};
