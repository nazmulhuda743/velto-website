/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");
const test = require("node:test");

const build = "../../.command-center-test-build";
const p = require(`${build}/lib/admin/permissions.js`);
const pages = require(`${build}/lib/admin/image-pages.js`);
const { IMAGE_SLOTS } = require(`${build}/content/mock.js`);
const diff = require(`${build}/lib/admin/price-diff.js`);

const UID = "11111111-1111-4111-8111-111111111111";

test("owners see everything; only owners manage access", () => {
  for (const s of p.SECTIONS) assert.ok(p.can("owner", s), s);
  for (const r of p.ROLES.filter((r) => r !== "owner")) assert.equal(p.can(r, "access"), false, r);
  assert.ok(p.can("manager", "activity"));
});

test("only owners approve price changes; managers and owners may propose them", () => {
  assert.ok(p.can("owner", "approvals"));
  for (const r of p.ROLES.filter((r) => r !== "owner")) assert.equal(p.can(r, "approvals"), false, r);
  assert.ok(p.canProposePrices("owner"));
  assert.ok(p.canProposePrices("manager"));
  for (const r of ["marketing", "designer", "support", null, undefined]) assert.equal(p.canProposePrices(r), false, String(r));
  assert.ok(p.can("support", "prices"), "support can still view prices");
});

test("designers never reach customer data or money", () => {
  for (const s of ["requests", "retention", "accounts", "revenue", "visitors", "funnel", "marketing", "overview", "activity", "access", "prices"]) {
    assert.equal(p.can("designer", s), false, s);
  }
  for (const s of ["images", "seo", "reviews", "settings"]) assert.ok(p.can("designer", s), s);
});

test("support handles customers but not site content or marketing", () => {
  for (const s of ["requests", "retention", "accounts"]) assert.ok(p.can("support", s), s);
  for (const s of ["images", "settings", "seo", "revenue", "marketing"]) assert.equal(p.can("support", s), false, s);
});

test("unknown roles and sections are refused", () => {
  assert.equal(p.can(null, "images"), false);
  assert.equal(p.can("superuser", "images"), false);
  assert.equal(p.can("owner", "nope"), false);
  assert.equal(p.isRole("admin"), false);
});

test("paths map to sections, and everyone lands on a page they may open", () => {
  assert.equal(p.sectionForPath("/admin"), "overview");
  assert.equal(p.sectionForPath("/admin/"), "overview");
  assert.equal(p.sectionForPath("/admin/revenue/spend?x=1"), "revenue");
  assert.equal(p.sectionForPath("/admin/seo/edit"), "seo");
  assert.equal(p.sectionForPath("/admin/unknown"), null);
  for (const r of p.ROLES) {
    const home = p.homeFor(r);
    assert.ok(p.can(r, p.sectionForPath(home)), `${r} → ${home}`);
  }
  assert.equal(p.homeFor("designer"), "/admin/images");
  assert.equal(p.homeFor("support"), "/admin/requests");
});

test("Ops admins are always owners; deactivated staff are always refused", () => {
  const admin = { profile: { name: "Nazmul", email: "o@x.com", role: "admin", active: true }, member: null };
  assert.deepEqual(p.resolveAdmin(UID, admin), { id: UID, name: "Nazmul", email: "o@x.com", role: "owner" });
  // A website role can't demote an Ops admin.
  assert.equal(p.resolveAdmin(UID, { ...admin, member: { name: "N", email: "o@x.com", role: "designer", active: true } }).role, "owner");
  // Deactivated in Ops: refused even with an active website role.
  const inactive = { profile: { name: "S", email: "s@x.com", role: "staff", active: false }, member: { name: "S", email: "s@x.com", role: "manager", active: true } };
  assert.equal(p.resolveAdmin(UID, inactive), null);
  // Ops staff without a website role: no dashboard.
  assert.equal(p.resolveAdmin(UID, { profile: { name: "S", email: "s@x.com", role: "staff", active: true }, member: null }), null);
});

