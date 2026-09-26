/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");
const test = require("node:test");

const c = require("../../.command-center-test-build/lib/i18n/copy-overrides.js");

const base = {
  nav: { pricing: "Pricing", href: "/pricing" },
  hero: { title: "Clean clothes, {count} items", points: ["Tagged", "Checked"] },
  meta: { title: "SEO title" },
  names: ["Shirt"],
  image: { alt: "x", width: 1, height: 1 },
};

test("only words are offered for editing: not links, data, images or SEO", () => {
  const paths = c.collectStrings(base).map((s) => s.path);
  assert.deepEqual(paths, ["nav.pricing", "hero.title", "hero.points.0", "hero.points.1"]);
  assert.ok(c.isEditablePath(base, "hero.points.1"));
  assert.equal(c.isEditablePath(base, "nav.href"), false);
  assert.equal(c.isEditablePath(base, "names.0"), false);
});

test("overrides apply per language and namespace without touching the original", () => {
  c.setCopyOverrides({ en: { "site.nav.pricing": "Prices", "site.hero.points.1": "Double-checked", "pages.nav.pricing": "ignored here" }, bn: {} });
  const out = c.withOverrides("site", "en", base);
  assert.equal(out.nav.pricing, "Prices");
  assert.equal(out.hero.points[1], "Double-checked");
  assert.equal(out.hero.points[0], "Tagged");
  assert.equal(base.nav.pricing, "Pricing", "built-in copy is never mutated");
  assert.equal(c.withOverrides("site", "bn", base), base, "no Bangla edits → the same object");
  assert.equal(c.withOverrides("site", "en", base), out, "memoised");
  // Unknown paths and non-string targets are ignored.
  c.setCopyOverrides({ en: { "site.nav.missing.deep": "x", "site.hero": "x" } });
  assert.deepEqual(c.withOverrides("site", "en", base).hero, base.hero);
});

test("a display transform (Bangla suffix joiner) is applied to edited text", () => {
  c.setCopyOverrides({ bn: { "site.nav.pricing": "দাম-এর" } });
  const out = c.withOverrides("site", "bn", base, (t) => t.replace("-", "-⁠"));
  assert.equal(out.nav.pricing, "দাম-⁠এর");
  c.setCopyOverrides(null);
});

test("edits must keep the automatic placeholders and stay plain text", () => {
  assert.equal(c.copyProblem("Clean clothes, {count} items", "Fresh clothes, {count} pieces"), null);
  assert.match(c.copyProblem("Clean clothes, {count} items", "Fresh clothes"), /\{count\}/);
  assert.match(c.copyProblem("Plain", "Hi {name}"), /Remove \{name\}/);
  assert.match(c.copyProblem("Plain", "   "), /empty/);
  assert.match(c.copyProblem("Plain", "<script>alert(1)</script>"), /HTML/);
  assert.match(c.copyProblem("Plain", "x".repeat(4001)), /4,000/);
});

test("seeding one language keeps the other's edits (concurrent en/bn renders)", () => {
  c.setCopyOverrides({ en: { "site.nav.pricing": "Prices" }, bn: { "site.nav.pricing": "দাম" } });
  c.setCopyLocale("bn", { "site.nav.pricing": "মূল্য" });
  assert.equal(c.withOverrides("site", "en", base).nav.pricing, "Prices");
  assert.equal(c.withOverrides("site", "bn", base).nav.pricing, "মূল্য");
  c.setCopyOverrides(null);
});
