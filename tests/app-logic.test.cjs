/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");
const test = require("node:test");

const a = require("../.foundation-test-build/customer/app-logic.js");

const order = (orderNumber, orderDate, status = "Delivered", services = ["Ironing"]) => ({ orderNumber, orderDate, status, services, deliveredAt: null });
// Noon in Dhaka, so the calendar day is unambiguous.
const at = (day) => new Date(`${day}T12:00:00+06:00`);

test("home state: an order in progress wins over everything", () => {
  const orders = [order("VEL-00002", "2026-10-04", "Picked"), order("VEL-00001", "2026-01-02")];
  assert.equal(a.homeState(orders, at("2026-10-05")), "in_progress");
});

test("home state: last order within 60 days is 'same as last time', older is 'welcome back'", () => {
  assert.equal(a.homeState([order("VEL-00001", "2026-08-06")], at("2026-10-05")), "regular");
  assert.equal(a.homeState([order("VEL-00001", "2026-08-05")], at("2026-10-05")), "lapsed");
});

test("home state: no orders, or only cancelled ones, is first-time", () => {
  assert.equal(a.homeState([], at("2026-10-05")), "first");
  assert.equal(a.homeState([order("VEL-00001", "2026-10-01", "Cancelled")], at("2026-10-05")), "first");
});

test("first-order line only at zero orders", () => {
  assert.equal(a.showFirstOrderLine(0), true);
  assert.equal(a.showFirstOrderLine(1), false);
});

test("weekly offer on Home: two completed orders and no routine", () => {
  assert.equal(a.showWeeklyOnHome(1, false), false);
  assert.equal(a.showWeeklyOnHome(2, false), true);
  assert.equal(a.showWeeklyOnHome(3, true), false);
  assert.equal(a.completedCount([order("1", "2026-01-01"), order("2", "2026-01-02", "Picked"), order("3", "2026-01-03")]), 2);
});

const w = (id, left = 3, status = "open") => ({ id, starts: "09:00", ends: "12:00", left, status });

test("pickup days start tomorrow, hide full windows and empty days, at most 7", () => {
  const days = [
    { date: "2026-10-05", windows: [w("evening")] },
    { date: "2026-10-06", windows: [w("morning", 0, "full"), w("evening")] },
    { date: "2026-10-07", windows: [w("morning", 0, "full")] },
    ...Array.from({ length: 9 }, (_, i) => ({ date: `2026-10-${String(8 + i).padStart(2, "0")}`, windows: [w("afternoon", 2, "few")] })),
  ];
  const out = a.pickupDays(days, "2026-10-05");
  assert.equal(out.length, 7);
  assert.equal(out[0].date, "2026-10-06");
  assert.deepEqual(out[0].windows.map((x) => x.id), ["evening"]);
  assert.ok(!out.some((d) => d.date === "2026-10-07"));
});

test("default slot: tomorrow, same window as last time, never today", () => {
  const days = [
    { date: "2026-10-05", windows: [w("evening")] },
    { date: "2026-10-06", windows: [w("morning"), w("evening")] },
  ];
  assert.deepEqual(a.defaultSlot(days, "2026-10-05", "evening"), { date: "2026-10-06", window: "evening" });
});

test("default slot: same window full tomorrow falls back to tomorrow's first open window", () => {
  const days = [{ date: "2026-10-06", windows: [w("morning"), w("evening", 0, "full")] }];
  assert.deepEqual(a.defaultSlot(days, "2026-10-05", "evening"), { date: "2026-10-06", window: "morning" });
});

test("default slot: tomorrow full moves to the next day with capacity; nothing open is null", () => {
  const days = [
    { date: "2026-10-06", windows: [w("evening", 0, "full")] },
    { date: "2026-10-07", windows: [w("evening")] },
  ];
  assert.deepEqual(a.defaultSlot(days, "2026-10-05", "evening"), { date: "2026-10-07", window: "evening" });
  assert.equal(a.defaultSlot([{ date: "2026-10-06", windows: [w("evening", 0, "closed")] }], "2026-10-05", "evening"), null);
  assert.equal(a.isTomorrow("2026-10-06", "2026-10-05"), true);
  assert.equal(a.isTomorrow("2026-10-07", "2026-10-05"), false);
});

