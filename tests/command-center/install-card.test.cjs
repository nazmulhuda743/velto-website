/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");
const test = require("node:test");

const { installCardState, isIOSDevice, parseDismissedAt, INSTALL_DISMISS_MS } = require("../../.command-center-test-build/lib/pwa/install-card.js");

const now = 1_800_000_000_000;
const base = { standalone: false, isIOS: false, hasPrompt: false, dismissedAt: null, now };

test("the install popup: one-tap on Android, steps on iPhone, nothing elsewhere", () => {
  assert.equal(installCardState({ ...base, hasPrompt: true }), "android");
  assert.equal(installCardState({ ...base, isIOS: true }), "ios");
  assert.equal(installCardState({ ...base, isIOS: true, hasPrompt: true }), "android", "a prompt wins when a browser offers one");
  assert.equal(installCardState(base), "hidden", "desktop or a browser without a prompt");
});

test("hidden inside the installed app and for 14 days after Not now", () => {
  assert.equal(INSTALL_DISMISS_MS, 14 * 86_400_000);
  assert.equal(installCardState({ ...base, hasPrompt: true, standalone: true }), "hidden");
  assert.equal(installCardState({ ...base, hasPrompt: true, dismissedAt: now - INSTALL_DISMISS_MS + 1000 }), "hidden");
  assert.equal(installCardState({ ...base, hasPrompt: true, dismissedAt: now - INSTALL_DISMISS_MS - 1000 }), "android", "back after 14 days");
  assert.equal(installCardState({ ...base, isIOS: true, dismissedAt: now - 1000 }), "hidden");
});

test("iPhone, iPad (Safari reports a Mac with touch) and the stored dismissal", () => {
  assert.equal(isIOSDevice("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)", 5), true);
  assert.equal(isIOSDevice("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", 5), true);
  assert.equal(isIOSDevice("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", 0), false);
  assert.equal(isIOSDevice("Mozilla/5.0 (Linux; Android 14)", 5), false);
  assert.equal(parseDismissedAt("1800000000000"), 1800000000000);
  assert.equal(parseDismissedAt("x"), null);
  assert.equal(parseDismissedAt(null), null);
});
