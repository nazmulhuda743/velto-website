/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");
const test = require("node:test");
const { POPULAR_PRICE_ITEMS, pickPopularItems } = require("../.foundation-test-build/popular-prices.js");

const item = (name, ...amounts) => ({ name, services: amounts.map((amountMinor, i) => ({ slug: `s${i}`, amountMinor })) });

test("popular items: five or six everyday items, each named once", () => {
  assert.ok(POPULAR_PRICE_ITEMS.length >= 5 && POPULAR_PRICE_ITEMS.length <= 6);
  assert.equal(new Set(POPULAR_PRICE_ITEMS).size, POPULAR_PRICE_ITEMS.length);
});

test("popular items: keeps the chosen order, not the price list's", () => {
  const list = [item("Blazer", 25000), item("Pant", 2000), item("Shirt", 2000), item("Coat", 30000)];
  assert.deepEqual(
    pickPopularItems(list).map((i) => i.name),
    ["Shirt", "Pant", "Blazer"],
  );
});

test("popular items: an item with no real price is left out, never shown as a number", () => {
  const list = [item("Shirt", 2000), item("Pant", null, null), item("Panjabi", null, 8000)];
  assert.deepEqual(
    pickPopularItems(list).map((i) => i.name),
    ["Shirt", "Panjabi"],
  );
});

test("popular items: capped at max, and nothing when too few are left", () => {
  const list = POPULAR_PRICE_ITEMS.map((name) => item(name, 1000));
  assert.equal(pickPopularItems(list, POPULAR_PRICE_ITEMS, 4).length, 4);
  assert.deepEqual(pickPopularItems([item("Shirt", 2000)]), []);
  assert.deepEqual(pickPopularItems([]), []);
});

test("popular items: a repeated name is shown once", () => {
  assert.deepEqual(
    pickPopularItems([item("Shirt", 1), item("Pant", 1)], ["Shirt", "Shirt", "Pant"]).map((i) => i.name),
    ["Shirt", "Pant"],
  );
});
