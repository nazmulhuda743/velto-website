/* eslint-disable @typescript-eslint/no-require-imports */
const test = require("node:test");
const assert = require("node:assert/strict");

// The loaders are server-only; outside Next.js that import throws, so stand in an empty module.
require.cache[require.resolve("server-only")] = { id: "server-only", filename: "server-only", loaded: true, exports: {} };
process.env.VELTO_SUPABASE_URL = "https://ops.example.supabase.co";
process.env.VELTO_SUPABASE_SECRET_KEY = "sb_secret_test_value";
const { getRiders, getToday } = require("../.foundation-test-build/admin/today.js");
const { getDispatch } = require("../.foundation-test-build/admin/dispatch.js");

const A = "00000000-0000-4000-8000-00000000a001";
const B = "00000000-0000-4000-8000-00000000a002";
const C = "00000000-0000-4000-8000-00000000a003";
const STAFF = [
  { id: A, name: "Bappy", role: "manager" },
  { id: B, name: "Monir", role: "manager" },
  { id: C, name: "Oli Ullah", role: "worker" },
];
const DATE = "2026-10-01";
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const missing = () => json({ code: "42P01", message: 'relation "public.website_riders" does not exist' }, 404);

/**
 * A stand-in for Supabase: `routes` maps a path fragment ("/rest/v1/website_riders") to a Response
 * or a function returning one (or throwing). Every call is recorded in `calls`.
 */
function supabase(routes, calls = []) {
  return async (input, init = {}) => {
    const url = String(input);
    calls.push({ url, method: init.method ?? "GET", body: init.body ? JSON.parse(init.body) : undefined });
    const key = Object.keys(routes).find((k) => url.includes(k));
    if (!key) return json({ message: `no stub for ${url}` }, 500);
    const answer = routes[key];
    return typeof answer === "function" ? answer(url) : answer.clone();
  };
}

const staffRoute = { "/rest/v1/profiles": json(STAFF) };

test("riders: nobody set up yet → every active staff member at 8 stops, none off", async () => {
  const riders = await getRiders(DATE, supabase({ ...staffRoute, "/rest/v1/website_riders": json([]), "/rest/v1/website_rider_days_off": json([]) }));
  assert.deepEqual(riders, [
    { id: A, name: "Bappy", stopsPerWindow: 8, off: false },
    { id: B, name: "Monir", stopsPerWindow: 8, off: false },
    { id: C, name: "Oli Ullah", stopsPerWindow: 8, off: false },
  ]);
});

test("riders: once someone is ticked, only people who can ride, with their numbers and that day's days off", async () => {
  const calls = [];
  const riders = await getRiders(
    DATE,
    supabase(
      {
        ...staffRoute,
        "/rest/v1/website_riders": json([
          { profile_id: A, can_ride: true, stops_per_window: 6 },
          { profile_id: B, can_ride: false, stops_per_window: 8 },
          { profile_id: C, can_ride: true, stops_per_window: 10 },
          // Ticked, but no longer an active Ops staff member: not offered.
          { profile_id: "00000000-0000-4000-8000-00000000a0ff", can_ride: true, stops_per_window: 8 },
        ]),
        "/rest/v1/website_rider_days_off": json([{ profile_id: C }]),
      },
      calls,
    ),
  );
  assert.deepEqual(riders, [
    { id: A, name: "Bappy", stopsPerWindow: 6, off: false },
    { id: C, name: "Oli Ullah", stopsPerWindow: 10, off: true },
  ]);
  const daysOff = calls.find((c) => c.url.includes("website_rider_days_off"));
  assert.match(decodeURIComponent(daysOff.url), /day=eq\.2026-10-01/);
});

test("riders: a missing table, a 500 or a network failure falls back to the staff list, never an empty list", async () => {
  const everyone = STAFF.map((p) => ({ id: p.id, name: p.name, stopsPerWindow: 8, off: false }));
  assert.deepEqual(await getRiders(DATE, supabase({ ...staffRoute, "/rest/v1/website_riders": json({ message: "boom" }, 500), "/rest/v1/website_rider_days_off": json({ message: "boom" }, 500) })), everyone);
  assert.deepEqual(await getRiders(DATE, supabase({ ...staffRoute, "/rest/v1/website_riders": missing(), "/rest/v1/website_rider_days_off": missing() })), everyone);
  const down = () => { throw new TypeError("fetch failed"); };
  assert.deepEqual(await getRiders(DATE, supabase({ ...staffRoute, "/rest/v1/website_riders": down, "/rest/v1/website_rider_days_off": down })), everyone);
});

test("riders: a day off still applies before anyone is ticked", async () => {
  const riders = await getRiders(DATE, supabase({ ...staffRoute, "/rest/v1/website_riders": json([]), "/rest/v1/website_rider_days_off": json([{ profile_id: B }]) }));
  assert.deepEqual(riders.map((r) => [r.name, r.off]), [["Bappy", false], ["Monir", true], ["Oli Ullah", false]]);
});

