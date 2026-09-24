/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");
const test = require("node:test");

const {
  validateBookingSubmission,
  validateQuoteSubmission,
  validateSubmissionContext,
} = require("../.foundation-test-build/integrations/ops/validation.js");

test("validates and sanitizes a booking while retaining attribution", () => {
  const result = validateBookingSubmission({
    name: "  Nazmul Huda  ",
    phone: "+880 1712-345678",
    area: "Sector 11",
    address: "House 2, Road 14",
    preferredPickup: "Tomorrow afternoon",
    service: "dry-cleaning",
    notes: "Please call first",
    attribution: { utm_source: "facebook", landing_page: "/services/dry-cleaning" },
    unexpectedInternalField: "discarded",
  });
  assert.equal(result.ok, true);
  assert.equal(result.value.name, "Nazmul Huda");
  assert.equal(result.value.attribution.utm_source, "facebook");
  assert.equal("unexpectedInternalField" in result.value, false);
});

test("rejects malformed booking payloads safely", () => {
  const result = validateBookingSubmission({ name: "A", phone: "javascript:bad" });
  assert.equal(result.ok, false);
  assert.ok(result.issues.some((issue) => issue.field === "phone"));
  assert.ok(result.issues.some((issue) => issue.field === "address"));
});

test("supports provisional household enquiries without requiring an exact price", () => {
  const result = validateQuoteSubmission({
    name: "Customer Name",
    phone: "01712 345678",
    area: "Sector 18",
    service: "carpet-cleaning",
    approximateDetails: "Approximately 8 by 10 feet; material unknown",
    photoReferences: [],
    attribution: { campaign: "household", fbclid: "click-123" },
  });
  assert.equal(result.ok, true);
  assert.equal("price" in result.value, false);
});

test("rejects non-household quote services and unsafe photo references", () => {
  const result = validateQuoteSubmission({
    name: "Customer Name",
    phone: "01712 345678",
    area: "Sector 18",
    service: "dry-cleaning",
    photoReferences: ["https://evil.example/file"],
  });
  assert.equal(result.ok, false);
  assert.ok(result.issues.some((issue) => issue.field === "service"));
  assert.ok(result.issues.some((issue) => issue.field === "photoReferences"));
});

test("requires opaque idempotency and request tokens outside customer data", () => {
  assert.equal(
    validateSubmissionContext({
      idempotencyKey: "booking_01J8P5FJGX2T4M8R",
      requestId: "request_01J8P5FJGX2T4M8R",
    }).ok,
    true,
  );
  assert.equal(validateSubmissionContext({ idempotencyKey: "short" }).ok, false);
});
