/**
 * "Add ৳179 more for free pickup & delivery": the add-ons the booking summary offers when an
 * order is below the free-delivery threshold. Pure, so it is unit-tested.
 *
 * Only popular items with a fixed price, never something already in the order: first on the
 * services the customer is already using (any service when none is chosen yet), then others. The ones that close
 * the gap come first, cheapest first; then the largest that don't. A nudge, not a push: three at most.
 */

export type UpsellPrice = { slug: string; amountMinor: number | null; unitLabel: string | null };
export type UpsellItem = { name: string; services: UpsellPrice[] };
export type UpsellLine = { item: string; service: string };
export type AddOn = { item: string; service: string; amountMinor: number };

export function suggestAddOns(lines: UpsellLine[], popular: UpsellItem[], gapMinor: number, preferred: string[] = [], limit = 3): AddOn[] {
  if (gapMinor <= 0) return [];
  const inOrder = new Set(lines.map((l) => l.item.toLowerCase()));
  const used = new Set([...lines.map((l) => l.service).filter(Boolean), ...preferred]);
  const pick = (sameServices: boolean, skip: Set<string>) => {
    const options: AddOn[] = [];
    for (const p of popular) {
      if (inOrder.has(p.name.toLowerCase()) || skip.has(p.name)) continue;
      const priced = p.services.filter((s) => s.amountMinor !== null && s.amountMinor > 0 && !s.unitLabel && (!sameServices || !used.size || used.has(s.slug)));
      // One suggestion per item: the service that best fits the gap.
      const best = [...priced].sort((a, b) => fit(a.amountMinor!, gapMinor) - fit(b.amountMinor!, gapMinor))[0];
      if (best) options.push({ item: p.name, service: best.slug, amountMinor: best.amountMinor! });
    }
    return options.sort((a, b) => fit(a.amountMinor, gapMinor) - fit(b.amountMinor, gapMinor));
  };
  // The services already in use first; other services only to fill the rest.
  const first = pick(true, new Set()).slice(0, limit);
  return [...first, ...pick(false, new Set(first.map((o) => o.item)))].slice(0, limit);
}

/** Lower is better: closing the gap with the least extra first, then the biggest step towards it. */
const fit = (amount: number, gap: number) => (amount >= gap ? amount - gap : 1_000_000 + (gap - amount));

/** 0–100, for the progress bar. */
export const progressToFree = (subtotalMinor: number, thresholdMinor: number) =>
  thresholdMinor <= 0 ? 100 : Math.max(0, Math.min(100, Math.round((subtotalMinor / thresholdMinor) * 100)));