test("website members get exactly their role while active", () => {
  const m = (role, active = true) => ({ profile: null, member: { name: "Dina", email: "d@x.com", role, active } });
  assert.equal(p.resolveAdmin(UID, m("designer")).role, "designer");
  assert.equal(p.resolveAdmin(UID, m("designer", false)), null);
  assert.equal(p.resolveAdmin(UID, m("root")), null);
  assert.equal(p.resolveAdmin(UID, null), null);
});

test("temporary passwords must be long and mixed", () => {
  assert.ok(p.passwordProblem("short1"));
  assert.ok(p.passwordProblem("longbutnodigits"));
  assert.ok(p.passwordProblem("123456789012"));
  assert.equal(p.passwordProblem("velto-design-2026"), null);
  assert.ok(p.passwordProblem("a1".repeat(40)));
});

test("every photo slot is listed on the Images page, and every listed slot exists", () => {
  const ids = new Set(IMAGE_SLOTS.map((s) => s.id));
  const listed = new Set([...pages.SITE_PAGES.flatMap((pg) => pg.slots), ...pages.UNUSED_SLOTS]);
  for (const id of ids) assert.ok(listed.has(id), `slot ${id} is on no page`);
  for (const id of listed) assert.ok(ids.has(id), `listed slot ${id} doesn't exist`);
  for (const id of ids) assert.notEqual(pages.slotName(id), id, `slot ${id} has no readable name`);
  assert.deepEqual(pages.pagesForSlot("hero").map((pg) => pg.key), ["home", "how-it-works"]);
});

test("every dashboard page and every admin action checks its section on the server", () => {
  const fs = require("node:fs");
  const path = require("node:path");
  const root = path.join(__dirname, "../../src/app/admin");
  const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]));
  const pagesDir = path.join(root, "(panel)");
  for (const file of walk(pagesDir).filter((f) => f.endsWith("page.tsx"))) {
    const rel = path.relative(pagesDir, file);
    const section = rel === "page.tsx" ? "overview" : rel.split(path.sep)[0];
    assert.match(fs.readFileSync(file, "utf8"), new RegExp(`requireSection\\("${section}"\\)`), `${rel} must call requireSection("${section}")`);
  }
  for (const file of walk(root).filter((f) => /actions\.ts$/.test(f))) {
    const src = fs.readFileSync(file, "utf8");
    for (const m of src.matchAll(/export async function (\w+)\([^)]*\)[^{]*\{([\s\S]*?)\n\}/g)) {
      if (m[1] === "loginAction" || m[1] === "logoutAction") continue;
      assert.match(m[2], /await requireSection\("[a-z]+"\)/, `${path.basename(file)}: ${m[1]} must call requireSection`);
    }
  }
});

test("price diffs show exactly what an approval would change", () => {
  const before = { item_name: "Shirt", category: "Shirts", service_category: "Wash + Iron", price: 60, price_type: "fixed", hanger: "request", item_group: "Men", note: null, is_popular: false };
  const after = { ...before, price: 70, is_popular: true };
  assert.deepEqual(diff.priceDiff(before, after), [
    { field: "price", from: "৳ 60", to: "৳ 70" },
    { field: "is_popular", from: "No", to: "Yes" },
  ]);
  assert.deepEqual(diff.priceDiff(before, { ...before, price: "60.00" }), [], "same amount in another form is no change");
  const added = diff.priceDiff(null, { ...before, price: 1250 });
  assert.equal(added[0].field, "item_name");
  assert.ok(added.some((d) => d.field === "price" && d.to === "৳ 1,250"));
  assert.equal(diff.priceJump(before, { price: 120 }), 100);
  assert.equal(diff.priceJump(before, { price: 54 }), -10);
  assert.equal(diff.priceJump({ price: null }, { price: 10 }), null);
});

test("taka amounts use Bangladeshi grouping and price types", () => {
  assert.equal(diff.taka(1250), "৳ 1,250");
  assert.equal(diff.taka(125000), "৳ 1,25,000");
  assert.equal(diff.taka(1000000), "৳ 10,00,000");
  assert.equal(diff.taka(45.5), "৳ 45.50");
  assert.equal(diff.taka(45, "per_sqft"), "৳ 45 / sq ft");
  assert.equal(diff.taka(null), "On inspection");
  assert.equal(diff.taka(300, "poa"), "On inspection");
});
