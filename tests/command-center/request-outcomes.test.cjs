/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");
const test = require("node:test");

const { outcomeFunnel, outcomesByChannel } = require("../../.command-center-test-build/lib/admin/request-outcomes.js");

const row = (over = {}) => ({
  lead_id: "x", created_at: "2026-09-20T10:00:00Z", kind: "booking", service: "dry-cleaning", device: "mobile",
  utm_source: null, utm_medium: null, utm_campaign: null, referrer_host: null, click_id: null, landing_page: "/",
  cancelled: false, picked: false, order_number: null, delivered: false, ordered_again: false, returning_customer: null, ...over,
});

test("after the request: cumulative stages, open and cancelled counted apart", () => {
  const rows = [
    row(),
    row({ cancelled: true }),
    row({ picked: true, order_number: "VEL-1" }),
    row({ picked: true, order_number: "VEL-2", delivered: true, returning_customer: false }),
    row({ picked: true, order_number: "VEL-3", delivered: true, ordered_again: true, returning_customer: true }),
  ];
  const o = outcomeFunnel(rows);
  assert.deepEqual(o.steps.map((s) => s.key), ["requests", "picked", "delivered", "again"]);
  assert.deepEqual(o.steps.map((s) => s.count), [5, 3, 2, 1]);
  assert.equal(o.steps[1].fromPrevious, 0.6);
  assert.equal(o.steps[3].fromPrevious, 0.5, "reorders are out of delivered");
  assert.equal(o.open, 1);
  assert.equal(o.cancelled, 1);
  assert.equal(o.newCustomers, 1);
  assert.equal(o.returning, 1);
  assert.deepEqual(outcomeFunnel([]).steps.map((s) => s.ofTotal), [null, null, null, null], "no invented rates");
});

test("after the request by source uses the same channel rules as sessions", () => {
  const rows = [
    row({ utm_source: "facebook", utm_medium: "paid_social", picked: true, delivered: true, ordered_again: true }),
    row({ utm_source: "facebook", utm_medium: "paid_social" }),
    row({ referrer_host: "www.google.com", picked: true }),
    row(),
  ];
  const by = outcomesByChannel(rows);
  assert.deepEqual(by.map((r) => r.key), ["direct", "google_organic", "meta_ads"], "channel order, only channels with requests");
  const meta = by.find((r) => r.key === "meta_ads");
  assert.equal(meta.requests, 2);
  assert.equal(meta.pickupRate, 0.5);
  assert.equal(meta.repeatRate, 1);
  assert.equal(by.find((r) => r.key === "google_organic").repeatRate, null, "no delivered orders: no rate");
});
