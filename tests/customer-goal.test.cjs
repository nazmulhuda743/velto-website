/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");
const test = require("node:test");

const G = require("../.foundation-test-build/customer/goal.js");

const on = { ...G.DEFAULT_GOAL, enabled: true };

test("the default ladder is ascending and complete", () => {
  assert.equal(G.goalProblem(on), null);
  assert.deepEqual(
    on.rungs.map((r) => r.spend),
    [800, 1500, 2500],
  );
});

test("goalStatus finds the rung reached, the next one and the progress between them", () => {
  let s = G.goalStatus(on, 0);
  assert.equal(s.reached, null);
  assert.equal(s.next.spend, 800);
  assert.equal(s.toNext, 800);
  assert.equal(s.progress, 0);
  s = G.goalStatus(on, 400);
  assert.equal(s.toNext, 400);
  assert.equal(s.progress, 0.5);
  s = G.goalStatus(on, 800);
  assert.equal(s.reached.kind, "delivery");
  assert.equal(s.next.spend, 1500);
  assert.equal(s.toNext, 700);
  assert.equal(s.progress, 0, "progress restarts from the rung just reached");
  s = G.goalStatus(on, 2150);
  assert.equal(s.reached.amount, 200);
  assert.equal(s.toNext, 350);
  s = G.goalStatus(on, 9000);
  assert.equal(s.reached.amount, 400);
  assert.equal(s.next, null);
  assert.equal(s.toNext, 0);
  assert.equal(s.progress, 1);
});

test("parseGoal keeps a sane ladder and falls back to the defaults as a whole", () => {
  const custom = G.parseGoal({ enabled: true, doubleFirst: false, rungs: [{ spend: 500, kind: "taka", amount: 50, label: "৳50 off", labelBn: "" }] });
  assert.equal(custom.enabled, true);
  assert.equal(custom.doubleFirst, false);
  assert.equal(custom.rungs.length, 1);
  assert.equal(custom.rungs[0].amount, 50);
  const broken = G.parseGoal({ rungs: [{ spend: 1500, kind: "taka", amount: 200, label: "x" }, { spend: 800, kind: "delivery", label: "y" }] });
  assert.deepEqual(broken.rungs, G.DEFAULT_GOAL.rungs, "descending rungs → defaults");
  assert.equal(broken.enabled, false);
  assert.equal(G.parseGoal(null).doubleFirst, true);
  assert.equal(G.parseGoal({ rungs: "nope" }).rungs.length, 3);
});

test("goalProblem explains what is wrong with a ladder", () => {
  const rung = (over) => ({ spend: 800, kind: "delivery", amount: 0, label: "Free delivery", labelBn: "", ...over });
  assert.match(G.goalProblem({ enabled: true, doubleFirst: true, rungs: [] }), /at least one/);
  assert.match(G.goalProblem({ enabled: true, doubleFirst: true, rungs: [rung({ spend: 50 })] }), /at least ৳100/);
  assert.match(G.goalProblem({ enabled: true, doubleFirst: true, rungs: [rung(), rung({ spend: 800 })] }), /more spend/);
  assert.match(G.goalProblem({ enabled: true, doubleFirst: true, rungs: [rung({ kind: "taka", amount: 0 })] }), /amount off needs/);
  assert.match(G.goalProblem({ enabled: true, doubleFirst: true, rungs: [rung({ kind: "taka", amount: 900 })] }), /can't be as much/);
  assert.match(G.goalProblem({ enabled: true, doubleFirst: true, rungs: [rung({ label: "" })] }), /written out/);
  assert.equal(G.goalProblem({ enabled: true, doubleFirst: true, rungs: [rung(), rung({ spend: 1500, kind: "taka", amount: 200, label: "৳200 off" })] }), null);
});

test("month helpers work across year ends and count days left", () => {
  assert.equal(G.shiftMonth("2026-01", -1), "2025-12");
  assert.equal(G.shiftMonth("2026-12", 1), "2027-01");
  assert.equal(G.monthName("2026-09"), "September");
  assert.equal(G.monthName("2026-09", "bn"), "সেপ্টেম্বর");
  assert.deepEqual(G.daysLeft("2026-09-27"), { inMonth: 30, left: 4 });
  assert.deepEqual(G.daysLeft("2026-02-28"), { inMonth: 28, left: 1 });
  assert.deepEqual(G.daysLeft("2028-02-01"), { inMonth: 29, left: 29 });
});

test("coupons are parsed strictly, the usable one is open and inside its dates, and the Ops line is plain English", () => {
  const raw = [
    { id: "a", code: "VG-AB12CD", kind: "taka", amount: 200, label: "৳200 off", labelBn: "", month: "2026-08", validFrom: "2026-09-01", validTo: "2026-09-30", status: "open" },
    { id: "b", code: "bad", kind: "taka", amount: 1 },
    { id: "c", code: "VG-ZZ99ZZ", kind: "delivery", amount: 0, label: "Free delivery", labelBn: "", month: "2026-07", validFrom: "2026-08-01", validTo: "2026-08-31", status: "open" },
  ];
  const coupons = G.parseCoupons(raw);
  assert.equal(coupons.length, 2);
  assert.equal(G.usableCoupon(coupons, "2026-09-15").code, "VG-AB12CD");
  assert.equal(G.usableCoupon(coupons, "2026-10-01"), null, "nothing valid in October");
  assert.equal(G.usableCoupon(coupons, "2026-08-10").code, "VG-ZZ99ZZ");
  assert.equal(G.couponNote(coupons[0]), "Coupon VG-AB12CD: ৳200 off (valid to 2026-09-30)");
  assert.equal(G.couponNote(coupons[1]), "Coupon VG-ZZ99ZZ: free pickup & delivery this month (valid to 2026-08-31)");
  assert.equal(G.parseCoupons("x").length, 0);
});
