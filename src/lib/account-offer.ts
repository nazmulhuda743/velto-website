/**
 * Account offer (owner-set, 2026-10-03): 10% off a customer's first three website bookings of
 * ৳499 or more, made from their Velto account (every website booking is: the form verifies the
 * mobile). After the third, the monthly-goal ladder and loyalty tiers take over. There is no
 * code to type; the booking reaches Ops with a note and the team applies it when they confirm,
 * as with the monthly-goal coupon (which takes its place when the customer holds one).
 * Pure: no server imports (tested in tests/account-offer.test.cjs).
 */

export const ACCOUNT_OFFER = { percent: 10, minimumTaka: 499, bookings: 3 } as const;

export type AccountOffer = {
  /** 1-based: the booking being made now ("Account booking 2 of 3"). */
  booking: number;
  total: number;
  percent: number;
  minimumTaka: number;
};

/**
 * The offer for the next booking, given how many website bookings this phone already has.
 * null when the three are used up, or when the count is unknown (a failed lookup gives no discount).
 */
export function accountOfferFor(bookingsSoFar: number | null | undefined): AccountOffer | null {
  if (typeof bookingsSoFar !== "number" || !Number.isFinite(bookingsSoFar) || bookingsSoFar < 0) return null;
  if (bookingsSoFar >= ACCOUNT_OFFER.bookings) return null;
  return { booking: Math.floor(bookingsSoFar) + 1, total: ACCOUNT_OFFER.bookings, percent: ACCOUNT_OFFER.percent, minimumTaka: ACCOUNT_OFFER.minimumTaka };
}

/** The line Velto Ops reads in the booking notes (English, like every Ops field). */
export function accountOfferNote(offer: AccountOffer): string {
  return `Account booking ${offer.booking} of ${offer.total}: ${offer.percent}% off if the order is ৳${offer.minimumTaka} or more`;
}

/** What the customer saves on the estimate, in minor units; 0 under the minimum or with nothing priced. */
export function accountSavingMinor(subtotalMinor: number, offer: AccountOffer | null): number {
  if (!offer || subtotalMinor < offer.minimumTaka * 100) return 0;
  return Math.round((subtotalMinor * offer.percent) / 100);
}
