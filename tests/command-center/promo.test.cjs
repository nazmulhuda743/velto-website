/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");
const test = require("node:test");

const promo = require("../../.command-center-test-build/lib/promo.js");

const complete = {
  ...promo.EMPTY_POPUP,
  enabled: true,
  version: "v1",
  title: "10% off your first order",
  body: "Sign up and book on the website.",
  href: "/signup?source=promo_popup",
};

test("parsePopup accepts only safe values and falls back per field", () => {
  const p = promo.parsePopup({
    enabled: true,
    image: "javascript:alert(1)",
    href: "//evil.example",
    frequency: "hourly",
    delaySeconds: 999,
    startsOn: "12/10/2026",
    title: "x".repeat(500),
  });
  assert.equal(p.enabled, true);
  assert.equal(p.image, "", "non-https poster is dropped");
  assert.equal(p.href, "", "protocol-relative link is dropped");
  assert.equal(p.frequency, "day");
  assert.equal(p.delaySeconds, 3);
  assert.equal(p.startsOn, "");
  assert.equal(p.title.length, 120);
  assert.deepEqual(promo.parsePopup(null), promo.EMPTY_POPUP);
  assert.deepEqual(promo.parsePopup("nope"), promo.EMPTY_POPUP);
});

test("links may be a page on this site or a full https address", () => {
  for (const ok of ["", "/signup", "/book?source=promo_popup", "https://wa.me/8801605162788"]) assert.ok(promo.promoHrefOk(ok), ok);
  for (const bad of ["//x.example", "javascript:alert(1)", "http://insecure.example", "signup", "/a b"]) assert.ok(!promo.promoHrefOk(bad), bad);
});

test("a popup needs something to show, a link and alt text for a poster-only popup", () => {
  assert.equal(promo.popupProblem(complete), null);
  assert.match(promo.popupProblem({ ...complete, title: "", image: "" }), /poster image or a headline/);
  assert.match(promo.popupProblem({ ...complete, href: "" }), /link/);
  assert.match(promo.popupProblem({ ...complete, title: "", image: "https://x.supabase.co/storage/v1/object/public/website-media/promo/a.png", imageAlt: "" }), /alt text/);
  assert.equal(promo.popupProblem({ ...complete, title: "", image: "https://x.supabase.co/p.png", imageAlt: "10% off poster" }), null);
  assert.match(promo.popupProblem({ ...complete, startsOn: "2026-10-20", endsOn: "2026-10-01" }), /end date/);
});

test("the campaign window is in Dhaka time, inclusive of both dates", () => {
  const p = { ...complete, startsOn: "2026-10-01", endsOn: "2026-10-07" };
  const t = (iso) => Date.parse(iso);
  assert.equal(promo.popupActive(p, t("2026-09-30T23:59:00+06:00")), false, "the evening before");
  assert.equal(promo.popupActive(p, t("2026-10-01T00:00:00+06:00")), true, "Dhaka midnight start");
  assert.equal(promo.popupActive(p, t("2026-10-07T23:59:00+06:00")), true, "last minute of the end date");
  assert.equal(promo.popupActive(p, t("2026-10-08T00:00:01+06:00")), false, "after the end date");
  assert.equal(promo.popupActive({ ...p, enabled: false }, t("2026-10-03T12:00:00+06:00")), false, "switched off");
  assert.equal(promo.popupActive({ ...p, href: "" }, t("2026-10-03T12:00:00+06:00")), false, "incomplete never goes live");
  assert.equal(promo.popupSchedule(p, t("2026-09-30T12:00:00+06:00")), "scheduled");
  assert.equal(promo.popupSchedule(p, t("2026-10-03T12:00:00+06:00")), "live");
  assert.equal(promo.popupSchedule(p, t("2026-10-09T12:00:00+06:00")), "ended");
  assert.equal(promo.popupSchedule(complete), "always");
});

test("popupDue respects the frequency and always shows a new campaign", () => {
  const now = Date.parse("2026-10-03T12:00:00+06:00");
  const hours = (h) => h * 3_600_000;
  const p = { version: "v2", frequency: "day" };
  assert.equal(promo.popupDue(p, null, now), true, "never seen");
  assert.equal(promo.popupDue(p, { version: "v1", at: now - hours(1) }, now), true, "older campaign closed → new one shows");
  assert.equal(promo.popupDue(p, { version: "v2", at: now - hours(5) }, now), false, "closed 5 hours ago");
  assert.equal(promo.popupDue(p, { version: "v2", at: now - hours(25) }, now), true, "closed yesterday");
  assert.equal(promo.popupDue({ ...p, frequency: "week" }, { version: "v2", at: now - hours(25) }, now), false);
  assert.equal(promo.popupDue({ ...p, frequency: "week" }, { version: "v2", at: now - hours(24 * 8) }, now), true);
  assert.equal(promo.popupDue({ ...p, frequency: "once" }, { version: "v2", at: now - hours(24 * 400) }, now), false);
  assert.equal(promo.popupDue({ ...p, frequency: "session" }, { version: "v2", at: now - hours(24 * 400) }, now), false, "tab storage record = shown this visit");
});

