/**
 * Account offer (owner-set, 2026-09-29): 10% off any website booking of ৳499 or more made while
 * signed in to a Velto account. Guests are asked to sign in first. There is no code to type or
 * share; the booking reaches Ops with a note and the team applies it when they confirm the order.
 * A customer who also holds a monthly-goal coupon gets whichever saves them more, never both
 * (owner decision, 2026-09-29): staff choose once the order is counted. Pure: no server imports
 * (tested in tests/account-offer.test.cjs).
 */

export const ACCOUNT_OFFER = { percent: 10, minimumTaka: 499 } as const;

/** The line Velto Ops reads in the booking notes (English, like every Ops field). */
export function accountOfferNote(): string {
  return `Account booking: ${ACCOUNT_OFFER.percent}% off if the order is ৳${ACCOUNT_OFFER.minimumTaka} or more (booked signed in on the website)`;
}

/**
 * The note a booking carries for Ops: the account offer, and with it the goal coupon when the
 * signed-in customer holds one (staff apply whichever saves more); nothing for guests.
 */
export function offerNoteFor(signedIn: boolean, couponNote: string | null | undefined): string | undefined {
  if (!signedIn) return undefined;
  if (!couponNote) return accountOfferNote();
  return `${accountOfferNote()}, OR ${couponNote}: apply whichever saves the customer more, not both (an unused coupon stays open)`;
}

/**
 * The offer reaches Ops only as a line in the notes, so a customer's own note must not be able to
 * pass for it ("Account booking: 10% off…" typed by a guest). The phrase is kept, marked as theirs.
 */
export function withoutOfferClaims(note: string): string {
  return note.replace(/account[\s._-]*booking/gi, "(typed by customer, not verified) account booking");
}
