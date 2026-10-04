/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");
const test = require("node:test");

const { installCardState, isIOSDevice, isInAppBrowser, parseDismissedAt, APP_MODE_SCRIPT, INSTALL_DISMISS_MS, appSafetyTarget, APP_SAFETY_JS } = require("../../.command-center-test-build/lib/pwa/install-card.js");

const now = 1_800_000_000_000;
const base = { standalone: false, isIOS: false, hasPrompt: false, dismissedAt: null, now };

test("the install popup: one tap on Android, Share on iPhone, nothing elsewhere", () => {
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

test("never offered to someone who already has the app, or where it can't be installed", () => {
  assert.equal(installCardState({ ...base, hasPrompt: true, installed: true }), "hidden", "known installed (this phone or the account)");
  assert.equal(installCardState({ ...base, isIOS: true, installed: true }), "hidden");
  assert.equal(installCardState({ ...base, hasPrompt: true, inApp: true }), "hidden", "Facebook / WhatsApp browser");
  assert.equal(installCardState({ ...base, isIOS: true, inApp: true }), "hidden");
});

test("in-app browsers are recognised, normal browsers are not", () => {
  assert.equal(isInAppBrowser("Mozilla/5.0 (Linux; Android 14; wv) AppleWebKit/537.36 [FBAN/EMA;FBLC/en_US;FBAV/400.0]"), true);
  assert.equal(isInAppBrowser("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Instagram 300.0"), true);
  assert.equal(isInAppBrowser("Mozilla/5.0 (Linux; Android 14; SM-A146B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36"), false);
  assert.equal(isInAppBrowser("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1"), false);
});

const SAFETY_CASES = [
  // The app's own pages stay.
  ["/app", null], ["/app/home", null], ["/app/orders/VEL-01940", null], ["/app/login", null],
  // Account pages map to the app's own (old installs started at /account; push links point there).
  ["/account", "/app/home"], ["/account/", "/app/home"], ["/account/orders", "/app/orders"],
  ["/account/orders/VEL-01940", "/app/orders/VEL-01940"], ["/bn/account/orders/VEL-01940", "/app/orders/VEL-01940"],
  ["/account/profile", "/app/profile"], ["/account/rewards", "/app/rewards"],
  ["/book", "/app/book"], ["/pricing", "/app/prices"], ["/login", "/app/login"], ["/bn/signup", "/app/login"],
  // Any other website page: the app's Home.
  ["/", "/app/home"], ["/bn", "/app/home"], ["/services/dry-cleaning", "/app/home"], ["/about", "/app/home"], ["/track", "/app/home"],
  // Legal text, email sign-in links, rebook and invoice links open as they are.
  ["/terms", null], ["/privacy", null], ["/cookies", null], ["/bn/privacy", null], ["/auth/confirm", null], ["/r/abc", null], ["/i/xyz", null],
];

test("inside the app, website pages go to the app's own pages; app pages and legal links stay", () => {
  for (const [path, want] of SAFETY_CASES) assert.equal(appSafetyTarget(path), want, path);
});

test("the inline script's copy of the safety net agrees with appSafetyTarget", () => {
  const inline = new Function(`return (${APP_SAFETY_JS})`)();
  for (const [path, want] of SAFETY_CASES) assert.equal(inline(path), want, path);
});

test("the inline app-mode script is valid JavaScript", () => {
  assert.doesNotThrow(() => new Function(APP_MODE_SCRIPT));
});
