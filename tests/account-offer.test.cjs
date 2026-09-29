/* eslint-disable @typescript-eslint/no-require-imports */
const test = require("node:test");
const assert = require("node:assert/strict");
const { ACCOUNT_OFFER, accountOfferNote } = require("../.foundation-test-build/account-offer.js");

test("account offer: 10% off from ৳499, noted for Ops", () => {
  assert.deepEqual({ ...ACCOUNT_OFFER }, { percent: 10, minimumTaka: 499 });
  assert.equal(accountOfferNote(), "Account booking: 10% off if the order is ৳499 or more (booked signed in on the website)");
});
