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

test("condition: marks are bounded, cleaned, and only stain photo paths survive", () => {
  const marks = inv.conditionMarks([
    { item: " White shirt ", type: "Oil", photos: ["stains/ab/1.jpg", "../x.jpg", "stains/ab/2.jpg", "stains/ab/3.jpg"], more: 2 },
    { item: "Blazer", type: "", photos: ["receipts/r.jpg", "https://evil.example/x.jpg", "stains/../../secret"], more: 0 },
    { item: "", type: "", photos: [], more: 0 },
    null,
    "nope",
    { item: "Sari", type: "Ink", photos: "stains/a.jpg", more: -4 },
  ]);
  assert.deepEqual(marks, [
    { item: "White shirt", type: "Oil", photos: ["stains/ab/1.jpg", "stains/ab/2.jpg"], more: 2 },
    { item: "Blazer", type: "", photos: [], more: 0 },
    { item: "Sari", type: "Ink", photos: [], more: 0 },
  ]);
  assert.deepEqual(inv.conditionMarks(undefined), []);
  assert.deepEqual(inv.conditionMarks({}), []);
  assert.equal(inv.conditionMarks(Array.from({ length: 40 }, () => ({ item: "Shirt", type: "Oil", photos: [], more: 0 }))).length, 30);
});

test("condition: each photo is signed once, and only order-photos stain links become URLs", () => {
  const marks = [
    { item: "A", type: "Oil", photos: ["stains/a.jpg", "stains/b.jpg"], more: 0 },
    { item: "B", type: "Ink", photos: ["stains/a.jpg"], more: 0 },
  ];
  assert.deepEqual(inv.conditionPhotoPaths(marks), ["stains/a.jpg", "stains/b.jpg"]);
  const origin = "https://abc.supabase.co";
  assert.equal(
    inv.signedPhotoUrl(origin + "/", "/object/sign/order-photos/stains/a.jpg?token=t"),
    "https://abc.supabase.co/storage/v1/object/sign/order-photos/stains/a.jpg?token=t",
  );
  assert.equal(inv.signedPhotoUrl(origin, "/object/sign/website-media/a.jpg?token=t"), null);
  assert.equal(inv.signedPhotoUrl(origin, "https://evil.example/object/sign/order-photos/stains/a.jpg"), null);
  assert.equal(inv.signedPhotoUrl(origin, "/object/sign/order-photos/stains/../x?token=t"), null);
  assert.equal(inv.signedPhotoUrl(origin, null), null);
});
