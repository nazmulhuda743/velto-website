import "server-only";

/**
 * Public-safe pricing shape (spec §6). Mirrors the Codex pricing adapter
 * contract (`src/lib/integrations/pricing/types.ts` on
 * codex/velto-technical-foundation) so swapping the mock for
 * `getPricingSource().search()` needs no UI change.
 */
export type PublicPriceService = {
  slug: string;
  name: string;
  /** Integer minor units (paisa); null means the price requires confirmation. */
  amountMinor: number | null;
  currency: "BDT";
  unitLabel: string | null;
};

export type PublicPriceItem = {
  slug: string;
  name: string;
  services: PublicPriceService[];
};

/** Where the items came from. The UI marks prices as placeholders only for "mock". */
export type PriceSource = "mock" | "live";

const svc = (slug: string, name: string): PublicPriceService => ({
  slug,
  name,
  amountMinor: null,
  currency: "BDT",
  unitLabel: null,
});

const DRY = () => svc("dry-cleaning", "Dry Cleaning");
const WASH = () => svc("wash-and-iron", "Wash & Iron");
const IRON = () => svc("ironing", "Ironing");

/**
 * MOCK — stands in for the controlled Velto Ops / Supabase pricing view.
 * Amounts are null on purpose: live prices must come from the approved source
 * and are never invented here. Item/service availability is TODO_VERIFY.
 */
const MOCK_ITEMS: PublicPriceItem[] = [
  { slug: "shirt", name: "Shirt", services: [IRON(), WASH(), DRY()] },
  { slug: "blazer", name: "Blazer", services: [DRY()] },
  { slug: "saree", name: "Saree", services: [IRON(), DRY()] },
  { slug: "suit", name: "Suit", services: [DRY()] },
  { slug: "sherwani", name: "Sherwani", services: [DRY()] },
];

export const PRICE_SOURCE: PriceSource = "mock";

const MAX_RESULTS = 5;

export async function searchPriceItems(query: string): Promise<PublicPriceItem[]> {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];
  const starts = MOCK_ITEMS.filter((i) => i.name.toLowerCase().startsWith(q));
  const contains = MOCK_ITEMS.filter((i) => !starts.includes(i) && i.name.toLowerCase().includes(q));
  return [...starts, ...contains].slice(0, MAX_RESULTS);
}
