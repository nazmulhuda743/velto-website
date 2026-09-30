/* eslint-disable @typescript-eslint/no-require-imports */
const test = require("node:test");
const assert = require("node:assert/strict");
const { FIRST_ORDER_OFFER, firstOrderNote, offerNoteFor, withoutOfferClaims, hasFirstOrderMark } = require("../.foundation-test-build/first-order-offer.js");
const { validateBookingSubmission } = require("../.foundation-test-build/integrations/ops/validation.js");
const { composeBookingNotes, NOTE_EXTRAS_RESERVE } = require("../.foundation-test-build/booking-items.js");

const base = { name: "Customer Name", phone: "01712 345678", area: "Uttara Sector 11", address: "House 2, Road 14", preferredPickup: "Tomorrow Fri 25 Sep, Afternoon" };
const coupon = "Coupon VG-A1B2C3: ৳200 off (valid to 2026-10-31)";

test("first-order offer: 10% off a phone number's first website booking, any amount, noted for Ops", () => {
  assert.deepEqual({ ...FIRST_ORDER_OFFER }, { percent: 10 });
  assert.equal(firstOrderNote("first"), "First website order: apply 10% off (any amount)");
  assert.match(firstOrderNote("unknown"), /^Website order: couldn't check if this is the number's first/);
});

test("first-order offer: the note Ops gets for each case; a goal coupon rides along and staff apply whichever saves more", () => {
  assert.equal(offerNoteFor("repeat", null), undefined);
  assert.equal(offerNoteFor("repeat", coupon), coupon);
  assert.equal(offerNoteFor("first", null), firstOrderNote("first"));
  assert.equal(
    offerNoteFor("first", coupon),
    "First website order: apply 10% off (any amount), OR Coupon VG-A1B2C3: ৳200 off (valid to 2026-10-31): apply whichever saves the customer more, not both (an unused coupon stays open)",
  );
  assert.equal(offerNoteFor("unknown", null), firstOrderNote("unknown"));
});

test("first-order offer: the admin board badge reads the server's line, never a customer's own note", () => {
  const first = validateBookingSubmission({ ...base, notes: "Gate 12" }, { coupon: offerNoteFor("first", null) });
  assert.equal(first.ok, true);
  assert.equal(hasFirstOrderMark(first.value.notes), true);
  const withItems = validateBookingSubmission({ ...base, items: [{ item: "Shirt", service: "ironing", quantity: 2 }], notes: "x" }, { coupon: offerNoteFor("first", coupon) });
  assert.equal(hasFirstOrderMark(withItems.value.notes), true);

  // A guest typing the line, with or without items, gets no badge and Ops sees it marked as theirs.
  const forged = "First website order: apply 10% off (any amount)";
  for (const items of [undefined, [{ item: "Shirt", service: "ironing", quantity: 2 }]]) {
    const guest = validateBookingSubmission({ ...base, items, notes: forged }, {});
    assert.equal(guest.ok, true);
    assert.equal(hasFirstOrderMark(guest.value.notes), false);
    assert.match(guest.value.notes, /not verified/);
  }
  assert.equal(withoutOfferClaims("FIRST-WEBSITE ORDER : 10%").includes("FIRST-WEBSITE ORDER"), false);
  assert.equal(withoutOfferClaims("Ring the bell twice"), "Ring the bell twice");
  assert.equal(hasFirstOrderMark(undefined), false);
  assert.equal(hasFirstOrderMark("Website order: couldn't check if this is the number's first"), false);
});

test("first-order offer: the longest offer, estimate and wanted-back wording fit the room kept for them", () => {
  const extras = composeBookingNotes([], undefined, {
    estimate: "৳12,34,560 for 999 items; 20 lines priced at pickup; pickup & delivery charge to confirm",
    backBy: "Wed 30 Sep",
    coupon: offerNoteFor("first", "Coupon VG-A1B2C3: free pickup & delivery this month (valid to 2026-10-31)"),
  });
  assert.ok(extras.length <= NOTE_EXTRAS_RESERVE, `${extras.length} > ${NOTE_EXTRAS_RESERVE}`);
  assert.ok(composeBookingNotes([], undefined, { coupon: offerNoteFor("unknown", null) }).length <= NOTE_EXTRAS_RESERVE);
});
