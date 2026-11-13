/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");
const test = require("node:test");

const b = require("../../.command-center-test-build/lib/campaigns/b999.js");
const copy = require("../../.command-center-test-build/content/i18n/b999.js");

test("locked package prices", () => {
  assert.equal(b.b999Total({ regular: 3, heavy: 0 }).total, 999);
  assert.equal(b.b999Total({ regular: 2, heavy: 1 }).total, 1049);
  assert.equal(b.b999Total({ regular: 1, heavy: 2 }).total, 1099);
  assert.equal(b.b999Total({ regular: 0, heavy: 3 }).total, 1149);
});

test("extras are list price, never a second package", () => {
  assert.equal(b.b999Total({ regular: 3, heavy: 0, extraRegular: 3 }).total, 999 + 1200);
  assert.equal(b.b999Total({ regular: 3, heavy: 0, extraRegular: 1, extraHeavy: 1 }).total, 999 + 400 + 450);
  assert.equal(b.b999Total({ regular: 6, heavy: 0 }).total, 999 + 1200);
});

test("fewer than 3 eligible: list price, no package", () => {
  assert.deepEqual(b.b999Total({ regular: 2, heavy: 0 }), { total: 800, packageApplies: false });
  assert.deepEqual(b.b999Total({ regular: 1, heavy: 1 }), { total: 850, packageApplies: false });
});

test("a declined heavy blanket is returned and the rest recalculated", () => {
  assert.deepEqual(b.b999AfterDecline({ regular: 2, heavy: 1 }, 1), { total: 800, packageApplies: false });
  assert.deepEqual(b.b999AfterDecline({ regular: 3, heavy: 1 }, 1), { total: 999, packageApplies: true });
  assert.equal(b.b999AfterDecline({ regular: 2, heavy: 1 }, 0).total, 1049);
});

test("price list must say 400 / 450", () => {
  assert.ok(b.listPricesMatch(400, 450));
  assert.ok(!b.listPricesMatch(450, 500));
  assert.ok(!b.listPricesMatch(null, 450));
});

test("pickup days: 7 from tomorrow, a full day drops out", () => {
  const days = b.offeredDays("2026-10-08");
  assert.equal(days.length, 7);
  assert.equal(days[0], "2026-10-09");
  assert.equal(days[6], "2026-10-15");
  const open = b.openDays("2026-10-08", { "2026-10-09": 4, "2026-10-10": 3 });
  assert.ok(!open.includes("2026-10-09"));
  assert.ok(open.includes("2026-10-10"));
  assert.equal(b.dhakaToday(new Date("2026-10-08T19:00:00Z")), "2026-10-09");
});

test("sectors 1 to 18 only", () => {
  assert.ok(b.isSector(1) && b.isSector("18"));
  assert.ok(!b.isSector(0) && !b.isSector(19) && !b.isSector("outside"));
});

test("campaign copy: no em dash, no discount wording, never Wash + Iron (English and Bangla)", () => {
  for (const locale of ["en", "bn"]) {
    const strings = JSON.stringify(copy.b999Text(locale));
    for (const re of b.B999_BANNED) assert.doesNotMatch(strings, re, `${locale}: ${re}`);
  }
  for (const msg of [b.b999WhatsApp.check, b.b999WhatsApp.booked("WEB-ABCD1234"), b.b999WhatsApp.outside]) assert.doesNotMatch(msg, /—/);
  assert.match(b.b999WhatsApp.check, /Reference: B999-WEB$/);
  assert.equal(b.b999WhatsApp.booked("WEB-ABCD1234"), "Hi Velto, I booked the 3 Blanket ৳999 package.\nBooking: WEB-ABCD1234");
});

const promo = require("../../.command-center-test-build/lib/promo.js");
const intel = require("../../.command-center-test-build/lib/admin/request-intel.js");

test("the page hides the site-wide offer bar and the popup (and only this page)", () => {
  for (const p of ["/blanket-cleaning-uttara", "/bn/blanket-cleaning-uttara", "/blanket-cleaning-uttara?utm_source=fb"]) {
    assert.ok(promo.promoBarHidden(p), p);
  }
  assert.ok(promo.popupExcluded("/blanket-cleaning-uttara") && promo.popupExcluded("/bn/blanket-cleaning-uttara"));
  assert.ok(!promo.promoBarHidden("/") && !promo.promoBarHidden("/book") && !promo.promoBarHidden("/services/blanket-comforter-cleaning"));
});

test("staff see B999 on the task, and never the 10% badge", () => {
  const description = [
    "Pickup request from Velto website. Call or WhatsApp to confirm the time.",
    "Name: Rina",
    "Phone: 01712345678",
    "Area: Uttara Sector 7",
    "Service: Blanket & Comforter Cleaning",
    "Notes: Offer: B999-WEB · 3 Regular/Medium blankets · ৳999 fixed · Pay at delivery (cash or bKash). Do NOT apply the first-order 10% or any coupon.",
  ].join("\n");
  const i = intel.analyseRequest({ id: "1", title: "t", type: "pickup", status: "open", source: "website_booking", outlet_code: "S11", description, created_at: "2026-10-08T10:00:00Z", done_at: null, done_by_name: null }, Date.parse("2026-10-08T11:00:00Z"));
  assert.equal(i.b999, true);
  assert.equal(i.firstOrder, false);
  const normal = intel.analyseRequest({ id: "2", title: "t", type: "pickup", status: "open", source: "website_booking", outlet_code: "S11", description: "Name: A\nNotes: First website order: apply 10% off (any amount)", created_at: "2026-10-08T10:00:00Z", done_at: null, done_by_name: null }, Date.parse("2026-10-08T11:00:00Z"));
  assert.equal(normal.b999, false);
  assert.equal(normal.firstOrder, true);
});
