/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");
const test = require("node:test");

const { tabFor, callQueue, riderLoad, riderChoices, dayStrip, nowWindow, changedTime } = require("../.foundation-test-build/admin/today-logic.js");

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
  assert.deepEqual(callQueue([a, b, c], now).map((j) => j.id), [b.id, c.id, a.id]);
  assert.deepEqual(callQueue([a, late, b, confirmed], now).map((j) => j.id), [late.id, b.id, a.id]);
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
