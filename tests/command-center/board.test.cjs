/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");
const test = require("node:test");

const b = require("../../.command-center-test-build/lib/admin/board-logic.js");
const p = require("../../.command-center-test-build/lib/admin/permissions.js");

test("everyone on the team has the board; only owners and managers archive", () => {
  for (const r of p.ROLES) assert.ok(p.can(r, "board"), r);
  assert.ok(p.canArchiveTasks("owner") && p.canArchiveTasks("manager"));
  for (const r of ["marketing", "designer", "support", null]) assert.equal(p.canArchiveTasks(r), false, String(r));
});

test("a dropped card lands between its neighbours", () => {
  assert.equal(b.positionBetween(1024, 2048), 1536);
  assert.equal(b.positionBetween(null, 1024), 0);
  assert.equal(b.positionBetween(2048, null), 3072);
  assert.equal(b.positionBetween(null, null), 1024);
  // Repeated drops between the same two cards keep strictly ordered positions.
  let lo = 1024, hi = 1025;
  for (let i = 0; i < 30; i++) { const mid = b.positionBetween(lo, hi); assert.ok(mid > lo && mid < hi); hi = mid; }
});

test("labels are tidy, unique and bounded", () => {
  assert.deepEqual(b.parseLabels(" Website, urgent ,, website,  Eid   Hours "), ["website", "urgent", "eid hours"]);
  assert.equal(b.parseLabels("a,b,c,d,e,f,g,h,i,j").length, 8);
  assert.equal(b.parseLabels("x".repeat(40))[0].length, 24);
});

test("due dates flag overdue and today, but never on done cards", () => {
  assert.equal(b.dueState("2026-09-25", "2026-09-26", "todo"), "overdue");
  assert.equal(b.dueState("2026-09-26", "2026-09-26", "doing"), "today");
  assert.equal(b.dueState("2026-09-28", "2026-09-26", "todo"), "soon");
  assert.equal(b.dueState("2026-10-10", "2026-09-26", "todo"), "later");
  assert.equal(b.dueState("2026-09-01", "2026-09-26", "done"), null);
  assert.equal(b.dueState(null, "2026-09-26", "todo"), null);
});

test("cards sort by position, checklist counts and initials read well", () => {
  const t = (id, position, created_at) => ({ id, position, created_at });
  assert.deepEqual(b.sortTasks([t("b", 2, "x"), t("a", 1, "y"), t("c", 2, "a")]).map((x) => x.id), ["a", "c", "b"]);
  assert.deepEqual(b.checklistProgress([{ text: "a", done: true }, { text: "b", done: false }]), { done: 1, total: 2 });
  assert.equal(b.initials("Nazmul Huda"), "NH");
  assert.equal(b.initials("Dina"), "D");
  assert.equal(b.initials(null), "?");
  assert.ok(b.isStatus("review") && !b.isStatus("backlog"));
  assert.ok(b.isPriority("urgent") && !b.isPriority("asap"));
});
