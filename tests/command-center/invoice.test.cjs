/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");
const test = require("node:test");

const inv = require("../../.command-center-test-build/lib/invoice.js");

test("sums: lines, express and the difference Ops charged", () => {
  const exact = inv.invoiceSums([{ item: "Shirt", service: "Ironing", quantity: 8, price: 15 }, { item: "Blazer", service: "Dry Cleaning", quantity: 1, price: 250 }], 420, 50);
  assert.deepEqual(exact.lines.map((l) => l.amount), [120, 250]);
  assert.equal(exact.subtotal, 370);
  assert.equal(exact.express, 50);
  assert.equal(exact.adjustment, 0);
  const discount = inv.invoiceSums([{ item: "Shirt", service: "Ironing", quantity: 10, price: 15 }], 140, 0);
  assert.equal(discount.adjustment, -10);
  const extra = inv.invoiceSums([{ item: "Shirt", service: "Ironing", quantity: 10, price: 15 }], 180, 0);
  assert.equal(extra.adjustment, 30);
});

test("sums: an unpriced line shows only the total", () => {
  const s = inv.invoiceSums([{ item: "Shirt", service: "Ironing", quantity: 2, price: 15 }, { item: "Carpet", service: "Dry Cleaning", quantity: 1, price: null }], 500, 0);
  assert.equal(s.lines[1].amount, null);
  assert.equal(s.subtotal, null);
  assert.equal(s.adjustment, null);
  assert.equal(inv.invoiceSums([], 200, 0).subtotal, null);
});

test("link: https, the page language, the code", () => {
  assert.equal(inv.invoiceLink("https://www.velto.com.bd/", "Ab3xK9pQ", "bn"), "https://www.velto.com.bd/bn/i/Ab3xK9pQ");
  assert.equal(inv.invoiceLink("www.velto.com.bd", "Ab3xK9pQ", "en"), "https://www.velto.com.bd/i/Ab3xK9pQ");
  assert.ok(inv.INVOICE_CODE.test("Ab3x-9_Q"));
  assert.ok(!inv.INVOICE_CODE.test("Ab3xK9p"));
});

test("message: one link only, the total and what's due, in both languages", () => {
  const link = "https://www.velto.com.bd/bn/i/Ab3xK9pQ";
  const bn = inv.invoiceMessage({ name: "Md. Nazmul Hasan", orderNumber: "VEL-01234", status: "Ready", total: 1250, due: 220, link }, "bn");
  assert.equal(inv.linkCount(bn), 1);
  assert.ok(bn.includes("Nazmul") && bn.includes("VEL-01234") && bn.includes("৳১,২৫০") && bn.includes("বাকি ৳২২০"));
  const en = inv.invoiceMessage({ name: null, orderNumber: "VEL-01234", status: "Delivered", total: 300, due: 0, link }, "en");
  assert.equal(inv.linkCount(en), 1);
  assert.ok(en.startsWith("Hi, this is Velto.") && en.includes("paid in full"));
  const cancelled = inv.invoiceMessage({ name: "Rina", orderNumber: "VEL-01235", status: "Cancelled", total: 300, due: 300, link }, "en");
  assert.ok(!cancelled.includes("due"));
});
