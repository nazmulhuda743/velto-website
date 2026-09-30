/* eslint-disable @typescript-eslint/no-require-imports */
const test = require("node:test");
const assert = require("node:assert/strict");

// Server-only modules: outside Next.js that import throws, so stand in an empty module.
require.cache[require.resolve("server-only")] = { id: "server-only", filename: "server-only", loaded: true, exports: {} };
const { firstWebsiteBooking } = require("../.foundation-test-build/first-order-lookup.js");

const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

test("first-order lookup: no earlier website booking for the number is a first order; one is a repeat", async () => {
  const paths = [];
  const fetcher = (rows) => async (path) => (paths.push(path), json(rows));
  assert.equal(await firstWebsiteBooking("+880 1712-345678", fetcher([])), "first");
  assert.equal(await firstWebsiteBooking("01712345678", fetcher([{ id: "t1" }])), "repeat");
  // The number is matched the way Ops stores it (tasks.source_ref, 01XXXXXXXXX), website bookings only.
  const q = new URLSearchParams(paths[0].split("?")[1]);
  assert.equal(paths[0].split("?")[0], "/rest/v1/tasks");
  assert.equal(q.get("source"), "eq.website_booking");
  assert.equal(q.get("source_ref"), "eq.01712345678");
  assert.equal(q.get("limit"), "1");
});

test("first-order lookup: a failed or impossible lookup is unknown, never a guess", async () => {
  assert.equal(await firstWebsiteBooking("01712345678", async () => json({ message: "boom" }, 500)), "unknown");
  assert.equal(await firstWebsiteBooking("01712345678", async () => new Response("<html>", { status: 200 })), "unknown");
  assert.equal(await firstWebsiteBooking("01712345678", async () => { throw new TypeError("fetch failed"); }), "unknown");
  let called = false;
  assert.equal(await firstWebsiteBooking("12345", async () => ((called = true), json([]))), "unknown");
  assert.equal(called, false, "an invalid number is never looked up");
});
