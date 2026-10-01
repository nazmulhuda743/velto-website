/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");
const test = require("node:test");

const { tabFor, callQueue, riderLoad, riderChoices, dayStrip, nowWindow, windowOver, changedTime, linkCandidates } = require("../.foundation-test-build/admin/today-logic.js");

let n = 0;
const job = (over = {}) => ({
  id: `job-${++n}`, kind: "pickup", task_id: null, order_number: null, source: "website_booking",
  customer_name: "Customer", phone: "01712345678", phone_key: `017${String(n).padStart(8, "0")}`, address: `House ${n}, Road 7`,
  area: "Uttara Sector 7", outlet_code: null, requested: null, stage: "new", slot_date: null, slot: null,
  assignee_id: null, assignee_name: null, trip_key: null, merged_into: null, reason: null, contact_attempts: 0,
  last_contact_at: null, confirmed_at: null, confirmed_by: null, picked_at: null, history: [],
  created_at: "2026-10-01T00:00:00Z", updated_at: "2026-10-01T00:00:00Z", ...over,
});
const scheduled = (rider, date, slot, over = {}) => job({ stage: "scheduled", assignee_id: rider, slot_date: date, slot, ...over });

test("each job lands in one tab, or none", () => {
  assert.equal(tabFor(job({ stage: "new" })), "call");
  assert.equal(tabFor(job({ stage: "confirmed" })), "assign");
  assert.equal(tabFor(job({ stage: "assigned", assignee_id: "b", slot_date: null })), "assign");
  assert.equal(tabFor(job({ stage: "scheduled", assignee_id: "b", slot_date: "2026-10-02", slot: "morning" })), "route");
  assert.equal(tabFor(job({ stage: "picked" })), "done");
  assert.equal(tabFor(job({ kind: "delivery", source: "ops_order", stage: "new" })), "deliver");
  assert.equal(tabFor(job({ kind: "delivery", source: "ops_order", stage: "confirmed" })), "deliver");
  assert.equal(tabFor(job({ kind: "delivery", source: "ops_order", stage: "assigned", assignee_id: "b" })), "deliver");
  assert.equal(tabFor(job({ kind: "delivery", source: "ops_order", stage: "scheduled" })), "route");
  assert.equal(tabFor(job({ kind: "delivery", source: "ops_order", stage: "done" })), "done");
  assert.equal(tabFor(job({ stage: "cancelled" })), null);
  assert.equal(tabFor(job({ stage: "merged" })), null);
  assert.equal(tabFor(job({ source: "website_quote" })), null);
});

test("the call queue is oldest first, and only requests that still need a first call", () => {
  const now = Date.parse("2026-10-01T10:00:00Z");
  const ago = (min) => new Date(now - min * 60_000).toISOString();
  const a = job({ created_at: ago(5) });
  const b = job({ created_at: ago(45) });
  const c = job({ created_at: ago(12) });
  const late = job({ created_at: ago(30 * 60) });
  const confirmed = job({ stage: "confirmed", created_at: ago(90) });
  assert.deepEqual(callQueue([a, b, c]).map((j) => j.id), [b.id, c.id, a.id]);
  assert.deepEqual(callQueue([a, late, b, confirmed]).map((j) => j.id), [late.id, b.id, a.id]);
});

test("a rider's load counts scheduled stops in that window, a combined trip once", () => {
  const trip = scheduled("b", "2026-10-02", "morning", { trip_key: "t1" });
  const same = scheduled("b", "2026-10-02", "morning", { trip_key: "t1" });
  const other = scheduled("b", "2026-10-02", "morning");
  const nextDay = scheduled("b", "2026-10-03", "morning");
  const someoneElse = scheduled("m", "2026-10-02", "morning");
  const picked = job({ stage: "picked", assignee_id: "b", slot_date: "2026-10-02", slot: "morning" });
  const jobs = [trip, same, other, nextDay, someoneElse, picked];
  assert.equal(riderLoad(jobs, "b", "2026-10-02", "morning"), 2);
  assert.equal(riderLoad(jobs, "b", "2026-10-02", "evening"), 0);
});

test("rider choices: free riders first, full ones after, people who are off last", () => {
  const date = "2026-10-02";
  const riders = [
    { id: "b", name: "Bappy", stopsPerWindow: 8, off: false },
    { id: "m", name: "Monir", stopsPerWindow: 8, off: false },
    { id: "r", name: "Rakib", stopsPerWindow: 8, off: false },
    { id: "o", name: "Oli", stopsPerWindow: 8, off: true },
  ];
  const jobs = [
    scheduled("b", date, "evening"),
    ...Array.from({ length: 8 }, () => scheduled("r", date, "evening")),
    scheduled("o", date, "evening"),
    scheduled("o", date, "evening"),
  ];
  const choices = riderChoices(riders, jobs, date, "evening");
  assert.deepEqual(choices.map((c) => c.name), ["Monir", "Bappy", "Rakib", "Oli"]);
  assert.deepEqual(choices.map((c) => c.best), [true, false, false, false]);
  assert.deepEqual(choices.map((c) => c.load), [0, 1, 8, 2]);
  assert.equal(choices.find((c) => c.name === "Rakib").full, true);
  const oli = choices.find((c) => c.name === "Oli");
  assert.equal(oli.off, true);
  assert.equal(oli.best, false);
  // Nobody has room: nobody is "best".
  const full = riderChoices([riders[2]], jobs, date, "evening");
  assert.equal(full[0].best, false);
});

