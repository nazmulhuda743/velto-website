/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");
const test = require("node:test");

const { validateBookingSubmission, readBackBy } = require("../.foundation-test-build/integrations/ops/validation.js");
const { estimateBooking, composeBookingNotes } = require("../.foundation-test-build/booking-items.js");

const base = { name: "Customer Name", phone: "01712 345678", area: "Uttara Sector 11", address: "House 2, Road 14", preferredPickup: "Tomorrow Fri 25 Sep, Afternoon" };
const NOW = new Date("2026-09-26T04:00:00Z"); // 10:00 in Dhaka

test("estimate: priced lines add up; ৳499+ is free, below uses the admin charge", () => {
  const small = estimateBooking([{ quantity: 3, unitMinor: 8_000 }, { quantity: 1, unitMinor: null }], 6_000);
  assert.deepEqual(small, { subtotalMinor: 24_000, unpricedLines: 1, free: false, chargeMinor: 6_000, totalMinor: 30_000 });
  const free = estimateBooking([{ quantity: 2, unitMinor: 25_000 }], 6_000);
  assert.equal(free.free, true);
  assert.equal(free.chargeMinor, 0);
  assert.equal(free.totalMinor, 50_000);
  // Exactly ৳499 is free.
  assert.equal(estimateBooking([{ quantity: 1, unitMinor: 49_900 }], 6_000).free, true);
  // Charge not set by the admin: unknown, not added.
  const unknown = estimateBooking([{ quantity: 1, unitMinor: 10_000 }], null);
  assert.equal(unknown.chargeMinor, null);
  assert.equal(unknown.totalMinor, 10_000);
});

test("notes keep the old format and add services, estimate and the wanted-back date in order", () => {
  const items = [{ item: "Shirt", service: "wash-and-iron", quantity: 3 }];
  assert.equal(composeBookingNotes(items, "Call first"), "Items: 3 × Shirt – Wash & Iron. Note: Call first");
  assert.equal(
    composeBookingNotes(items, "Call first", { estimate: "৳240 for 3 items; pickup & delivery ৳60", backBy: "Thu 1 Oct" }),
    "Items: 3 × Shirt – Wash & Iron. Website estimate: ৳240 for 3 items; pickup & delivery ৳60. Wanted back by: Thu 1 Oct. Note: Call first",
  );
  assert.equal(composeBookingNotes([], undefined, { services: ["dry-cleaning", "ironing"] }), "Services: Dry Cleaning, Ironing.");
  assert.equal(composeBookingNotes([], "Gate 12"), "Gate 12");
});

test("chosen services: one becomes the Ops service, several go in the notes", () => {
  const one = validateBookingSubmission({ ...base, services: ["dry-cleaning"] }, { now: NOW });
  assert.equal(one.ok, true);
  assert.equal(one.value.service, "dry-cleaning");
  assert.equal(one.value.notes, undefined);
  const two = validateBookingSubmission({ ...base, services: ["wash-and-iron", "dry-cleaning"], notes: "Gate 12" }, { now: NOW });
  assert.equal(two.value.service, undefined);
  assert.equal(two.value.notes, "Services: Wash & Iron, Dry Cleaning. Note: Gate 12");
  // With item lines, the items say it all.
  const withItems = validateBookingSubmission(
    { ...base, services: ["wash-and-iron", "dry-cleaning"], items: [{ item: "Shirt", service: "wash-and-iron", quantity: 2 }] },
    { now: NOW },
  );
  assert.equal(withItems.value.notes, "Items: 2 × Shirt – Wash & Iron.");
  assert.equal(withItems.value.service, "wash-and-iron");
  for (const services of [["curtain-cleaning"], ["express"], "dry-cleaning", ["ironing", "ironing", "ironing", "ironing"]]) {
    const bad = validateBookingSubmission({ ...base, services }, { now: NOW });
    assert.equal(bad.ok, false, JSON.stringify(services));
    assert.ok(bad.issues.some((i) => i.field === "services"));
  }
});

test("wanted-back date: a real date from today (Dhaka) to 180 days, worded for staff", () => {
  assert.equal(readBackBy("2026-10-01", NOW), "Thu 1 Oct");
  assert.equal(readBackBy("2026-09-26", NOW), "Sat 26 Sep");
  assert.equal(readBackBy(undefined, NOW), undefined);
  assert.equal(readBackBy("", NOW), undefined);
  for (const bad of ["2026-09-25", "2027-04-01", "2026-02-30", "01-10-2026", "tomorrow", 20261001]) {
    assert.equal(readBackBy(bad, NOW), null, String(bad));
  }
  const result = validateBookingSubmission(
    { ...base, items: [{ item: "Shirt", service: "ironing", quantity: 1 }], deliveryBy: "2026-10-01" },
    { now: NOW, estimate: "৳20 for 1 item; pickup & delivery charge to confirm" },
  );
  assert.equal(
    result.value.notes,
    "Items: 1 × Shirt – Ironing. Website estimate: ৳20 for 1 item; pickup & delivery charge to confirm. Wanted back by: Thu 1 Oct.",
  );
  const bad = validateBookingSubmission({ ...base, deliveryBy: "2026-09-01" }, { now: NOW });
  assert.equal(bad.ok, false);
  assert.ok(bad.issues.some((i) => i.field === "deliveryBy"));
});