const job = (over) => ({
  id: "00000000-0000-4000-8000-000000000001", kind: "pickup", task_id: null, order_number: null, source: "website_booking",
  customer_name: "Laila", phone: "01912606060", phone_key: "01912606060", address: "House 14", area: "Uttara Sector 4",
  outlet_code: null, requested: null, stage: "new", slot_date: null, slot: null, assignee_id: null, assignee_name: null,
  trip_key: null, merged_into: null, reason: null, contact_attempts: 0, last_contact_at: null, confirmed_at: null,
  confirmed_by: null, picked_at: null, history: [], created_at: "2026-09-30T02:00:00Z", updated_at: "2026-09-30T02:00:00Z", ...over,
});

test("today: syncs and auto-links first, degrades when tables are missing, and lists order candidates", async (t) => {
  const picked = job({ id: "00000000-0000-4000-8000-000000000002", stage: "picked", picked_at: "2026-10-01T04:00:00Z" });
  const confirmed = job({ id: "00000000-0000-4000-8000-000000000003", stage: "confirmed", source: "weekly", phone_key: "01711000001" });
  const calls = [];
  t.mock.method(
    globalThis,
    "fetch",
    supabase(
      {
        "/rpc/website_dispatch_sync": json({ ok: true }),
        "/rpc/website_dispatch_autolink": json({ code: "PGRST202", message: "Could not find the function" }, 404),
        "/rest/v1/website_dispatch_jobs?select=id%2Corder_number": json([]),
        "/rest/v1/website_dispatch_jobs": json([picked, confirmed]),
        ...staffRoute,
        "/rest/v1/website_riders": missing(),
        "/rest/v1/website_rider_days_off": missing(),
        "/rpc/website_dispatch_context": json({
          customers: {
            "01912606060": {
              orders: 2,
              lastOrder: null,
              recent: [
                { orderNumber: "VEL-01965", status: "Picked", orderDate: null, createdAt: "2026-10-01T06:00:00Z" },
                { orderNumber: "VEL-01963", status: "Picked", orderDate: null, createdAt: "2026-10-01T05:00:00Z" },
              ],
            },
          },
          orders: {},
        }),
        "/rpc/website_callback_list": json([
          { id: "c1", status: "open", name: "Sadia" },
          { id: "c2", status: "done", name: "Lamia" },
        ]),
        "/rpc/website_routine_list": json({ message: "boom" }, 500),
      },
      calls,
    ),
  );
  const r = await getToday(DATE);
  assert.equal(r.state, "ok");
  const d = r.data;
  assert.deepEqual(d.jobs.map((j) => j.id), [picked.id, confirmed.id]);
  assert.equal(d.riders.length, 3);
  assert.ok(d.riders.every((x) => x.stopsPerWindow === 8 && !x.off));
  assert.deepEqual(d.callbacks.map((c) => c.id), ["c1"]);
  assert.deepEqual(d.routines, []);
  assert.deepEqual(d.candidates, {
    [picked.id]: [
      { orderNumber: "VEL-01963", createdAt: "2026-10-01T05:00:00Z" },
      { orderNumber: "VEL-01965", createdAt: "2026-10-01T06:00:00Z" },
    ],
  });
  assert.ok(!Number.isNaN(Date.parse(d.loadedAt)));
  const order = calls.map((c) => c.url);
  const sync = order.findIndex((u) => u.includes("website_dispatch_sync"));
  const link = order.findIndex((u) => u.includes("website_dispatch_autolink"));
  const read = order.findIndex((u) => u.includes("/rest/v1/website_dispatch_jobs"));
  assert.ok(sync >= 0 && link > sync && read > link, "sync, then auto-link, then read the board");
  // Open work includes confirmed pickups (they wait in Assign).
  assert.match(decodeURIComponent(order[read]), /stage\.in\.\(new,confirmed,assigned,scheduled\)/);
});

test("today: an unreadable board is an error state, not a throw", async (t) => {
  t.mock.method(globalThis, "fetch", supabase({ "/rpc/": json({ ok: true }), "/rest/v1/website_dispatch_jobs": json({ message: "boom" }, 500), ...staffRoute }));
  const r = await getToday(DATE);
  assert.equal(r.state, "error");
});

test("pickup & delivery board: confirmed pickups are open work (they were missing from the board)", async (t) => {
  const calls = [];
  t.mock.method(globalThis, "fetch", supabase({ "/rpc/website_dispatch_sync": json({ ok: true }), "/rest/v1/website_dispatch_jobs": json([]) }, calls));
  const r = await getDispatch();
  assert.equal(r.state, "ok");
  const read = calls.find((c) => c.url.includes("/rest/v1/website_dispatch_jobs"));
  assert.match(decodeURIComponent(read.url), /stage\.in\.\(new,confirmed,assigned,scheduled\)/);
});
