/**
 * The order garment services are shown in wherever prices appear (price finder results, popular
 * prices, comparison tables, service price tables, the app's price list): Wash & Iron first, then
 * Dry Cleaning, then Ironing. Owner decision, 13 Nov 2026. Runtime-neutral, so client and server
 * code and the foundation tests share it.
 */
export const PRICE_SERVICE_ORDER = ["wash-and-iron", "dry-cleaning", "ironing"] as const;

/** Position of a service in the price order; services not in it go after, keeping their order. */
export function priceServiceRank(slug: string): number {
  const i = (PRICE_SERVICE_ORDER as readonly string[]).indexOf(slug);
  return i === -1 ? PRICE_SERVICE_ORDER.length : i;
}

/** A copy of `services` in the price order (stable for services outside it). */
export function inPriceOrder<T extends { slug: string }>(services: readonly T[]): T[] {
  return [...services].sort((a, b) => priceServiceRank(a.slug) - priceServiceRank(b.slug));
}