test("the popup never opens on booking, sign-in, account, tracking or legal pages", () => {
  for (const path of ["/book", "/bn/book", "/quote", "/track", "/account", "/account/orders/VEL-1", "/login", "/signup", "/auth/confirm", "/offline", "/cookies", "/privacy", "/terms", "/admin/promo"]) {
    assert.equal(promo.popupExcluded(path), true, path);
  }
  for (const path of ["/", "/bn", "/pricing", "/services/dry-cleaning", "/bn/locations", "/bookmarks", "/about"]) {
    assert.equal(promo.popupExcluded(path), false, path);
  }
});

test("the bar opens its own link, else the booking page when it carries an offer, else nothing", () => {
  assert.equal(promo.barLink({ href: "/signup", bookingNote: "10% off" }), "/signup");
  assert.equal(promo.barLink({ href: "", bookingNote: "10% off your first order" }), "/book?source=promo_bar");
  assert.equal(promo.barLink({ href: "", bookingNote: "  " }), "");
});

test("bar messages split on | and the ticker speed follows the text length", () => {
  assert.deepEqual(promo.barMessages(" 10% off first order | Free pickup on ৳499+ ||"), ["10% off first order", "Free pickup on ৳499+"]);
  assert.deepEqual(promo.barMessages(""), []);
  assert.equal(promo.barMessages("a|b|c|d|e|f|g|h").length, 6, "capped");
  const short = ["Sale"];
  const long = ["Book your first order on the website, sign up and get 10% off your entire order", "Free pickup & delivery on ৳499+", "Every item tagged and checked"];
  assert.ok(promo.tickerCopies(short) > promo.tickerCopies(long), "short messages repeat more often to fill the screen");
  assert.ok(promo.tickerCopies(short) <= 12 && promo.tickerCopies(long) >= 2);
  const s1 = promo.tickerSeconds(short, promo.tickerCopies(short));
  const s2 = promo.tickerSeconds(long, promo.tickerCopies(long));
  assert.ok(s1 >= 18 && s1 <= 90 && s2 >= 18 && s2 <= 90);
  assert.ok(s2 > s1, "more text takes longer to pass");
});

test("the version changes with any visible field and nothing else", () => {
  const base = promo.popupFingerprint(complete);
  assert.equal(promo.popupFingerprint({ ...complete, enabled: false, frequency: "week", delaySeconds: 9, startsOn: "2026-10-01" }), base, "settings don't restart the campaign");
  for (const change of [{ title: "New" }, { body: "x" }, { href: "/book" }, { image: "https://x.supabase.co/p.png" }, { cta: "Go" }, { tagBn: "অফার" }]) {
    assert.notEqual(promo.popupFingerprint({ ...complete, ...change }), base, JSON.stringify(change));
  }
});

test("offer parts, ticks and the account offer template", () => {
  assert.deepEqual(promo.offerParts("10% OFF"), { big: "10%", small: "OFF" });
  assert.deepEqual(promo.offerParts("১০% ছাড়"), { big: "১০%", small: "ছাড়" });
  assert.deepEqual(promo.offerParts("  "), { big: "", small: "" });
  assert.deepEqual(promo.popupPoints("a | b | c | d"), ["a", "b", "c"]);
  const t = { ...promo.EMPTY_POPUP, ...promo.ACCOUNT_OFFER_TEMPLATE };
  assert.equal(promo.popupProblem(t), null);
  assert.equal(promo.promoHrefOk(t.href), true);
  assert.equal(promo.popupExcluded("/book"), true, "never over the booking page it links to");
  assert.ok(promo.popupPoints(t.points).length === 3 && promo.popupPoints(t.pointsBn).length === 3);
  // Saving never trims the template's words.
  const saved = promo.parsePopup(t);
  for (const k of ["tag", "tagBn", "offer", "offerBn", "cta", "ctaBn", "fine", "fineBn"]) assert.equal(saved[k], t[k], k);
});

test("new popup fields parse safely and old campaigns keep their version", () => {
  const p = promo.parsePopup({ offer: "x".repeat(50), points: 5, proof: "yes", fine: "Small print" });
  assert.equal(p.offer.length, 24);
  assert.equal(p.points, "");
  assert.equal(p.proof, false);
  assert.equal(p.fine, "Small print");
  const old = { ...complete };
  assert.equal(promo.popupFingerprint(old), promo.popupFingerprint({ ...old, proof: true }), "unset new fields don't change the version");
  assert.notEqual(promo.popupFingerprint(old), promo.popupFingerprint({ ...old, offer: "10% OFF" }));
});

test("pictures: uploads or the site's own photos, poster by default", () => {
  assert.equal(promo.promoImageOk("/images/pages/finished-shirts-rail.webp"), true);
  assert.equal(promo.promoImageOk("/images/../secret.webp"), false);
  assert.equal(promo.promoImageOk("/admin/x.png"), false);
  assert.equal(promo.parsePopup({ image: "/images/home/hero.webp", imageStyle: "photo" }).imageStyle, "photo");
  assert.equal(promo.parsePopup({ imageStyle: "banner" }).imageStyle, "poster");
  const t = { ...promo.EMPTY_POPUP, ...promo.ACCOUNT_OFFER_TEMPLATE };
  assert.equal(promo.popupProblem(t), null);
  assert.equal(promo.offerParts(t.offer).big, "10%");
});
