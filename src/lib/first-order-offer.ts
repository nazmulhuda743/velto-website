/**
 * First-order offer (owner-set, 2026-09-30): 10% off a phone number's first booking on the
 * website, whatever the amount, signed in or not (sign-in is encouraged, never required). "First"
 * means the number has no earlier website booking in Ops. There is no code: the booking reaches
 * Ops with a line in its notes, the admin board shows a badge, and staff apply the 10% when they
 * create the order in the Ops app. With a monthly-goal coupon, staff apply whichever saves more.
 * Pure: no server imports (tested in tests/first-order-offer.test.cjs).
 */

export const FIRST_ORDER_OFFER = { percent: 10 } as const;

/** Whether this booking is the number's first on the website; "unknown" when the lookup failed. */
export type FirstOrder = "first" | "repeat" | "unknown";

/** The line Velto Ops reads in the booking notes (English, like every Ops field). */
export function firstOrderNote(status: "first" | "unknown"): string {
  return status === "first"
    ? `First website order: apply ${FIRST_ORDER_OFFER.percent}% off (any amount)`
    : `Website order: couldn't check if this is the number's first; if it is, apply ${FIRST_ORDER_OFFER.percent}% off (any amount)`;
}

/**
 * The offer line for the Ops notes: the first-order 10% (with a goal coupon, staff apply whichever
 * saves more), else the coupon alone, else nothing.
 */
export function offerNoteFor(status: FirstOrder, couponNote: string | null | undefined): string | undefined {
  if (status === "repeat") return couponNote || undefined;
  const offer = firstOrderNote(status);
  return couponNote ? `${offer}, OR ${couponNote}: apply whichever saves the customer more, not both (an unused coupon stays open)` : offer;
}

/**
 * The offer reaches Ops only as a line in the notes, so a customer's own note must not pass for it
 * ("First website order: apply 10%…" typed by a guest). The phrase is kept, marked as theirs.
 */
export function withoutOfferClaims(note: string): string {
  return note
    .replace(/first[\s._-]*website[\s._-]*order/gi, "(typed by customer, not verified) first web order")
    .replace(/account[\s._-]*booking/gi, "(typed by customer, not verified) account order");
}

/** The admin board's badge: the server's first-order line is in these notes (a customer's can't be). */
export function hasFirstOrderMark(notes: string | null | undefined): boolean {
  return Boolean(notes && /(?:^|\. )First website order: apply \d+% off/.test(notes));
}
