/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");
const test = require("node:test");

const L = require("../.foundation-test-build/customer/loyalty.js");
const X = require("../.foundation-test-build/customer/extras.js");

const on = { ...L.DEFAULT_LOYALTY, enabled: true };

test("tiers follow the order count in the window (defaults: 1 / 4 / 8 / 16)", () => {
  const at = (recent, total = recent) => L.loyaltyStatus(on, { recent, total });
  assert.equal(at(0).tierIndex, -1, "no recent order: no tier yet");
  assert.equal(at(0).next.name, "Member");
  assert.equal(at(0).toNext, 1);
  assert.equal(at(1).tier.name, "Member");
  assert.equal(at(3).tier.name, "Member");
  assert.equal(at(3).toNext, 1, "one more to Silver");
  assert.equal(at(4).tier.name, "Silver");
  assert.equal(at(8).tier.name, "Gold");
  assert.equal(at(16).tier.name, "Platinum");
  assert.equal(at(40).next, null, "top tier");
  assert.equal(at(40).progress, 1);
  const mid = at(6);
  assert.equal(mid.tier.name, "Silver");
  assert.equal(mid.toNext, 2);
  assert.ok(Math.abs(mid.progress - 0.5) < 1e-9, "halfway from 4 to 8");
});

test("the milestone only shows once a reward is written, and counts lifetime orders", () => {
  assert.equal(L.loyaltyStatus(on, { recent: 3, total: 7 }).milestone, null, "no reward text: nothing promised");
  const withReward = { ...on, milestone: { every: 5, reward: "Free ironing of 5 shirts", rewardBn: "" } };
  assert.deepEqual(L.loyaltyStatus(withReward, { recent: 3, total: 7 }).milestone, { every: 5, done: 2, toNext: 3, reached: 1 });
  assert.deepEqual(L.loyaltyStatus(withReward, { recent: 1, total: 4 }).milestone, { every: 5, done: 4, toNext: 1, reached: 0 });
  assert.equal(L.loyaltyStatus({ ...withReward, milestone: { ...withReward.milestone, every: 0 } }, { recent: 1, total: 4 }).milestone, null, "every 0 = off");
});

test("stored settings are cleaned; a broken ladder falls back to the defaults", () => {
  assert.deepEqual(L.parseLoyalty(null), L.DEFAULT_LOYALTY);
  const s = L.parseLoyalty({ enabled: true, windowMonths: 99, tiers: [{ name: "A", min: 7 }, { name: "B", min: 5 }, { name: "C", min: 3 }], milestone: { every: "x" } });
  assert.equal(s.enabled, true);
  assert.equal(s.windowMonths, 12, "out of range → default");
  assert.deepEqual(s.tiers, L.DEFAULT_LOYALTY.tiers, "C needs fewer orders than B → defaults");
  const ok = L.parseLoyalty({ tiers: [{ name: " Blue ", min: 9, perks: "x".repeat(400) }, { name: "Navy", min: 6 }] });
  assert.equal(ok.tiers[0].name, "Blue");
  assert.equal(ok.tiers[0].min, 1, "the first tier always starts at 1 order");
  assert.equal(ok.tiers[0].perks.length, 300);
  assert.equal(ok.tiers[1].min, 6);
});

test("loyaltyProblem explains what the admin must fix", () => {
  assert.equal(L.loyaltyProblem(on), null);
  assert.match(L.loyaltyProblem({ ...on, tiers: on.tiers.slice(0, 1) }), /two tiers/);
  assert.match(L.loyaltyProblem({ ...on, tiers: [on.tiers[0], { ...on.tiers[1], name: "" }] }), /name/);
  assert.match(L.loyaltyProblem({ ...on, tiers: [on.tiers[0], { ...on.tiers[1], min: 1 }] }), /more orders/);
  assert.match(L.loyaltyProblem({ ...on, milestone: { every: 1, reward: "x", rewardBn: "" } }), /discount/);
  assert.equal(L.inLang("Gold", "গোল্ড", "bn"), "গোল্ড");
  assert.equal(L.inLang("Gold", "", "bn"), "Gold", "Bangla falls back to English");
});

test("the account asks about the latest unrated order delivered in the last 14 days", () => {
  const now = new Date("2026-10-10T12:00:00+06:00");
  const o = (n, status, deliveredAt) => ({ orderNumber: n, status, deliveredAt, orderDate: "2026-09-01" });
  const orders = [
    o("VEL-00001", "Delivered", "2026-10-01T10:00:00+06:00"),
    o("VEL-00002", "Delivered", "2026-10-08T10:00:00+06:00"),
    o("VEL-00003", "Picked", null),
    o("VEL-00004", "Delivered", "2026-09-01T10:00:00+06:00"),
  ];
  assert.equal(X.orderToRate(orders, new Set(), now).orderNumber, "VEL-00002", "most recent delivered");
  assert.equal(X.orderToRate(orders, new Set(["VEL-00002"]), now).orderNumber, "VEL-00001", "skip rated");
  assert.equal(X.orderToRate(orders, new Set(["VEL-00002", "VEL-00001"]), now), null, "older than 14 days is not asked");
  assert.deepEqual(X.cleanIssues(["late", "hack", "stain", "late"]), ["stain", "late"]);
  assert.equal(X.happy(4), true);
  assert.equal(X.happy(3), false);
});

test("preferences keep only known values, and become one note line", () => {
  const p = X.parsePreferences({
    care: { shirts: "hanger", starch: "extra", fragrance: "none", separate: "true", note: "  Silk: hand wash  ", hack: 1 },
    addresses: [{ label: "Home", address: " House 1 ", area: "7" }, { address: "" }, { label: "Office", address: "Level 3", area: "19" }, { address: "a" }, { address: "b" }],
  });
  assert.deepEqual(p.care, { shirts: "hanger", fragrance: "none", separate: true, note: "Silk: hand wash" });
  assert.deepEqual(p.addresses, [
    { label: "Home", address: "House 1", area: "7" },
    { label: "Office", address: "Level 3", area: "" },
    { label: "", address: "a", area: "" },
  ]);
  const words = {
    intro: "My usual care:",
    shirts: { hanger: "shirts on hangers", folded: "shirts folded" },
    starch: { none: "no starch", light: "light starch", regular: "regular starch" },
    fragrance: { none: "no fragrance", regular: "regular fragrance" },
    separate: "whites and colours washed separately",
  };
  assert.equal(X.careNote(p.care, words), "My usual care: shirts on hangers; no fragrance; whites and colours washed separately; Silk: hand wash.");
  assert.equal(X.careNote({}, words), "");
  assert.equal(X.careNote({ note: "Fold jeans." }, words), "My usual care: Fold jeans.");
  assert.equal(X.joinNotes("Same as my last order (VEL-00002).", "", "My usual care: no starch."), "Same as my last order (VEL-00002).\nMy usual care: no starch.");
  assert.equal(X.joinNotes(undefined, ""), "");
});
