/* eslint-disable @typescript-eslint/no-require-imports */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const s = require("../.foundation-test-build/admin/scheduler-logic.js");
test("Dhaka midnight day boundaries", () => {
  assert.equal(s.dhakaDate(new Date("2026-10-05T18:00:00Z")), "2026-10-06");
  assert.equal(s.dhakaDate(new Date("2026-10-05T17:59:59Z")), "2026-10-05");
});
test("exact times are timezone independent and duration aware", () => {
  assert.deepEqual(s.exactInterval("2026-10-07", "10:30", 90), {
    start: "2026-10-07T04:30:00.000Z",
    end: "2026-10-07T06:00:00.000Z",
  });
  assert.equal(s.localTime("2026-10-07T04:30:00Z"), "10:30");
});
test("invalid dates and impossible durations are rejected", () => {
  for (const d of ["2026-02-30", "garbage", "2026-13-01"])
    assert.equal(s.exactInterval(d, "10:00", 30), null);
  assert.equal(s.exactInterval("2026-10-07", "25:00", 30), null);
  assert.equal(s.exactInterval("2026-10-07", "10:00", -1), null);
});
test("configurable grid excludes closing hour", () => {
  assert.deepEqual(s.timeGrid("09:00", "10:00", 30), ["09:00", "09:30"]);
  assert.equal(s.timeGrid("09:00", "10:00", 15).length, 4);
});
test("overlaps include unequal starts but exclude touching endpoints", () => {
  assert.equal(
    s.overlaps(
      "2026-10-07T10:00Z",
      "2026-10-07T11:30Z",
      "2026-10-07T11:00Z",
      "2026-10-07T12:00Z",
    ),
    true,
  );
  assert.equal(
    s.overlaps(
      "2026-10-07T10:00Z",
      "2026-10-07T11:30Z",
      "2026-10-07T11:30Z",
      "2026-10-07T12:00Z",
    ),
    false,
  );
});
test("planned delivery is not presented as ready", () => {
  assert.equal(
    s.appointmentLabel({
      kind: "delivery",
      status: "scheduled",
      scheduled_start: "x",
      assignee_id: "r",
      order_status: "In Wash Plant",
    }),
    "Planned · not ready",
  );
});
test("unassigned, unscheduled, blocked and history are explicit", () => {
  assert.equal(s.appointmentLabel({ status: "scheduled" }), "Needs scheduling");
  assert.equal(
    s.appointmentLabel({ status: "scheduled", scheduled_start: "x" }),
    "Unassigned",
  );
  assert.equal(
    s.appointmentLabel({ status: "scheduled", blocking_reason: "Waiting" }),
    "Blocked",
  );
  assert.equal(s.active({ status: "cancelled" }), false);
});
