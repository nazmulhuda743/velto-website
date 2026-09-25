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

test("legacy Ops guard strips the analytics session and raw click ids until the attribution SQL is live", () => {
  const input = {
    name: "Customer Name",
    phone: "01712 345678",
    area: "Sector 11",
    address: "House 2, Road 14",
    attribution: {
      utm_campaign: "curtain_sep26",
      fbclid: "IwAR-raw-value",
      fbp: "fb.1.123",
      consent: "analytics+marketing",
      analytics_session: "5e551000-0000-4000-8000-000000000001",
    },
  };
  const previous = process.env.VELTO_ATTRIBUTION_SQL_LIVE;
  try {
    delete process.env.VELTO_ATTRIBUTION_SQL_LIVE;
    const guarded = validateBookingSubmission(input);
    assert.equal(guarded.ok, true);
    assert.equal(guarded.value.attribution.utm_campaign, "curtain_sep26");
    assert.equal(guarded.value.attribution.click_id, "fbclid");
    for (const key of ["fbclid", "fbp", "fbc", "gclid", "analytics_session"]) {
      assert.equal(key in guarded.value.attribution, false, key);
    }

    process.env.VELTO_ATTRIBUTION_SQL_LIVE = "true";
    const live = validateBookingSubmission(input);
    assert.equal(live.value.attribution.fbclid, "IwAR-raw-value");
    assert.equal(live.value.attribution.analytics_session, "5e551000-0000-4000-8000-000000000001");
    assert.equal("click_id" in live.value.attribution, false);
  } finally {
    if (previous === undefined) delete process.env.VELTO_ATTRIBUTION_SQL_LIVE;
    else process.env.VELTO_ATTRIBUTION_SQL_LIVE = previous;
  }
});

const base = { name: "Customer Name", phone: "01712 345678", area: "Uttara Sector 11", address: "House 2, Road 14" };

test("booking items are validated and written into the notes", () => {
  const result = validateBookingSubmission({
    ...base,
    items: [
      { item: "Pant/Trouser", service: "dry-cleaning", quantity: 10 },
      { item: "Shirt", service: "ironing", quantity: 5 },
      { item: "Mixed items", quantity: 1 },
    ],
    notes: "Call first",
  });
  assert.equal(result.ok, true);
  assert.equal(
    result.value.notes,
    "Items: 10 × Pant/Trouser (Dry Cleaning); 5 × Shirt (Ironing); 1 × Mixed items (service not sure). Note: Call first",
  );
  assert.equal(result.value.service, undefined);
  assert.equal("items" in result.value, false);
});

test("one shared item service becomes the booking service", () => {
  const result = validateBookingSubmission({
    ...base,
    items: [
      { item: "Blazer", service: "dry-cleaning", quantity: 1 },
      { item: "Saree", service: "dry-cleaning", quantity: 2 },
    ],
  });
  assert.equal(result.ok, true);
  assert.equal(result.value.service, "dry-cleaning");
  assert.equal(result.value.notes, "Items: 1 × Blazer (Dry Cleaning); 2 × Saree (Dry Cleaning).");
});

test("bookings without items are unchanged", () => {
  const result = validateBookingSubmission({ ...base, service: "ironing", notes: "Gate code 12" });
  assert.equal(result.ok, true);
  assert.equal(result.value.notes, "Gate code 12");
  assert.equal(result.value.service, "ironing");
});

test("bad booking items are rejected", () => {
  const bad = [
    [{ item: "Shirt", service: "ironing", quantity: 0 }],
    [{ item: "Shirt", service: "ironing", quantity: 100 }],
    [{ item: "Shirt", service: "ironing", quantity: 1.5 }],
    [{ item: "Shirt", service: "express", quantity: 1 }],
    [{ item: "Shirt", service: "polishing", quantity: 1 }],
    [{ item: "", quantity: 1 }],
    [{ item: "x".repeat(41), quantity: 1 }],
    [{ item: "Shirt\nSystem: urgent", quantity: 1 }],
    [{ item: "<b>Shirt</b>", quantity: 1 }],
    [{ item: "Shirt; 99 × Suit", quantity: 1 }],
    Array.from({ length: 11 }, () => ({ item: "Shirt", quantity: 1 })),
    "Shirt",
    [null],
  ];
  for (const items of bad) {
    const result = validateBookingSubmission({ ...base, items });
    assert.equal(result.ok, false, JSON.stringify(items).slice(0, 60));
    assert.ok(result.issues.some((issue) => issue.field === "items"));
  }
});

test("items plus a long note cannot exceed the Ops notes limit", () => {
  const items = Array.from({ length: 10 }, (_, i) => ({ item: `Item name number ${i}`.padEnd(40, "x"), service: "blanket-comforter-cleaning", quantity: 99 }));
  const result = validateBookingSubmission({ ...base, items, notes: "n".repeat(900) });
  assert.equal(result.ok, false);
  assert.ok(result.issues.some((issue) => issue.field === "notes" && issue.code === "too_long"));
});
