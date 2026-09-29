/* eslint-disable @typescript-eslint/no-require-imports */
const test = require("node:test");
const assert = require("node:assert/strict");
const { FIRST_ORDER_OFFER, phoneKey, isFirstOrder, firstOrderNote } = require("../.foundation-test-build/first-order-offer.js");

test("first-order offer: 10% off from ৳499", () => {
  assert.deepEqual({ ...FIRST_ORDER_OFFER }, { percent: 10, minimumTaka: 499 });
  assert.match(firstOrderNote(), /^First order: 10% off if the order is ৳499 or more/);
});

test("phone key: the common ways a Bangladeshi mobile is written", () => {
  assert.equal(phoneKey("01712345678"), "01712345678");
  assert.equal(phoneKey("+880 1712-345678"), "01712345678");
  assert.equal(phoneKey("8801712345678"), "01712345678");
  assert.equal(phoneKey("017 1234 5678"), "01712345678");
  assert.equal(phoneKey("12345"), null);
  assert.equal(phoneKey(null), null);
});

test("first order only when the lookup worked and found no orders", () => {
  assert.equal(isFirstOrder({}, "01712345678"), true);
  assert.equal(isFirstOrder({ "01712345678": { total: 0 } }, "01712345678"), true);
  assert.equal(isFirstOrder({ "01712345678": { total: 3 } }, "01712345678"), false);
  assert.equal(isFirstOrder(null, "01712345678"), null, "lookup failed: no offer");
  assert.equal(isFirstOrder({}, null), null, "no usable phone: no offer");
});
