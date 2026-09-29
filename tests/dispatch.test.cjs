/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");
const test = require("node:test");

const { suggestedSlot, findOverlaps, nextFreeSlot, dayPlan, stopCount, needsPlan } = require("../.foundation-test-build/admin/dispatch-logic.js");

let n = 0;
const job = (over = {}) => ({
  id: `job-${++n}`, kind: "pickup", task_id: null, order_number: null, source: "website_booking",
  customer_name: "Customer", phone: "01712345678", phone_key: `017${String(n).padStart(8, "0")}`, address: `House ${n}, Road 7`,
  area: "Uttara Sector 7", outlet_code: null, requested: null, stage: "new", slot_date: null, slot: null,
  assignee_id: null, assignee_name: null, trip_key: null, merged_into: null, reason: null, history: [],
  created_at: `2026-09-27T0${n % 10}:00:00Z`, updated_at: "2026-09-27T00:00:00Z", ...over,
});

test("the customer's own choice becomes the suggested slot", () => {
  const created = "2026-09-27T05:00:00Z"; // 11:00 in Dhaka
  assert.deepEqual(suggestedSlot("Tomorrow Mon 28 Sep, Afternoon", created, "2026-09-27"), { date: "2026-09-28", slot: "afternoon" });
  assert.deepEqual(suggestedSlot("Today Sun 27 Sep, Evening", created, "2026-09-27"), { date: "2026-09-27", slot: "evening" });
  assert.deepEqual(suggestedSlot("Tue 29 Sep, Morning", created, "2026-09-27"), { date: "2026-09-29", slot: "morning" });
  // An old request whose day has passed keeps only the part of the day.
  assert.deepEqual(suggestedSlot("Today Sun 27 Sep, Evening", created, "2026-09-29"), { date: null, slot: "evening" });
  // "2 Jan" asked in late December is next year.
  assert.deepEqual(suggestedSlot("Sat 2 Jan, Morning", "2026-12-30T05:00:00Z", "2026-12-30"), { date: "2027-01-02", slot: "morning" });
  assert.deepEqual(suggestedSlot(null, created, "2026-09-27"), { date: null, slot: null });
});

test("the same customer twice: keep the first request, merge the others", () => {
  const a = job({ phone_key: "01711111111", created_at: "2026-09-27T01:00:00Z" });
  const b = job({ phone_key: "01711111111", created_at: "2026-09-27T03:00:00Z" });
  const c = job({ phone_key: "01711111111", created_at: "2026-09-27T02:00:00Z" });
  const closed = job({ phone_key: "01711111111", stage: "cancelled" });
  const [dup] = findOverlaps([a, b, c, closed]).filter((o) => o.kind === "duplicate");
  assert.equal(dup.keep.id, a.id);
  assert.deepEqual(dup.others.map((j) => j.id), [c.id, b.id]);
});

test("a pickup and a delivery at one place: combine, the planned one leads", () => {
  const delivery = job({ kind: "delivery", source: "ops_order", phone_key: "01722222222", slot_date: "2026-09-28", slot: "morning", assignee_id: "p1", assignee_name: "Bappy", stage: "scheduled" });
  const pickup = job({ phone_key: "01722222222" });
  const [same] = findOverlaps([delivery, pickup]).filter((o) => o.kind === "same_place");
  assert.equal(same.lead.id, delivery.id);
  assert.equal(same.other.id, pickup.id);
  assert.equal(same.why, "phone");
  // Already one trip, or planned for different days: nothing to suggest.
  assert.equal(findOverlaps([{ ...delivery, trip_key: "t" }, { ...pickup, trip_key: "t" }]).length, 0);
  assert.equal(findOverlaps([delivery, { ...pickup, slot_date: "2026-09-30", slot: "evening" }]).filter((o) => o.kind === "same_place").length, 0);
  // Same address with different phones (a family) also counts.
  const other = job({ kind: "delivery", source: "ops_order", phone_key: "01733333333", address: "house 12 road 7" });
  const mine = job({ phone_key: "01744444444", address: "House 12, Road 7" });
  assert.equal(findOverlaps([other, mine]).find((o) => o.kind === "same_place")?.why, "address");
});

