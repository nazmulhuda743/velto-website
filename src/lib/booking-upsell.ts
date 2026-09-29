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

/* ---------- smart upsell (phase 6): from what Velto's customers actually send ---------- */

/** Why an add-on is offered: the customer's own habit, a real "sent together" pattern, or just popular. */
export type AddOnReason = { kind: "usual" } | { kind: "pair"; with: string } | { kind: "popular" };
export type SmartAddOn = AddOn & { reason: AddOnReason };

/** Store-wide pairs (website_item_affinity) and the customer's own regular items (portal_usual_items). Booking-form slugs. */
export type UpsellHints = {
  usual: { item: string; service: string }[];
  pairs: { item: string; service: string; alsoItem: string; alsoService: string; share: number }[];
};

const key = (s: string) => s.trim().toLowerCase();

/**
 * Add-ons in order of relevance: what this customer usually sends and hasn't added yet, then what
 * customers most often send with the items already in the order, then (below the free-delivery
 * threshold only) the popular gap-closers. Only items on the price list with a fixed price for that
 * service; never something already in the order; one suggestion per item. Once delivery is free,
 * only the relevant ones and at most two; otherwise three.
 */
export function smartAddOns(lines: UpsellLine[], pool: UpsellItem[], gapMinor: number, hints: UpsellHints, preferred: string[] = []): SmartAddOn[] {
  const free = gapMinor <= 0;
  const limit = free ? 2 : 3;
  const inOrder = new Set(lines.map((l) => key(l.item)));
  const byName = new Map(pool.map((p) => [key(p.name), p]));
  const out: SmartAddOn[] = [];
  const taken = new Set<string>();
  const offer = (item: string, service: string, reason: AddOnReason) => {
    const k = key(item);
    if (out.length >= limit || inOrder.has(k) || taken.has(k)) return;
    const listed = byName.get(k);
    const price = listed?.services.find((s) => s.slug === service && s.amountMinor !== null && s.amountMinor > 0 && !s.unitLabel);
    if (!listed || !price) return;
    taken.add(k);
    out.push({ item: listed.name, service, amountMinor: price.amountMinor!, reason });
  };

  for (const u of hints.usual) offer(u.item, u.service, { kind: "usual" });
  const anchors = new Set(lines.map((l) => `${key(l.item)}|${l.service}`));
  const pairs = hints.pairs.filter((p) => anchors.has(`${key(p.item)}|${p.service}`)).sort((a, b) => b.share - a.share);
  for (const p of pairs) {
    const anchor = lines.find((l) => key(l.item) === key(p.item));
    offer(p.alsoItem, p.alsoService, { kind: "pair", with: anchor?.item ?? p.item });
  }
  if (!free && out.length < limit) {
    for (const a of suggestAddOns(lines, pool, gapMinor, preferred, limit)) offer(a.item, a.service, { kind: "popular" });
  }
  return out;
}
