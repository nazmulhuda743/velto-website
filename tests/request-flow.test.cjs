/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");
const test = require("node:test");

const { flowState, needsAction, callTimer, orderCandidates, confirmMessage, pickedMessage, readyMessage, dayText, FLOW } = require("../.foundation-test-build/admin/request-flow.js");

const job = (over = {}) => ({
  id: "j1", kind: "pickup", task_id: "t1", order_number: null, source: "website_booking",
  customer_name: "Nadia Rahman", phone: "01712345678", phone_key: "01712345678", address: "House 12", area: "Uttara Sector 7",
  outlet_code: null, requested: null, stage: "new", slot_date: null, slot: null, assignee_id: null, assignee_name: null,
  trip_key: null, merged_into: null, reason: null, contact_attempts: 0, last_contact_at: null, confirmed_at: null,
  confirmed_by: null, picked_at: null, history: [], created_at: "2026-09-28T04:00:00Z", updated_at: "2026-09-28T04:00:00Z", ...over,
});
const order = (status) => ({ status, orderDate: null, deliveryDate: null, total: 500, due: 0, items: 3, updatedAt: "2026-09-28T04:00:00Z" });
const key = (s) => `${s.key}${s.closed ? `/${s.closed}` : ""}`;

test("the card's step follows the pickup, then the linked order and its delivery", () => {
  assert.equal(key(flowState(job())), "new");
  assert.equal(key(flowState(job({ stage: "assigned", slot_date: "2026-09-29", slot: "evening" }))), "new", "a slot without a call is still to call");
  assert.equal(key(flowState(job({ stage: "assigned", confirmed_at: "x", assignee_id: "p" }))), "confirmed");
  assert.equal(key(flowState(job({ stage: "confirmed", confirmed_at: "x" }))), "confirmed");
  assert.equal(key(flowState(job({ stage: "scheduled" }))), "assigned");
  assert.equal(key(flowState(job({ stage: "picked" }))), "picked", "no order linked yet");
  assert.equal(key(flowState(job({ stage: "done" }))), "picked", "old finished pickups count as picked");
  const picked = job({ stage: "picked", order_number: "VEL-01952" });
  assert.equal(key(flowState(picked, order("Picked"))), "process");
  assert.equal(key(flowState(picked, order("New"))), "process");
  assert.equal(key(flowState(picked, order("Ready"))), "ready");
  assert.equal(key(flowState(picked, order("Ready"), job({ kind: "delivery", assignee_id: "p" }))), "ready", "a delivery needs a person and a day");
  assert.equal(key(flowState(picked, order("Ready"), job({ kind: "delivery", assignee_id: "p", slot_date: "2026-09-30", slot: "morning" }))), "delivery");
  assert.equal(key(flowState(picked, order("Out for Delivery"))), "delivery");
  assert.equal(key(flowState(picked, order("Delivered"))), "delivered");
  assert.equal(key(flowState(picked, order("Cancelled"))), "process/cancelled");
  assert.equal(key(flowState(job({ stage: "cancelled" }))), "new/cancelled");
  assert.equal(key(flowState(job({ stage: "cancelled", confirmed_at: "x", assignee_id: "p", slot_date: "2026-09-29" }))), "assigned/cancelled");
  assert.equal(key(flowState(job({ stage: "merged" }))), "new/merged");
  assert.equal(flowState(picked, order("Delivered")).index, FLOW.length - 1);
});

test("only steps waiting on staff need action", () => {
  assert.equal(needsAction(flowState(job())), true);
  assert.equal(needsAction(flowState(job({ stage: "picked", order_number: "VEL-01" }), order("Picked"))), false, "at the outlet");
  assert.equal(needsAction(flowState(job({ stage: "picked", order_number: "VEL-01" }), order("Delivered"))), false);
  assert.equal(needsAction(flowState(job({ stage: "cancelled" }))), false);
});

test("the first call is timed: fine for 30 minutes, late after 24 hours", () => {
  const created = Date.parse("2026-09-28T04:00:00Z");
  assert.deepEqual(callTimer(job(), created + 10 * 60_000), { minutes: 10, tone: "ok" });
  assert.equal(callTimer(job(), created + 45 * 60_000).tone, "soon");
  assert.equal(callTimer(job(), created + 25 * 3_600_000).tone, "late");
  assert.equal(callTimer(job({ stage: "confirmed" }), created + 25 * 3_600_000), null, "only new requests are timed");
});