test("overbooked: more stops in a slot than one person can do; a combined trip counts once", () => {
  const plan = (i, extra = {}) => job({ assignee_id: "p1", assignee_name: "Rifat", slot_date: "2026-09-28", slot: "morning", stage: "scheduled", ...extra });
  const jobs = [plan(1), plan(2), plan(3, { trip_key: "t" }), plan(4, { trip_key: "t" })];
  assert.equal(stopCount(jobs), 3);
  assert.equal(findOverlaps(jobs, 3).filter((o) => o.kind === "overbooked").length, 0);
  const [over] = findOverlaps([...jobs, plan(5)], 3).filter((o) => o.kind === "overbooked");
  assert.deepEqual([over.personName, over.stops, over.capacity, over.slot], ["Rifat", 4, 3, "morning"]);
});

test("next free slot skips full slots, from the asked slot onwards", () => {
  const full = (slot, date = "2026-09-28") => Array.from({ length: 2 }, () => job({ assignee_id: "p1", slot_date: date, slot, stage: "scheduled" }));
  const jobs = [...full("morning"), ...full("afternoon")];
  assert.deepEqual(nextFreeSlot(jobs, "p1", { date: "2026-09-28", slot: "morning" }, 2), { date: "2026-09-28", slot: "evening" });
  assert.deepEqual(nextFreeSlot([...jobs, ...full("evening")], "p1", { date: "2026-09-28", slot: "afternoon" }, 2), { date: "2026-09-29", slot: "morning" });
});

test("the day plan groups stops by slot and person, and flags overload", () => {
  const jobs = [
    job({ assignee_id: "p2", assignee_name: "Rifat", slot_date: "2026-09-28", slot: "evening", stage: "scheduled" }),
    job({ assignee_id: "p1", assignee_name: "Bappy", slot_date: "2026-09-28", slot: "morning", stage: "scheduled" }),
    job({ assignee_id: "p1", assignee_name: "Bappy", slot_date: "2026-09-28", slot: "morning", stage: "scheduled" }),
    job({ assignee_id: "p1", assignee_name: "Bappy", slot_date: "2026-09-29", slot: "morning", stage: "scheduled" }),
    job({ stage: "new" }),
  ];
  const plan = dayPlan(jobs, "2026-09-28", 1);
  assert.deepEqual(plan.map((s) => s.slot.id), ["morning", "afternoon", "evening"]);
  assert.deepEqual(plan[0].people.map((p) => [p.person.name, p.count, p.over]), [["Bappy", 2, true], ["Rifat", 0, false]]);
  assert.equal(plan[2].people[1].count, 1);
  assert.equal(needsPlan(jobs[4]), true);
  assert.equal(needsPlan(jobs[0]), false);
});

test("deliveries are grouped by urgency; long-Ready orders wait at the outlet", () => {
  const { deliveryBucket, daysSince } = require("../.foundation-test-build/admin/dispatch-logic.js");
  const now = Date.parse("2026-09-28T06:00:00Z");
  const fresh = "2026-09-26T06:00:00Z";
  const old = "2026-09-10T06:00:00Z";
  const b = (deliveryDate, updatedAt) => deliveryBucket({ deliveryDate, updatedAt }, "2026-09-28", now);
  assert.equal(b("2026-09-28", old), "today", "due today wins, however long it has waited");
  assert.equal(b("2026-09-29", fresh), "tomorrow");
  assert.equal(b("2026-10-02", fresh), "later");
  assert.equal(b("2026-09-25", fresh), "late");
  assert.equal(b(null, fresh), "nodate");
  assert.equal(b("2026-09-12", old), "waiting");
  assert.equal(b(null, old), "waiting");
  assert.equal(deliveryBucket(null, "2026-09-28", now), "nodate", "unknown order: ask for a date");
  assert.equal(daysSince(old, now), 18);
});
