/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");
const test = require("node:test");

const {
  IntegrationError,
  integrationLogContext,
  toSafeIntegrationError,
} = require("../.foundation-test-build/integrations/errors.js");

test("safe errors never expose raw upstream messages or secrets", () => {
  const raw = new Error("postgres failed with sb_secret_do_not_leak");
  const safe = toSafeIntegrationError(raw, "request_01J8P5FJGX2T4M8R", "booking_unavailable");
  assert.deepEqual(safe, {
    ok: false,
    error: {
      code: "booking_unavailable",
      requestId: "request_01J8P5FJGX2T4M8R",
      retryable: true,
    },
  });
  assert.equal(JSON.stringify(safe).includes("sb_secret"), false);
  assert.equal(JSON.stringify(integrationLogContext(raw, "booking", "request-id")).includes("sb_secret"), false);
});

test("known safe errors preserve only controlled code and retryability", () => {
  const error = new IntegrationError("duplicate_submission", false, "private detail");
  const safe = toSafeIntegrationError(error, "request-id", "quote_unavailable");
  assert.equal(safe.error.code, "duplicate_submission");
  assert.equal(safe.error.retryable, false);
  assert.equal("message" in safe.error, false);
});