test("order candidates: same phone, made from the day before the request on", () => {
  const ctx = {
    orders: 3, lastOrder: null,
    recent: [
      { orderNumber: "VEL-3", status: "Picked", orderDate: null, createdAt: "2026-09-28T09:00:00Z" },
      { orderNumber: "VEL-2", status: "Delivered", orderDate: null, createdAt: "2026-09-27T05:00:00Z" },
      { orderNumber: "VEL-1", status: "Delivered", orderDate: null, createdAt: "2026-08-01T05:00:00Z" },
    ],
  };
  assert.deepEqual(orderCandidates(job(), ctx).map((o) => o.orderNumber), ["VEL-3", "VEL-2"]);
  assert.deepEqual(orderCandidates(job(), null), []);
});

test("WhatsApp messages: first name, day and time of day, in Bangla or English", () => {
  assert.equal(dayText("2026-09-28", "bn"), "২৮ সেপ্টেম্বর, সোমবার");
  assert.equal(dayText("2026-09-28", "en"), "Mon 28 Sep");
  const en = confirmMessage({ name: "Md. Nadia Rahman", date: "2026-09-29", slot: "evening", rider: "Monir" }, "en");
  assert.match(en, /^Hello Nadia, this is Velto\. Your pickup is confirmed for Tue 29 Sep, Evening \(5–9 PM\)\. Monir from our team/);
  const bn = confirmMessage({ name: null, date: "2026-09-29", slot: "morning", rider: null }, "bn");
  assert.match(bn, /^আসসালামু আলাইকুম, Velto থেকে বলছি। আপনার পিকআপ কনফার্ম হয়েছে: ২৯ সেপ্টেম্বর, মঙ্গলবার, সকাল/);
  assert.doesNotMatch(bn, /আসবেন/, "no rider line without a rider");
  assert.match(pickedMessage({ name: "Nadia", orderNumber: "VEL-01952" }, "en"), /Your order number is VEL-01952\./);
  assert.doesNotMatch(pickedMessage({ name: "Nadia", orderNumber: null }, "bn"), /অর্ডার নম্বর/);
  assert.match(readyMessage({ name: "Nadia", orderNumber: "VEL-01952", date: null, slot: null }, "en"), /is ready\. When would you like it delivered\?/);
  assert.match(readyMessage({ name: "Nadia", orderNumber: "VEL-01952", date: "2026-09-30", slot: "afternoon" }, "bn"), /ডেলিভারি: ৩০ সেপ্টেম্বর, বুধবার, দুপুর/);
  for (const m of [en, bn]) assert.ok(m.length < 400, "short enough to read at a glance");
});

test("history before this request: its own new order doesn't make a customer 'returning'", () => {
  const { priorOrders } = require("../.foundation-test-build/admin/request-flow.js");
  const own = { orderNumber: "VEL-9", status: "Picked", orderDate: null, createdAt: "2026-09-28T09:00:00Z" };
  const old = { orderNumber: "VEL-5", status: "Delivered", orderDate: null, createdAt: "2026-07-01T09:00:00Z" };
  assert.deepEqual(priorOrders(job(), { orders: 1, lastOrder: null, recent: [own] }), { count: 0, last: null });
  assert.deepEqual(priorOrders(job(), { orders: 4, lastOrder: null, recent: [own, old] }), { count: 3, last: "VEL-5" });
  assert.deepEqual(priorOrders(job(), null), { count: 0, last: null });
});

test("two open requests from one phone: the later one merges into the first", () => {
  const { duplicateOf } = require("../.foundation-test-build/admin/request-flow.js");
  const a = job({ id: "a", created_at: "2026-09-28T01:00:00Z" });
  const b = job({ id: "b", created_at: "2026-09-28T03:00:00Z" });
  const c = job({ id: "c", created_at: "2026-09-28T02:00:00Z", stage: "picked" });
  const d = job({ id: "d", phone_key: "01999999999" });
  const map = duplicateOf([b, a, c, d]);
  assert.equal(map.get("b").id, "a");
  assert.equal(map.has("a"), false);
  assert.equal(map.has("c"), false, "a picked request is not a duplicate");
  assert.equal(map.has("d"), false);
});

test("new request push: short, to the To-call list", () => {
  const { newRequestPush } = require("../.foundation-test-build/admin/request-flow.js");
  const p = newRequestPush("booking", { name: " Nadia Rahman ", area: "Uttara Sector 7", when: "Tomorrow, Afternoon", service: "dry-cleaning" }, "https://www.velto.com.bd/");
  assert.equal(p.title, "🧺 New pickup booking");
  assert.equal(p.body, "Nadia Rahman · Uttara Sector 7 · Tomorrow, Afternoon · Dry cleaning. Call within 30 min.");
  assert.equal(p.url, "https://www.velto.com.bd/admin/requests?stage=new");
  const q = newRequestPush("quote", { name: "A", area: "Sector 3" }, "https://x.test");
  assert.equal(q.title, "📐 New quote request");
  assert.equal(q.body, "A · Sector 3. Call within 30 min.");
});