test("expected return: +48 h ironing, +72 h washing and dry cleaning, longest for mixed", () => {
  // Collected Mon 5 Oct, 11:00 Dhaka.
  const collected = "2026-10-05T05:00:00Z";
  assert.deepEqual(a.expectedReturn(collected, ["Ironing"], "Picked"), { date: "2026-10-07", window: "morning" });
  assert.deepEqual(a.expectedReturn(collected, ["Wash + Iron"], "Picked"), { date: "2026-10-08", window: "morning" });
  assert.deepEqual(a.expectedReturn(collected, ["Ironing", "Dry Cleaning"], "In Velto Facility"), { date: "2026-10-08", window: "morning" });
});

test("expected return rounds to the next delivery window; after the evening it is the next morning", () => {
  // 13:30 Dhaka + 48 h → afternoon window.
  assert.deepEqual(a.expectedReturn("2026-10-05T07:30:00Z", ["Ironing"], "Picked"), { date: "2026-10-07", window: "afternoon" });
  // 21:00 Dhaka + 48 h → past the last window, next morning.
  assert.deepEqual(a.expectedReturn("2026-10-05T15:00:00Z", ["Ironing"], "Picked"), { date: "2026-10-08", window: "morning" });
  // 07:00 Dhaka + 48 h → before the first window, that morning.
  assert.deepEqual(a.expectedReturn("2026-10-05T01:00:00Z", ["Ironing"], "Picked"), { date: "2026-10-07", window: "morning" });
});

test("expected return is hidden once delivered, and without a Collected time", () => {
  assert.equal(a.expectedReturn("2026-10-05T05:00:00Z", ["Ironing"], "Delivered"), null);
  assert.equal(a.expectedReturn(null, ["Ironing"], "Picked"), null);
  assert.equal(a.expectedReturn("not a date", ["Ironing"], "Picked"), null);
});

test("tracker: done up to the current step, times only from Ops, none on upcoming steps", () => {
  const timeline = [
    { status: "New", at: "2026-10-05T03:00:00Z" },
    { status: "Picked", at: "2026-10-05T05:00:00Z" },
  ];
  const steps = a.trackerSteps("Picked", timeline);
  assert.deepEqual(steps.map((s) => s.state), ["done", "current", "upcoming", "upcoming", "upcoming"]);
  assert.equal(steps[1].at, "2026-10-05T05:00:00Z");
  assert.equal(steps[2].at, null);
  // A step reached without a recorded time shows no time.
  const gap = a.trackerSteps("Ready", [{ status: "Ready", at: "2026-10-07T05:00:00Z" }]);
  assert.equal(gap[1].at, null);
  assert.equal(gap[3].state, "current");
  // Delivered: every step done.
  assert.ok(a.trackerSteps("Delivered", []).every((s) => s.state === "done"));
});

test("ready line: not planned, today, nothing for another day, never 'on the way'", () => {
  const plan = (slotDate, orderNumber = "VEL-00392", kind = "delivery") => ({ kind, orderNumber, slotDate, slot: "evening" });
  assert.deepEqual(a.readyLine([], "VEL-00392", "2026-10-05"), { kind: "notPlanned" });
  assert.deepEqual(a.readyLine([plan("2026-10-05", "VEL-00001")], "VEL-00392", "2026-10-05"), { kind: "notPlanned" });
  assert.deepEqual(a.readyLine([plan("2026-10-05", "VEL-00392", "pickup")], "VEL-00392", "2026-10-05"), { kind: "notPlanned" });
  assert.deepEqual(a.readyLine([plan("2026-10-05")], "VEL-00392", "2026-10-05"), { kind: "today", window: "evening" });
  assert.equal(a.readyLine([plan("2026-10-06")], "VEL-00392", "2026-10-05"), null);
  // Yesterday's plan that didn't happen: not planned again.
  assert.deepEqual(a.readyLine([plan("2026-10-04")], "VEL-00392", "2026-10-05"), { kind: "notPlanned" });
});

test("mixed-service label comes from the items, in order, without repeats", () => {
  const lines = [{ service: "Dry Cleaning" }, { service: "Wash + Iron" }, { service: "Dry Cleaning" }];
  assert.deepEqual(a.serviceList(lines, ["Dry Cleaning"]), ["Dry Cleaning", "Wash + Iron"]);
  assert.equal(a.isMixed(lines, []), true);
  assert.deepEqual(a.serviceList([], ["Ironing"]), ["Ironing"]);
  assert.equal(a.isMixed([{ service: "Ironing" }], ["Ironing"]), false);
});

test("dhaka date crosses midnight at 18:00 UTC", () => {
  assert.equal(a.dhakaDate("2026-10-05T17:59:00Z"), "2026-10-05");
  assert.equal(a.dhakaDate("2026-10-05T18:00:00Z"), "2026-10-06");
});
