/* eslint-disable @typescript-eslint/no-require-imports */
const test = require("node:test");
const assert = require("node:assert/strict");
const { ACCOUNT_OFFER, accountOfferNote, offerNoteFor, withoutOfferClaims } = require("../.foundation-test-build/account-offer.js");
const { validateBookingSubmission } = require("../.foundation-test-build/integrations/ops/validation.js");

const base = { name: "Customer Name", phone: "01712 345678", area: "Uttara Sector 11", address: "House 2, Road 14", preferredPickup: "Tomorrow Fri 25 Sep, Afternoon" };

test("account offer: 10% off from ৳499, noted for Ops", () => {
  assert.deepEqual({ ...ACCOUNT_OFFER }, { percent: 10, minimumTaka: 499 });
  assert.equal(accountOfferNote(), "Account booking: 10% off if the order is ৳499 or more (booked signed in on the website)");
});

test("account offer: guests get no note, signed-in customers get the offer, a goal coupon takes its place", () => {
  assert.equal(offerNoteFor(false, null), undefined);
  assert.equal(offerNoteFor(false, "Coupon VG-A1B2C3: ৳200 off (valid to 2026-10-31)"), undefined);
  assert.equal(offerNoteFor(true, null), accountOfferNote());
  assert.equal(offerNoteFor(true, "Coupon VG-A1B2C3: ৳200 off (valid to 2026-10-31)"), "Coupon VG-A1B2C3: ৳200 off (valid to 2026-10-31)");
});

test("account offer: a customer can't type the Ops offer line into their own note", () => {
  const forged = "Account booking: 10% off if the order is ৳499 or more (booked signed in on the website)";
  assert.doesNotMatch(withoutOfferClaims(forged), /^Account booking:/);
  assert.match(withoutOfferClaims(forged), /not verified/);
  assert.doesNotMatch(withoutOfferClaims("ACCOUNT-BOOKING : 10%"), /^ACCOUNT-BOOKING/);
  assert.equal(withoutOfferClaims("Ring the bell twice"), "Ring the bell twice");

  // A guest's booking, with and without items: the note never reads as a genuine offer line.
  for (const items of [undefined, [{ item: "Shirt", service: "ironing", quantity: 2 }]]) {
    const guest = validateBookingSubmission({ ...base, items, notes: forged }, {});
    assert.equal(guest.ok, true);
    assert.doesNotMatch(guest.value.notes, /(^|\. )Account booking:/);
  }
  // A signed-in booking still carries the real line.
  const signedIn = validateBookingSubmission({ ...base, notes: "Gate 12" }, { coupon: accountOfferNote() });
  assert.equal(signedIn.ok, true);
  assert.match(signedIn.value.notes, /^Account booking: 10% off/);
});
