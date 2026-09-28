/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");
const test = require("node:test");
const { suggestAddOns, progressToFree } = require("../.foundation-test-build/booking-upsell.js");

const tk = (n) => n * 100;
const popular = [
  { name: "Shirt", services: [{ slug: "ironing", amountMinor: tk(20), unitLabel: null }, { slug: "wash-and-iron", amountMinor: tk(45), unitLabel: null }, { slug: "dry-cleaning", amountMinor: tk(120), unitLabel: null }] },
  { name: "Pant", services: [{ slug: "ironing", amountMinor: tk(20), unitLabel: null }, { slug: "wash-and-iron", amountMinor: tk(50), unitLabel: null }] },
  { name: "Blazer", services: [{ slug: "dry-cleaning", amountMinor: tk(250), unitLabel: null }] },
  { name: "Bed Sheet (Medium)", services: [{ slug: "wash-and-iron", amountMinor: tk(120), unitLabel: null }] },
  { name: "Carpet", services: [{ slug: "carpet-cleaning", amountMinor: tk(40), unitLabel: "per sq ft" }] },
  { name: "Sari (Cotton)", services: [{ slug: "dry-cleaning", amountMinor: null, unitLabel: null }] },
];

test("add-ons close the gap on the services already in the order, cheapest that closes it first", () => {
  const lines = [{ item: "Shirt", service: "wash-and-iron" }];
  const got = suggestAddOns(lines, popular, tk(100));
  assert.deepEqual(got.map((a) => `${a.item}:${a.service}`), ["Bed Sheet (Medium):wash-and-iron", "Pant:wash-and-iron", "Blazer:dry-cleaning"], "another service only fills the rest");
});

test("nothing already in the order, nothing per-unit or unpriced, three at most", () => {
  const got = suggestAddOns([], popular, tk(179));
  assert.ok(got.length <= 3);
  assert.ok(!got.some((a) => a.item === "Carpet" || a.item === "Sari (Cotton)"));
  assert.equal(got[0].item, "Blazer", "the smallest that closes ৳179 is the ৳250 blazer");
  const dc = suggestAddOns([{ item: "Blazer", service: "dry-cleaning" }], popular, tk(50));
  assert.deepEqual(dc[0], { item: "Shirt", service: "dry-cleaning", amountMinor: tk(120) }, "the service in use comes first");
  assert.ok(!dc.some((a) => a.item === "Blazer"));
});

test("no gap, no nudge; the bar never passes 100", () => {
  assert.deepEqual(suggestAddOns([], popular, 0), []);
  assert.equal(progressToFree(tk(320), tk(499)), 64);
  assert.equal(progressToFree(tk(600), tk(499)), 100);
});
