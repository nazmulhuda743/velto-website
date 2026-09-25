/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");
const test = require("node:test");

const r = require("../.foundation-test-build/customer/rhythm.js");

const order = (orderNumber, orderDate, status = "Delivered", services = ["Ironing"], deliveredAt = null) => ({
  orderNumber,
  orderDate,
  status,
  services,
  deliveredAt,
});
// Noon in Dhaka, so the calendar day is unambiguous.
const at = (day) => new Date(`${day}T12:00:00+06:00`);

test("no orders is the first-pickup stage with nothing to repeat", () => {
  const x = r.laundryRhythm([], at("2026-09-25"));
  assert.equal(x.stage, "first");
  assert.equal(x.count, 0);
  assert.equal(x.last, null);
  assert.equal(x.due, null);
});

test("cancelled orders don't count toward the stage or the pace", () => {
  const x = r.laundryRhythm([order("VEL-00003", "2026-09-20", "Cancelled"), order("VEL-00001", "2026-09-01")], at("2026-09-25"));
  assert.equal(x.stage, "second");
  assert.equal(x.count, 1);
  assert.equal(x.last.orderNumber, "VEL-00001");
  assert.equal(x.everyDays, null, "one order has no pace yet");
});

test("days since uses the delivery time when there is one", () => {
  const x = r.laundryRhythm([order("VEL-00001", "2026-09-10", "Delivered", ["Ironing"], "2026-09-13T15:00:00+06:00")], at("2026-09-25"));
  assert.equal(x.daysSince, 12);
});

test("the pace is the median gap between the customer's own order days", () => {
  const orders = [order("VEL-00004", "2026-09-13"), order("VEL-00003", "2026-09-01"), order("VEL-00002", "2026-08-20"), order("VEL-00001", "2026-08-01")];
  const x = r.laundryRhythm(orders, at("2026-09-20"));
  assert.equal(x.stage, "regular");
  assert.equal(x.everyDays, 12, "gaps 12, 12, 19 → 12");
  assert.equal(x.nextOn, "2026-09-25");
  assert.equal(x.due, "later");
});

test("due states move from later to soon to now to overdue", () => {
  const orders = [order("VEL-00002", "2026-09-10"), order("VEL-00001", "2026-08-31")];
  // every 10 days → next on 2026-09-20
  assert.equal(r.laundryRhythm(orders, at("2026-09-15")).due, "later");
  assert.equal(r.laundryRhythm(orders, at("2026-09-18")).due, "soon");
  assert.equal(r.laundryRhythm(orders, at("2026-09-20")).due, "now");
  assert.equal(r.laundryRhythm(orders, at("2026-09-23")).due, "now");
  assert.equal(r.laundryRhythm(orders, at("2026-09-24")).due, "overdue");
});

test("same-day orders are one visit, and odd gaps are clamped to a household range", () => {
  const sameDay = [order("VEL-00003", "2026-09-10"), order("VEL-00002", "2026-09-10"), order("VEL-00001", "2026-09-08")];
  assert.equal(r.laundryRhythm(sameDay, at("2026-09-11")).everyDays, 4, "a 2-day gap is clamped up to 4");
  const long = [order("VEL-00002", "2026-09-01"), order("VEL-00001", "2026-03-01")];
  assert.equal(r.laundryRhythm(long, at("2026-09-11")).everyDays, 45);
});

test("the same-again link preselects the booking service and names the order", () => {
  assert.equal(r.bookingServiceFor(["Dry Cleaning"]), "dry-cleaning");
  assert.equal(r.bookingServiceFor(["Wash + Iron", "Ironing"]), "wash-and-iron");
  assert.equal(r.bookingServiceFor(["Something new"]), null);
  const x = r.laundryRhythm([order("VEL-00001", "2026-09-01", "Delivered", ["Dry Cleaning"])], at("2026-09-11"));
  assert.equal(r.repeatHref(x, "account_second"), "/book?source=account_second&service=dry-cleaning&repeat=VEL-00001");
  const y = r.laundryRhythm([order("VEL-00001", "2026-09-01", "Delivered", ["Something new"])], at("2026-09-11"));
  assert.equal(r.repeatHref(y, "account_second"), "/book?source=account_second&repeat=VEL-00001");
});

test("without a delivery time, days since counts from the order day and says so", () => {
  const x = r.laundryRhythm([order("VEL-00001", "2026-09-10")], at("2026-09-25"));
  assert.equal(x.daysSince, 15);
  assert.equal(x.sinceDelivery, false);
});
