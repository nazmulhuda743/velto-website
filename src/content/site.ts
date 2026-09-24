/**
 * Business facts confirmed in docs/PROJECT-BUILD-SPEC.md (§4, §20, §36).
 * Anything that still needs live verification before launch is marked
 * TODO_VERIFY. Do not add facts here that are not in the specification.
 */

/** Word joiners keep "1–18" on one line. */
export const SERVICE_AREA = "Uttara Sectors 1\u2060–\u206018";

/** Free pickup & delivery threshold (§4). */
export const FREE_DELIVERY_THRESHOLD = "৳499";

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
 * TODO_VERIFY: final WhatsApp destination (§36). Until the number is supplied
 * this opens WhatsApp without a pre-selected chat.
 */
export const WHATSAPP_URL = "https://wa.me/";

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

export const SERVICES = {
  dryCleaning: { slug: "dry-cleaning", href: "/services/dry-cleaning" },
  washAndIron: { slug: "wash-and-iron", href: "/services/wash-and-iron" },
  ironing: { slug: "ironing", href: "/services/ironing" },
  curtains: { slug: "curtain-cleaning", href: "/services/curtain-cleaning" },
  carpets: { slug: "carpet-cleaning", href: "/services/carpet-cleaning" },
  blankets: { slug: "blanket-comforter-cleaning", href: "/services/blanket-comforter-cleaning" },
} as const;

export const NAV = {
  desktop: [
    { label: "Services", href: "/services" },
    { label: "How It Works", href: "/how-it-works" },
    { label: "Pricing", href: "/pricing" },
    { label: "Locations", href: "/locations" },
  ],
  mobile: [
    { label: "Services", href: "/services" },
    { label: "How It Works", href: "/how-it-works" },
    { label: "Pricing", href: "/pricing" },
    { label: "Regular Laundry", href: "/regular-laundry" },
    { label: "Locations", href: "/locations" },
  ],
};
