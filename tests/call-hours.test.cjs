/* eslint-disable @typescript-eslint/no-require-imports */
const test = require("node:test");
const assert = require("node:assert/strict");
const { isNightDhaka, dhakaHour, callAsk } = require("../.foundation-test-build/call-hours.js");

// Dhaka is UTC+6: 03:00Z = 9:00 AM, 14:59Z = 8:59 PM, 15:00Z = 9 PM.
const at = (iso) => Date.parse(iso);

test("night is 9 PM to 9 AM in Dhaka, whatever the device's time zone", () => {
  assert.equal(dhakaHour(at("2026-09-29T03:00:00Z")), 9);
  assert.equal(isNightDhaka(at("2026-09-29T02:59:00Z")), true, "8:59 AM");
  assert.equal(isNightDhaka(at("2026-09-29T03:00:00Z")), false, "9:00 AM");
  assert.equal(isNightDhaka(at("2026-09-29T14:59:00Z")), false, "8:59 PM");
  assert.equal(isNightDhaka(at("2026-09-29T15:00:00Z")), true, "9:00 PM");
  assert.equal(isNightDhaka(at("2026-09-29T18:00:00Z")), true, "midnight");
  assert.equal(isNightDhaka(new Date("2026-09-29T08:00:00Z")), false, "2 PM, as a Date");
});

test("the managers' ask follows the hour", () => {
  assert.equal(callAsk(at("2026-09-29T06:00:00Z")), "Call within 30 min.");
  assert.equal(callAsk(at("2026-09-29T20:00:00Z")), "Night request: call in the morning (from 9 AM).");
});
