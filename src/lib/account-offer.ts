/**
 * Account offer (owner-set, 2026-09-29): 10% off any website booking of ৳499 or more made while
 * signed in to a Velto account. Guests are asked to sign in first. There is no code to type or
 * share; the booking reaches Ops with a note and the team applies it when they confirm the order,
 * as with the monthly-goal coupon (which takes its place when the customer holds one). Pure: no
 * server imports (tested in tests/account-offer.test.cjs).
 */

export const ACCOUNT_OFFER = { percent: 10, minimumTaka: 499 } as const;

/** The line Velto Ops reads in the booking notes (English, like every Ops field). */
export function accountOfferNote(): string {
  return `Account booking: ${ACCOUNT_OFFER.percent}% off if the order is ৳${ACCOUNT_OFFER.minimumTaka} or more (booked signed in on the website)`;
}
