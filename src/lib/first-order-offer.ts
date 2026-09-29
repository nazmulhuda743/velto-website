/**
 * First-order offer (owner-set, 2026-09-29): 10% off a customer's first Velto order of ৳499 or
 * more. "First" is decided by phone number: no orders in Velto Ops for that number yet. There is
 * no code to type or share; the booking reaches Ops with a note and the team applies it when they
 * confirm the order, as with the monthly-goal coupon. Pure: no server imports (tested in
 * tests/first-order.test.cjs).
 */

export const FIRST_ORDER_OFFER = { percent: 10, minimumTaka: 499 } as const;

/** "01712345678" for a Bangladeshi mobile in any common form (+880, 880, spaces, dashes); null otherwise. */
export function phoneKey(phone: string | null | undefined): string | null {
  const d = String(phone ?? "").replace(/\D/g, "");
  const local = d.startsWith("880") ? `0${d.slice(3)}` : d;
  return /^01\d{9}$/.test(local) ? local : null;
}

/**
 * Orders-per-phone (website_customer_order_counts) → is this the number's first order?
 * true: no orders for it; false: it has orders; null: unknown (lookup failed), so no offer.
 */
export function isFirstOrder(counts: Record<string, { total: number }> | null, key: string | null): boolean | null {
  if (!key || !counts) return null;
  return !((counts[key]?.total ?? 0) > 0);
}

/** The line Velto Ops reads in the booking notes (English, like every Ops field). */
export function firstOrderNote(): string {
  return `First order: ${FIRST_ORDER_OFFER.percent}% off if the order is ৳${FIRST_ORDER_OFFER.minimumTaka} or more (no Velto orders on this phone yet)`;
}
