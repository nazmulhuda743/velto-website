/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");
const test = require("node:test");

const { appendAttribution, readAttribution } = require("../.foundation-test-build/attribution.js");

test("captures approved attribution and preserves it through booking navigation", () => {
  const attribution = readAttribution(
    new URLSearchParams(
      "source=paid_social&medium=cpc&campaign=autumn&content=video-a&ad=retargeting&utm_source=facebook&utm_medium=paid&utm_campaign=autumn&utm_content=creative-a&utm_term=laundry&fbclid=click-123&fbc=fbc-123&fbp=fbp-123&service=dry-cleaning",
    ),
    "/services/dry-cleaning",
  );

  assert.equal(attribution.utm_source, "facebook");
  assert.equal(attribution.landing_page, "/services/dry-cleaning");
  const href = appendAttribution("/book?source=service_cta", attribution);
  const persisted = new URL(href, "https://velto.local");
  assert.equal(persisted.searchParams.get("source"), "service_cta");
  assert.equal(persisted.searchParams.get("utm_campaign"), "autumn");
  assert.equal(persisted.searchParams.get("fbclid"), "click-123");
});

test("missing attribution returns an empty object", () => {
  assert.deepEqual(readAttribution(new URLSearchParams()), {});
});

test("rejects unsafe values, external navigation and unsafe landing pages", () => {
  const attribution = readAttribution(
    new URLSearchParams("utm_source=paid%0Aforged&landing_page=//evil.example"),
  );
  assert.deepEqual(attribution, {});
  assert.equal(
    appendAttribution("https://evil.example/book", { utm_source: "facebook" }),
    "https://evil.example/book",
  );
});
