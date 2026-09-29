/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");
const test = require("node:test");

const C = require("../.foundation-test-build/capacity-logic.js");

test("availability JSON is parsed strictly", () => {
  const a = C.parseAvailability({
    ok: true,
    enabled: true,
    zone: "s9-12",
    today: "2026-09-29",
    days: [
      { date: "2026-09-29", windows: [{ id: "morning", starts: "09:00", ends: "12:00", left: 0, status: "full" }, { id: "evening", starts: "16:00", ends: "20:00", left: 2, status: "few" }] },
      { date: "bad", windows: [] },
      { date: "2026-09-30", windows: [{ id: "lunch", starts: "12:00", ends: "13:00", left: 1, status: "open" }, { id: "afternoon", starts: "12:00", ends: "16:00", left: 5, status: "weird" }] },
    ],
  });
  assert.equal(a.days.length, 2);
  assert.equal(a.days[0].windows[1].left, 2);
  assert.equal(a.days[1].windows.length, 1, "unknown window dropped");
  assert.equal(a.days[1].windows[0].status, "closed", "unknown status is closed, never bookable");
  assert.equal(C.parseAvailability({ ok: false }), null);
  assert.equal(C.bookable("few"), true);
  assert.equal(C.bookable("full"), false);
  assert.equal(C.bookable("past"), false);
});

test("sectors and zones", () => {
  assert.equal(C.sectorOf("Uttara Sector 11"), 11);
  assert.equal(C.sectorOf("House 3, sec-7"), 7);
  assert.equal(C.sectorOf("Uttara"), null);
  assert.equal(C.sectorOf("Sector 25"), null);
  assert.deepEqual(C.parseSectors("1-4, 7 9–10 99"), [1, 2, 3, 4, 7, 9, 10]);
  assert.equal(C.sectorsText([1, 2, 3, 4, 7, 9, 10]), "1–4, 7, 9–10");
  const p = C.zoneProblems([
    { id: "a", name: "A", sectors: [1, 2, 3], active: true },
    { id: "b", name: "B", sectors: [3, 4], active: true },
    { id: "c", name: "C", sectors: [5], active: false },
  ]);
  assert.deepEqual(p.overlap, [3]);
  assert.equal(p.missing.includes(5), true, "a sector only in an inactive zone is missing");
});

test("windows are worded for people and for Ops", () => {
  assert.equal(C.clock("09:00"), "9 AM");
  assert.equal(C.clock("12:00"), "12 PM");
  assert.equal(C.clock("16:30"), "4:30 PM");
  assert.equal(C.windowHours("09:00", "12:00"), "9 AM–12 PM");
  assert.equal(C.windowHours("12:00", "16:00"), "12–4 PM");
  assert.equal(C.windowHours("16:00", "20:00"), "4–8 PM");
  assert.equal(C.shortDate("2026-09-29"), "Tue 29 Sep");
  assert.equal(C.opsPickupLabel("2026-09-29", { id: "evening", starts: "16:00", ends: "20:00" }, true), "Tue 29 Sep, Evening 4–8 PM (window booked)");
  assert.equal(C.addDaysIso("2026-12-31", 1), "2027-01-01");
});

test("the board's load colours", () => {
  assert.equal(C.loadTone(3, 7, false), "ok");
  assert.equal(C.loadTone(5, 7, false), "busy");
  assert.equal(C.loadTone(6, 6, false), "full");
  assert.equal(C.loadTone(8, 6, false), "full");
  assert.equal(C.loadTone(0, 6, true), "closed");
  assert.equal(C.loadTone(2, 0, false), "full", "bookings in a closed slot still show");
  assert.equal(C.fill(8, 6), 1);
  assert.equal(C.fill(0, 0), 0);
});
