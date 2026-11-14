/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");
const test = require("node:test");

const {
  googleAdsConfig,
  conversionSendTo,
  DEFAULT_GOOGLE_ADS_ID,
  DEFAULT_WHATSAPP_LABEL,
  DEFAULT_BOOKING_LABEL,
} = require("../.foundation-test-build/google-ads/events.js");

test("defaults: Velto's live conversion actions", () => {
  const c = googleAdsConfig({});
  assert.equal(c.id, "AW-17685935382");
  assert.equal(conversionSendTo(c, "whatsapp_click"), `${DEFAULT_GOOGLE_ADS_ID}/${DEFAULT_WHATSAPP_LABEL}`);
  assert.equal(conversionSendTo(c, "booking_success"), `${DEFAULT_GOOGLE_ADS_ID}/${DEFAULT_BOOKING_LABEL}`);
});

test("only the two lead events are conversions", () => {
  const c = googleAdsConfig({});
  for (const e of ["page_view", "call_click", "quote_success", "app_booking_success", "service_view", "toString", "__proto__"]) {
    assert.equal(conversionSendTo(c, e), null, e);
  }
});

test("env overrides, and off switches", () => {
  const c = googleAdsConfig({ id: "AW-123456789", whatsappLabel: "abcDEF_123", bookingLabel: "off" });
  assert.equal(conversionSendTo(c, "whatsapp_click"), "AW-123456789/abcDEF_123");
  assert.equal(conversionSendTo(c, "booking_success"), null);
  assert.equal(googleAdsConfig({ id: "off" }), null);
  assert.equal(googleAdsConfig({ id: "  " }).id, DEFAULT_GOOGLE_ADS_ID);
});

test("malformed values are rejected, never sent", () => {
  assert.equal(googleAdsConfig({ id: "G-ABC123" }), null);
  assert.equal(googleAdsConfig({ id: "AW-12" }), null);
  const c = googleAdsConfig({ whatsappLabel: "bad label!" });
  assert.equal(conversionSendTo(c, "whatsapp_click"), null);
  assert.equal(conversionSendTo(c, "booking_success"), `${DEFAULT_GOOGLE_ADS_ID}/${DEFAULT_BOOKING_LABEL}`);
});
