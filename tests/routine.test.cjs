/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");
const test = require("node:test");
const { parseRoutine, parseRoutineRows, routineInput, routinePush } = require("../.foundation-test-build/routine.js");
const { routineMessage } = require("../.foundation-test-build/admin/request-flow.js");
const { opsPickupWhen, dayLabel, addDays, OPS_WORDS } = require("../.foundation-test-build/pickup-when.js");

test("routine rows are read defensively", () => {
  const ok = { id: "r1", status: "active", weekday: 6, window: "afternoon", service: "ironing", note: null, reason: null, change: false, nextOn: "2026-10-03" };
  assert.deepEqual(parseRoutine(ok), ok);
  assert.equal(parseRoutine(null), null);
  assert.equal(parseRoutine({ ...ok, weekday: 7 }), null, "weekday 0–6 only");
  assert.equal(parseRoutine({ ...ok, window: "noon" }), null);
  assert.equal(parseRoutine({ ...ok, status: "maybe" }), null);
  assert.equal(parseRoutine({ ...ok, change: "yes" }).change, false, "only a real true is a change");
  const rows = parseRoutineRows([{ ...ok, name: "Nusrat", phone: "01711000001", address: "House 1", area: "7", createdAt: "x", orders: 3 }, { junk: true }, "x"]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].orders, 3);
  assert.deepEqual(parseRoutineRows("nope"), []);
});

test("routine form values are checked before they reach the database", () => {
  assert.deepEqual(routineInput("6", "afternoon", "", "  "), { p_weekday: 6, p_window: "afternoon", p_service: null, p_note: null });
  assert.deepEqual(routineInput("0", "morning", "ironing", " Gate 4 "), { p_weekday: 0, p_window: "morning", p_service: "ironing", p_note: "Gate 4" });
  assert.equal(routineInput("7", "morning", "", ""), null);
  assert.equal(routineInput("1", "night", "", ""), null);
  assert.equal(routineInput("1", "morning", "curtain-cleaning", ""), null, "household services are quoted, not routine");
  assert.equal(routineInput("1", "morning", "", "x".repeat(301)), null);
});

test("managers get a short alert that says what to do", () => {
  const p = routinePush({ weekday: 6, window: "afternoon", change: false }, "Nusrat Jahan", "https://www.velto.com.bd/");
  assert.match(p.title, /New routine pickup request/);
  assert.equal(p.body, "Nusrat Jahan · every Saturday afternoon. Confirm on WhatsApp, then activate.");
  assert.equal(p.url, "https://www.velto.com.bd/admin/requests#routines");
  assert.match(routinePush({ weekday: 1, window: "morning", change: true }, "A", "https://x").title, /change/i);
});

test("the routine WhatsApp message names the day and time in both languages", () => {
  const en = routineMessage({ name: "Nusrat Jahan", weekday: 6, slot: "afternoon" }, "en");
  assert.match(en, /^Hello Nusrat, this is Velto\./);
  assert.match(en, /every Saturday, Afternoon \(12–4 PM\)/);
  assert.match(en, /Shall we start this Saturday\?/);
  const bn = routineMessage({ name: "Nusrat Jahan", weekday: 6, slot: "afternoon" }, "bn");
  assert.match(bn, /প্রতি শনিবার দুপুর \(১২টা–৪টা\)/);
  assert.ok(bn.length < 400 && en.length < 400, "short enough to read at a glance");
});

test("one-tap repeat sends Ops the same pickup wording as the booking form", () => {
  const today = "2026-09-29";
  const afternoon = { id: "afternoon", starts: "12:00", ends: "16:00" };
  assert.equal(opsPickupWhen(today, afternoon, false, today), "Today Tue 29 Sep, Afternoon 12–4 PM");
  assert.equal(opsPickupWhen(addDays(today, 1), { id: "morning", starts: "09:00", ends: "12:00" }, true, today), "Tomorrow Wed 30 Sep, Morning 9 AM–12 PM (window booked)");
  assert.equal(opsPickupWhen(addDays(today, 2), { id: "evening", starts: "16:00", ends: "20:00" }, false, today), "Thu 1 Oct, Evening 4–8 PM", "no Today/Tomorrow prefix further out");
  assert.equal(dayLabel(addDays(today, 2), OPS_WORDS, today), "Thu 1 Oct");
});
