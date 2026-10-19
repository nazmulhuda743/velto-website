/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");
const test = require("node:test");

const { ingestionState } = require("../../.command-center-test-build/lib/analytics/ingestion.js");

const NOW = Date.parse("2026-10-19T20:25:00Z");
const iso = (h) => new Date(NOW - h * 3_600_000).toISOString();

test("quiet hours where nobody allowed Analytics are not a fault", () => {
  // 19 Oct: the last visitor to allow Analytics did so 7 h ago, and their events arrived.
  const s = ingestionState({ last_event_at: iso(7.4), last_analytics_consent_at: iso(7.45) }, NOW);
  assert.equal(s.kind, "quiet");
});

test("a visitor allowed Analytics but nothing arrived: stalled", () => {
  const s = ingestionState({ last_event_at: iso(30), last_analytics_consent_at: iso(2) }, NOW);
  assert.equal(s.kind, "stalled");
  assert.equal(s.consentAt, Date.parse(iso(2)));
  assert.equal(ingestionState({ last_event_at: null, last_analytics_consent_at: iso(1) }, NOW).kind, "stalled", "never any event");
});

test("a fresh consent gets a grace period before it counts as stalled", () => {
  assert.equal(ingestionState({ last_event_at: iso(30), last_analytics_consent_at: iso(0.1) }, NOW).kind, "quiet");
});

test("recent events: receiving; nothing at all yet: waiting", () => {
  assert.equal(ingestionState({ last_event_at: iso(1), last_analytics_consent_at: iso(1.01) }, NOW).kind, "receiving");
  assert.equal(ingestionState({ last_event_at: null, last_analytics_consent_at: null }, NOW).kind, "waiting");
});

test("an older database without the consent time keeps the old 6-hour rule", () => {
  assert.equal(ingestionState({ last_event_at: iso(7) }, NOW).kind, "stalled");
  assert.equal(ingestionState({ last_event_at: iso(2) }, NOW).kind, "receiving");
});