test("rider choices: the most room left wins, not the fewest stops (0/1 vs 1/8)", () => {
  const date = "2026-10-02";
  const riders = [
    { id: "s", name: "Small", stopsPerWindow: 1, off: false },
    { id: "l", name: "Large", stopsPerWindow: 8, off: false },
  ];
  const choices = riderChoices(riders, [scheduled("l", date, "morning")], date, "morning");
  assert.deepEqual(choices.map((c) => `${c.name} ${c.load}/${c.stopsPerWindow}`), ["Large 1/8", "Small 0/1"]);
  assert.deepEqual(choices.map((c) => c.best), [true, false]);
  // Same room left: the lighter load for its size first (1/4 before 4/7), then the name.
  const tie = riderChoices(
    [
      { id: "a", name: "Anik", stopsPerWindow: 7, off: false },
      { id: "z", name: "Zaman", stopsPerWindow: 4, off: false },
    ],
    [...Array.from({ length: 4 }, () => scheduled("a", date, "morning")), scheduled("z", date, "morning")],
    date,
    "morning",
  );
  assert.deepEqual(tie.map((c) => c.name), ["Zaman", "Anik"]);
});

test("the day strip adds up room and planned stops per window, leaving out people who are off", () => {
  const date = "2026-10-02";
  const riders = [
    { id: "b", name: "Bappy", stopsPerWindow: 8, off: false },
    { id: "m", name: "Monir", stopsPerWindow: 8, off: false },
    { id: "r", name: "Rakib", stopsPerWindow: 8, off: false },
    { id: "o", name: "Oli", stopsPerWindow: 8, off: true },
  ];
  const jobs = [
    scheduled("b", date, "morning"),
    scheduled("b", date, "morning"),
    scheduled("m", date, "afternoon"),
    scheduled("r", date, "evening"),
    scheduled("r", "2026-10-03", "evening"),
  ];
  const strip = dayStrip(riders, jobs, date);
  assert.deepEqual(strip.map((s) => s.slot), ["morning", "afternoon", "evening"]);
  assert.deepEqual(strip.map((s) => s.capacity), [24, 24, 24]);
  assert.deepEqual(strip.map((s) => s.planned), [2, 1, 1]);
});

test("a customer-changed time shows until someone acts on it", () => {
  const entry = (action) => ({ at: "2026-10-01T00:00:00Z", by: "x", action });
  assert.equal(changedTime(job({ history: [entry("created"), entry("customer changed time")] })), true);
  assert.equal(changedTime(job({ history: [entry("customer changed time"), entry("confirmed")] })), false);
  assert.equal(changedTime(job({ history: [] })), false);
});

test("the current window follows Dhaka time (UTC+6)", () => {
  const at = (hhmm) => new Date(`2026-10-01T${hhmm}:00Z`);
  assert.equal(nowWindow(at("03:00")), "morning"); // 09:00 Dhaka
  assert.equal(nowWindow(at("05:59")), "morning");
  assert.equal(nowWindow(at("06:00")), "afternoon"); // 12:00 Dhaka
  assert.equal(nowWindow(at("10:00")), "evening"); // 16:00 Dhaka
  assert.equal(nowWindow(at("13:59")), "evening");
  assert.equal(nowWindow(at("14:30")), null); // 20:30 Dhaka
  assert.equal(nowWindow(at("02:59")), null); // 08:59 Dhaka
});

test("an off rider's scheduled stops still count as planned", () => {
  const date = "2026-10-02";
  const riders = [
    { id: "b", name: "Bappy", stopsPerWindow: 8, off: false },
    { id: "o", name: "Oli", stopsPerWindow: 8, off: true },
  ];
  const jobs = [scheduled("b", date, "morning"), scheduled("o", date, "morning"), scheduled("o", date, "morning")];
  const [morning] = dayStrip(riders, jobs, date);
  assert.equal(morning.planned, 3);
  assert.equal(morning.capacity, 8);
});

test("a rider with no stops-per-window set uses the default of 8", () => {
  const date = "2026-10-02";
  const riders = [{ id: "z", name: "Zia", stopsPerWindow: 0, off: false }];
  const eight = Array.from({ length: 8 }, () => scheduled("z", date, "morning"));
  assert.equal(dayStrip(riders, [], date)[0].capacity, 8);
  assert.equal(riderChoices(riders, eight.slice(0, 7), date, "morning")[0].full, false);
  assert.equal(riderChoices(riders, eight, date, "morning")[0].full, true);
});