test("a full notes field drops the estimate instead of rejecting the booking", () => {
  const items = Array.from({ length: 10 }, (_, i) => ({ item: `Item ${i}`.padEnd(40, "x"), service: "ironing", quantity: 99 }));
  const note = "n".repeat(1000 - composeBookingNotes(items, "").length - 10);
  const result = validateBookingSubmission({ ...base, items, notes: note }, { now: NOW, estimate: "৳99,000 for 990 items; pickup & delivery free" });
  assert.equal(result.ok, true);
  assert.ok(!result.value.notes.includes("Website estimate"));
  assert.ok(result.value.notes.length <= 1000);
});

test("pickup day and time are required", () => {
  const { preferredPickup, ...noPickup } = base;
  assert.ok(preferredPickup);
  const missing = validateBookingSubmission(noPickup, { now: NOW });
  assert.equal(missing.ok, false);
  assert.deepEqual(missing.issues, [{ field: "preferredPickup", code: "required" }]);
  const ok = validateBookingSubmission(base, { now: NOW });
  assert.equal(ok.value.preferredPickup, "Tomorrow Fri 25 Sep, Afternoon");
});

test("photo ids become links in the notes; anything else is rejected", () => {
  const ids = ["0123456789abcdef0123456789abcdef", "fedcba9876543210fedcba9876543210"];
  const result = validateBookingSubmission({ ...base, photos: ids, notes: "Stain on the collar" }, { now: NOW, siteUrl: "https://www.velto.com.bd/" });
  assert.equal(result.ok, true);
  assert.equal(
    result.value.notes,
    `Photos: https://www.velto.com.bd/go/photo/${ids[0]} https://www.velto.com.bd/go/photo/${ids[1]} Note: Stain on the collar`,
  );
  for (const photos of [["../etc/passwd"], ["ABCDEF0123456789ABCDEF0123456789"], "x", [ids[0], ids[1], ids[0].replace("0", "1"), ids[1].replace("f", "e")]]) {
    const bad = validateBookingSubmission({ ...base, photos }, { now: NOW });
    assert.equal(bad.ok, false, JSON.stringify(photos));
    assert.deepEqual(bad.issues, [{ field: "photos", code: "invalid" }]);
  }
});

test("/book service panels: each service's items, all in one price lookup", () => {
  const { BOOKING_ITEMS_BY_SERVICE, bookingCatalogueNames, ITEM_SERVICES } = require("../.foundation-test-build/booking-items.js");
  assert.deepEqual(Object.keys(BOOKING_ITEMS_BY_SERVICE).sort(), Object.keys(ITEM_SERVICES).sort());
  for (const names of Object.values(BOOKING_ITEMS_BY_SERVICE)) assert.ok(names.length >= 2 && new Set(names).size === names.length);
  // One price lookup takes at most 40 names.
  assert.ok(bookingCatalogueNames().length <= 40, `${bookingCatalogueNames().length} names`);
});

test("/book prices: garment services read their own column; household shows a 'from' price", () => {
  const { itemPrice, fromPrice, offeredFor } = require("../.foundation-test-build/booking-items.js");
  const row = (slug, amountMinor, unitLabel = null) => ({ slug, amountMinor, unitLabel });
  const shirt = { name: "Shirt", services: [row("wash-and-iron", 4000), row("ironing", 1500)] };
  const blanket = { name: "Blanket (Small)", services: [row("dry-cleaning", 30000), row("wash-and-iron", 25000)] };
  const curtain = { name: "Curtain Normal (per sqft)", services: [row("dry-cleaning", 1200, "per sqft"), row("ironing", 500, "per sqft"), row("wash-and-iron", 1000, "per sqft")] };
  assert.deepEqual(itemPrice(shirt, "ironing"), { amountMinor: 1500, unitLabel: null, exact: true });
  assert.equal(itemPrice(shirt, "dry-cleaning"), null);
  assert.equal(offeredFor(shirt, "dry-cleaning"), false);
  assert.equal(offeredFor(blanket, "blanket-comforter-cleaning"), true);
  assert.deepEqual(itemPrice(blanket, "blanket-comforter-cleaning"), { amountMinor: 25000, unitLabel: null, exact: false });
  // Curtain cleaning shows a cleaning rate, never the ironing-only one.
  assert.deepEqual(itemPrice(curtain, "curtain-cleaning"), { amountMinor: 1000, unitLabel: "per sqft", exact: false });
  assert.deepEqual(fromPrice("ironing", [shirt, blanket]), { amountMinor: 1500, unitLabel: null });
  assert.deepEqual(fromPrice("curtain-cleaning", [curtain]), { amountMinor: 1000, unitLabel: "per sqft" });
  assert.equal(fromPrice("dry-cleaning", [shirt]), null);
  assert.equal(fromPrice("ironing", []), null);
});
