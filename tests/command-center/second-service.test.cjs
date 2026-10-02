/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");
const test = require("node:test");

const ss = require("../../.command-center-test-build/lib/second-service.js");
const r = require("../../.command-center-test-build/lib/rhythm.js");

const mix = (o) => ({ orders: 1, ironing: false, wash: false, dryCleaning: false, ...o });

test("the next service climbs the ladder", () => {
  assert.equal(ss.nextService(mix({ dryCleaning: true })), "ironing");
  assert.equal(ss.nextService(mix({ ironing: true })), "dry-cleaning");
  assert.equal(ss.nextService(mix({ wash: true })), "dry-cleaning");
  assert.equal(ss.nextService(mix({ ironing: true, dryCleaning: true })), "wash-and-iron");
  assert.equal(ss.nextService(mix({ wash: true, dryCleaning: true })), null);
  assert.equal(ss.nextService(mix({ ironing: true, wash: true, dryCleaning: true })), null);
  assert.equal(ss.nextService(mix({ orders: 0, dryCleaning: true })), null);
  assert.equal(ss.nextService(null), null);
});

test("the habit is a weekly day; the bigger ticket rides the next pickup", () => {
  assert.equal(ss.inviteKind("ironing"), "routine");
  assert.equal(ss.inviteKind("dry-cleaning"), "addon");
  assert.equal(ss.inviteKind("wash-and-iron"), "addon");
  assert.deepEqual(ss.DEFAULT_ROUTINE, { weekday: 6, window: "evening" });
  assert.deepEqual(ss.validRoutine("6", "evening"), { weekday: 6, window: "evening" });
  assert.equal(ss.validRoutine(7, "evening"), null);
  assert.equal(ss.validRoutine(1, "night"), null);
});

test("staff hints: every dry-cleaning-only customer, add-a-service only for customers with 2+ orders", () => {
  assert.equal(ss.staffAsk(mix({ dryCleaning: true })), "ironing");
  assert.equal(ss.staffAsk(mix({ ironing: true })), null);
  assert.equal(ss.staffAsk(mix({ orders: 4, ironing: true })), "dry-cleaning");
  assert.equal(ss.staffAsk(mix({ orders: 4, ironing: true, dryCleaning: true })), "wash-and-iron");
  assert.equal(ss.staffAsk(undefined), null);
});

test("every invite lists real price-list names for its service", () => {
  for (const [service, invite] of Object.entries(ss.INVITE_ITEMS)) {
    assert.ok(invite.names.length >= 3, service);
    assert.ok(["Ironing", "Dry Cleaning", "Wash & Iron"].includes(invite.priceService), service);
  }
});

test("first-timers who only had dry cleaning get the everyday text", () => {
  const s = r.parseRhythm(undefined);
  assert.equal(r.templateProblem(r.DEFAULT_ONETIMER_DC.bn), null);
  assert.equal(r.templateProblem(r.DEFAULT_ONETIMER_DC.en), null);
  assert.equal(r.templateFor("onetimer", s.onetimer, "Dry Cleaning", "bn"), r.DEFAULT_ONETIMER_DC.bn);
  assert.equal(r.templateFor("onetimer", s.onetimer, "Ironing", "bn"), s.onetimer.textBn);
  assert.equal(r.templateFor("regularDue", s.regularDue, "Dry Cleaning", "en"), s.regularDue.textEn);
  // A saved text without the link falls back to the default.
  const saved = r.parseRhythm({ onetimer: { dcTextBn: "no link", dcTextEn: "Velto: {hi}shirts too? {link}" } });
  assert.equal(saved.onetimer.dcTextBn, r.DEFAULT_ONETIMER_DC.bn);
  assert.equal(saved.onetimer.dcTextEn, "Velto: {hi}shirts too? {link}");
  assert.equal(saved.regularDue.dcTextBn, undefined);
});
