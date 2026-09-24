import "server-only";

/**
 * Public-safe pricing shape (spec §6). The browser only ever receives these
 * fields — never costs, internal ids or anything else from Velto Ops.
 */
export type PublicPriceItem = {
  slug: string;
  name: string;
  services: { service: string; price: number | null }[];
};

/**
 * MOCK — stands in for the controlled Velto Ops / Supabase pricing view.
 * Prices are null on purpose: live prices must come from the approved source
 * and are never invented here. Item/service availability is TODO_VERIFY.
 */
const MOCK_ITEMS: PublicPriceItem[] = [
  {
    slug: "shirt",
    name: "Shirt",
    services: [
      { service: "Ironing", price: null },
      { service: "Wash & Iron", price: null },
      { service: "Dry Cleaning", price: null },
    ],
  },
  {
    slug: "blazer",
    name: "Blazer",
    services: [{ service: "Dry Cleaning", price: null }],
  },
  {
    slug: "saree",
    name: "Saree",
    services: [
      { service: "Ironing", price: null },
      { service: "Dry Cleaning", price: null },
    ],
  },
  {
    slug: "suit",
    name: "Suit",
    services: [{ service: "Dry Cleaning", price: null }],
  },
  {
    slug: "sherwani",
    name: "Sherwani",
    services: [{ service: "Dry Cleaning", price: null }],
  },
];

const MAX_RESULTS = 5;

export async function searchPriceItems(query: string): Promise<PublicPriceItem[]> {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];
  const starts = MOCK_ITEMS.filter((i) => i.name.toLowerCase().startsWith(q));
  const contains = MOCK_ITEMS.filter(
    (i) => !starts.includes(i) && i.name.toLowerCase().includes(q),
  );
  return [...starts, ...contains].slice(0, MAX_RESULTS);
}
