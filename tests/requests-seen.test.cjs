/* eslint-disable @typescript-eslint/no-require-imports */
const test = require("node:test");
const assert = require("node:assert/strict");
const { readSeen, isUnseen, unseenCount, nextSeen } = require("../.foundation-test-build/admin/requests-seen.js");

const NOW = Date.parse("2026-09-30T10:00:00Z");
const at = (iso) => ({ created_at: iso, status: "todo" });

test("the badge counts only open requests that came in after the last visit", () => {
  const seen = Date.parse("2026-09-30T08:00:00Z");
  const rows = [at("2026-09-30T07:00:00Z"), at("2026-09-30T09:00:00Z"), { created_at: "2026-09-30T09:30:00Z", status: "done" }, at("2026-09-30T09:59:00Z")];
  assert.equal(unseenCount(rows, seen, NOW), 2);
  // An older request still being worked on (e.g. Assigned) is not "new".
  assert.equal(isUnseen(at("2026-09-30T07:00:00Z"), seen, NOW), false);
});

test("first visit on a browser: the last day counts as new", () => {
  assert.equal(isUnseen(at("2026-09-30T00:00:00Z"), null, NOW), true);
  assert.equal(isUnseen(at("2026-09-28T00:00:00Z"), null, NOW), false);
});

test("seen moves to the newest request shown, never back, never into the future", () => {
  const a = Date.parse("2026-09-30T09:00:00Z");
  assert.equal(nextSeen(null, a, NOW), a);
  assert.equal(nextSeen(a, a - 1000, NOW), a, "an older page doesn't un-see");
  assert.equal(nextSeen(null, NOW + 3_600_000, NOW), NOW, "clamped to now");
  assert.equal(nextSeen(a, 0, NOW), a);
  assert.equal(nextSeen(a, NaN, NOW), a);
});

test("the seen cookie is read defensively", () => {
  assert.equal(readSeen("1727690000000"), 1727690000000);
  for (const bad of [undefined, null, "", "abc", "-5", "0", "1e20", "12345678901234567890"]) assert.equal(readSeen(bad), null, String(bad));
});
