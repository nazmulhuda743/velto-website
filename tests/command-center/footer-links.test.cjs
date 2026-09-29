/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");
const test = require("node:test");

const f = require("../../.command-center-test-build/lib/footer-links.js");

test("unsaved columns stay null so the built-in links show", () => {
  assert.deepEqual(f.parseFooterLinks(undefined), { services: null, help: null });
  assert.deepEqual(f.parseFooterLinks({ help: "nope" }), { services: null, help: null });
});

test("parseFooterLinks keeps only safe links", () => {
  const p = f.parseFooterLinks({
    help: [
      { label: "Pricing", labelBn: "দাম", href: "/pricing" },
      { label: "Bad", href: "javascript:alert(1)" },
      { label: "Protocol-relative", href: "//evil.example" },
      { label: "", href: "/about" },
      { label: "Facebook", href: "https://facebook.com/velto", hidden: true },
    ],
  });
  assert.equal(p.services, null);
  assert.deepEqual(p.help, [
    { label: "Pricing", labelBn: "দাম", href: "/pricing", hidden: false },
    { label: "Facebook", labelBn: "", href: "https://facebook.com/velto", hidden: true },
  ]);
  assert.equal(f.parseFooterLinks({ help: Array.from({ length: 30 }, () => ({ label: "x", href: "/x" })) }).help.length, f.FOOTER_MAX_LINKS);
});

test("labels follow the page language and external links are recognised", () => {
  const l = { label: "Pricing", labelBn: "দাম", href: "/pricing", hidden: false };
  assert.equal(f.footerLabel(l, "bn"), "দাম");
  assert.equal(f.footerLabel({ ...l, labelBn: "" }, "bn"), "Pricing");
  assert.equal(f.footerLabel(l, "en"), "Pricing");
  assert.equal(f.isExternalHref("https://facebook.com"), true);
  assert.equal(f.isExternalHref("/pricing"), false);
  assert.deepEqual(f.visibleFooterLinks([l, { ...l, hidden: true }]), [l]);
});

const form = (fields) => (name) => fields[name] ?? "";

test("footerLinksFromForm orders rows, drops blank ones and reads Show", () => {
  const r = f.footerLinksFromForm(
    form({
      "help.label.0": "About", "help.href.0": "/about", "help.order.0": "3", "help.show.0": "on",
      "help.label.1": "Pricing", "help.href.1": "/pricing", "help.order.1": "1", "help.show.1": "on",
      "help.label.2": "Old", "help.href.2": "/old", "help.order.2": "2",
      "help.order.3": "4", "help.show.3": "on",
    }),
    "help",
    4,
  );
  assert.deepEqual(r.links.map((l) => [l.label, l.hidden]), [["Pricing", false], ["Old", true], ["About", false]]);
});

test("footerLinksFromForm refuses half rows, unsafe links and all-hidden columns", () => {
  assert.match(f.footerLinksFromForm(form({ "help.label.0": "Pricing" }), "help", 1).error, /Row 1/);
  assert.match(f.footerLinksFromForm(form({ "help.label.0": "X", "help.href.0": "javascript:alert(1)", "help.show.0": "on" }), "help", 1).error, /must be a page/);
  assert.match(f.footerLinksFromForm(form({ "help.label.0": "X", "help.href.0": "/x" }), "help", 1).error, /at least one/);
  assert.deepEqual(f.footerLinksFromForm(form({}), "help", 3), { links: [] });
});
