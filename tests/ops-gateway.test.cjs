/* eslint-disable @typescript-eslint/no-require-imports */
const test = require("node:test");
const assert = require("node:assert/strict");

// The gateway is server-only; outside Next.js that import throws, so stand in an empty module.
require.cache[require.resolve("server-only")] = { id: "server-only", filename: "server-only", loaded: true, exports: {} };
const { createSupabaseOpsGateway } = require("../.foundation-test-build/integrations/ops/supabase-rpc.js");
const { IntegrationError, toSafeIntegrationError } = require("../.foundation-test-build/integrations/errors.js");

const SECRET = "sb_secret_test_value";
const booking = { name: "Nadia", phone: "01712345678", area: "Uttara Sector 7", address: "House 2", preferredPickup: "Tomorrow" };
const context = { idempotencyKey: "key-1234567890abcdef", requestId: "req-1" };

/** A gateway whose Ops answers with `answer` (a Response, or a function that throws). */
function gateway(answer, calls = []) {
  return createSupabaseOpsGateway({
    url: "https://ops.example.supabase.co",
    secretKey: SECRET,
    fetch: async (url, init) => {
      calls.push({ url: String(url), body: JSON.parse(init.body) });
      return typeof answer === "function" ? answer() : answer;
    },
  });
}
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

/** The IntegrationError a booking rejects with. */
async function failure(answer, kind = "booking") {
  const g = gateway(answer);
  try {
    await (kind === "booking" ? g.createBooking(booking, context) : g.createQuote(booking, context));
  } catch (error) {
    assert.ok(error instanceof IntegrationError, String(error));
    assert.doesNotMatch(error.message, new RegExp(SECRET));
    return { code: error.code, retryable: error.retryable };
  }
  assert.fail("expected the booking to be refused");
}

test("ops gateway: a good answer returns the reference; a window goes through website_book_pickup", async () => {
  const calls = [];
  const g = gateway(() => json({ ok: true, reference: "WEB-AB12CD34" }), calls);
  assert.deepEqual(await g.createBooking(booking, context), { reference: "WEB-AB12CD34" });
  await g.createBooking({ ...booking, slot: { date: "2026-10-01", window: "morning" } }, context);
  assert.match(calls[0].url, /\/rest\/v1\/rpc\/website_create_request$/);
  assert.equal(calls[0].body.p_kind, "booking");
  assert.match(calls[1].url, /\/rest\/v1\/rpc\/website_book_pickup$/);
  assert.deepEqual(calls[1].body.p_slot, { date: "2026-10-01", window: "morning", source: "website" });
  assert.equal("slot" in calls[1].body.p_payload, false);
});

test("ops gateway: refusals map to the customer-safe codes the booking route turns into 400/409", async () => {
  assert.deepEqual(await failure(json({ ok: false, error: "rate_limited" })), { code: "duplicate_submission", retryable: false });
  assert.deepEqual(await failure(json({ ok: false, error: "slot_full" })), { code: "slot_unavailable", retryable: false });
  assert.deepEqual(await failure(json({ ok: false, error: "no_zone" })), { code: "slot_unavailable", retryable: false });
  assert.deepEqual(await failure(json({ ok: false, error: "invalid" })), { code: "invalid_request", retryable: false });
});

test("ops gateway: an Ops outage is retryable and never a success (502/504 in the route)", async () => {
  assert.deepEqual(await failure(json({ message: "boom" }, 500)), { code: "booking_unavailable", retryable: true });
  assert.deepEqual(await failure(json({ message: "boom" }, 500), "quote"), { code: "quote_unavailable", retryable: true });
  assert.deepEqual(await failure(new Response("<html>", { status: 200 })), { code: "booking_unavailable", retryable: true });
  assert.deepEqual(await failure(json({ ok: true, reference: "not-a-reference" })), { code: "booking_unavailable", retryable: true });
  assert.deepEqual(await failure(json({ ok: false, error: "something_new" })), { code: "booking_unavailable", retryable: true });
  const timeout = () => { throw Object.assign(new Error("timed out"), { name: "TimeoutError" }); };
  assert.deepEqual(await failure(timeout), { code: "request_timeout", retryable: true });
  assert.deepEqual(await failure(() => { throw new TypeError("fetch failed"); }), { code: "booking_unavailable", retryable: true });
});

test("ops gateway: the customer sees a code and request id, never Ops' own message", async () => {
  const error = new IntegrationError("booking_unavailable", true, `Ops returned HTTP 500 with ${SECRET}`);
  const safe = toSafeIntegrationError(error, "req-9", "booking_unavailable");
  assert.deepEqual(safe, { ok: false, error: { code: "booking_unavailable", requestId: "req-9", retryable: true } });
  assert.doesNotMatch(JSON.stringify(safe), /Ops returned|sb_secret/);
});
