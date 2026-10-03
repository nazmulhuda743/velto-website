/* eslint-disable @typescript-eslint/no-require-imports */
const test = require("node:test");
const assert = require("node:assert/strict");
const { ACCOUNT_OFFER, accountOfferFor, accountOfferNote, accountSavingMinor } = require("../.foundation-test-build/account-offer.js");

test("account offer: 10% off the first three website bookings of ৳499+", () => {
  assert.deepEqual({ ...ACCOUNT_OFFER }, { percent: 10, minimumTaka: 499, bookings: 3 });
  assert.deepEqual(accountOfferFor(0), { booking: 1, total: 3, percent: 10, minimumTaka: 499 });
  assert.equal(accountOfferFor(2).booking, 3);
  assert.equal(accountOfferFor(3), null, "the three are used up");
  assert.equal(accountOfferFor(7), null);
  assert.equal(accountOfferFor(null), null, "unknown count: no discount");
  assert.equal(accountOfferFor(undefined), null);
  assert.equal(accountOfferFor(-1), null);
});

test("the Ops note names the booking number", () => {
  assert.equal(accountOfferNote(accountOfferFor(1)), "Account booking 2 of 3: 10% off if the order is ৳499 or more");
});

test("the saving shown on the estimate", () => {
  const offer = accountOfferFor(0);
  assert.equal(accountSavingMinor(0, offer), 0);
  assert.equal(accountSavingMinor(49800, offer), 0, "under the minimum");
  assert.equal(accountSavingMinor(49900, offer), 4990);
  assert.equal(accountSavingMinor(123450, offer), 12345);
  assert.equal(accountSavingMinor(100000, null), 0);
});