test("weekly routine pickups (source 'weekly') wait in Assign like website pickups, then Route", () => {
  assert.equal(tabFor(job({ source: "weekly", stage: "confirmed", slot_date: "2026-10-02", slot: "afternoon" })), "assign");
  assert.equal(tabFor(job({ source: "weekly", stage: "assigned", assignee_id: "b" })), "assign");
  assert.equal(tabFor(job({ source: "weekly", stage: "scheduled", assignee_id: "b", slot_date: "2026-10-02", slot: "morning" })), "route");
  assert.equal(tabFor(job({ source: "weekly", stage: "new" })), "call");
});

test("link candidates: same phone's orders from a day before to two days after the pickup, not cancelled or taken", () => {
  const picked = "2026-10-01T10:00:00Z";
  const at = (h) => new Date(Date.parse(picked) + h * 3_600_000).toISOString();
  const p = job({ stage: "picked", picked_at: picked, created_at: at(-48) });
  const NOW = Date.parse(picked) + 3 * 86_400_000;
  const recent = [
    { orderNumber: "VEL-00005", status: "Picked", orderDate: null, createdAt: at(60) }, // 2.5 days after: too late
    { orderNumber: "VEL-00004", status: "Picked", orderDate: null, createdAt: at(30) },
    { orderNumber: "VEL-00003", status: "Cancelled", orderDate: null, createdAt: at(5) },
    { orderNumber: "VEL-00002", status: "Picked", orderDate: null, createdAt: at(2) },
    { orderNumber: "VEL-00009", status: "Picked", orderDate: null, createdAt: at(1) }, // linked to another pickup
    { orderNumber: "not-an-order", status: "Picked", orderDate: null, createdAt: at(1) },
    { orderNumber: "VEL-00001", status: "Delivered", orderDate: null, createdAt: at(-23) },
    { orderNumber: "VEL-00000", status: "Delivered", orderDate: null, createdAt: at(-25) }, // over a day before
  ];
  assert.deepEqual(linkCandidates(p, recent, new Set(["VEL-00009"]), NOW), [
    { orderNumber: "VEL-00001", createdAt: at(-23) },
    { orderNumber: "VEL-00002", createdAt: at(2) },
    { orderNumber: "VEL-00004", createdAt: at(30) },
  ]);
  // Not before the booking itself reached the board.
  assert.deepEqual(linkCandidates({ ...p, created_at: at(-2) }, recent, new Set(), NOW).map((o) => o.orderNumber), ["VEL-00009", "VEL-00002", "VEL-00004"]);
  // Only picked pickups that have no order yet.
  assert.deepEqual(linkCandidates({ ...p, order_number: "VEL-00002" }, recent, new Set(), NOW), []);
  assert.deepEqual(linkCandidates({ ...p, stage: "scheduled" }, recent, new Set(), NOW), []);
  assert.deepEqual(linkCandidates({ ...p, kind: "delivery" }, recent, new Set(), NOW), []);
  assert.deepEqual(linkCandidates({ ...p, picked_at: null }, recent, new Set(), NOW), []);
  assert.deepEqual(linkCandidates(p, undefined, new Set(), NOW), []);
});

test("link candidates: only pickups picked in the last 7 days (as website_dispatch_autolink)", () => {
  const picked = "2026-10-01T10:00:00Z";
  const p = job({ stage: "picked", picked_at: picked, created_at: "2026-09-30T00:00:00Z" });
  const recent = [{ orderNumber: "VEL-00002", status: "Picked", orderDate: null, createdAt: "2026-10-01T12:00:00Z" }];
  const day = 86_400_000;
  assert.equal(linkCandidates(p, recent, new Set(), Date.parse(picked) + 6 * day).length, 1);
  assert.deepEqual(linkCandidates(p, recent, new Set(), Date.parse(picked) + 7 * day + 1), []);
});

test("windowOver: a window of today is over at its end (Dhaka), other days by date", () => {
  const at = (h) => new Date(Date.UTC(2026, 9, 2, h - 6, 5)); // 2 Oct, h:05 in Dhaka
  assert.equal(windowOver("2026-10-02", "morning", at(11)), false);
  assert.equal(windowOver("2026-10-02", "morning", at(12)), true);
  assert.equal(windowOver("2026-10-02", "afternoon", at(15)), false);
  assert.equal(windowOver("2026-10-02", "afternoon", at(16)), true);
  assert.equal(windowOver("2026-10-02", "evening", at(19)), false);
  assert.equal(windowOver("2026-10-02", "evening", at(20)), true);
  assert.equal(windowOver("2026-10-03", "morning", at(21)), false);
  assert.equal(windowOver("2026-10-01", "evening", at(8)), true);
});
