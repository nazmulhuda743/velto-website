/**
 * The everyday items the price finder shows before anything is typed (home and /pricing).
 * Names are exact Velto Ops price-list names; the amounts only ever come from the live list.
 */
export const POPULAR_PRICE_ITEMS = ["Shirt", "Pant", "Panjabi", "Sari (Cotton)", "Blazer", "Bed Sheet (Medium)"];

/** Fewer rows than this reads as a broken table, so nothing is shown instead. */
export const POPULAR_PRICE_MIN_ROWS = 2;

type Priced = { name: string; services: { amountMinor: number | null }[] };

/**
 * The popular rows to show, in the order of `names`: only items the price list returned with at
 * least one real price, each once, at most `max`. Returns [] when too few are left to be useful.
 */
export function pickPopularItems<T extends Priced>(items: readonly T[], names: readonly string[] = POPULAR_PRICE_ITEMS, max = names.length): T[] {
  const picked: T[] = [];
  for (const name of new Set(names)) {
    if (picked.length >= max) break;
    const item = items.find((i) => i.name === name);
    if (item && item.services.some((s) => s.amountMinor !== null)) picked.push(item);
  }
  return picked.length >= POPULAR_PRICE_MIN_ROWS ? picked : [];
}
