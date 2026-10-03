/* eslint-disable @typescript-eslint/no-require-imports */
const test = require("node:test");
const assert = require("node:assert/strict");
const { bookingCaller } = require("../.foundation-test-build/booking-caller.js");

const ready = { kind: "customer", account: { state: "ready", phone: "01712345678", phoneVerified: true } };

test("only a signed-in customer may book, and the booking carries the verified phone", () => {
  assert.deepEqual(bookingCaller(ready), { ok: true, phone: "01712345678" });
  for (const kind of ["anonymous", "staff", "disabled", "unavailable"]) {
    assert.deepEqual(bookingCaller({ kind }), { ok: false, code: "sign_in_required" }, kind);
  }
});

test("an unfinished account counts only once its phone is proven", () => {
  assert.deepEqual(bookingCaller({ kind: "customer", account: { state: "incomplete", phone: "01712345678", phoneVerified: true } }), { ok: true, phone: "01712345678" });
  assert.equal(bookingCaller({ kind: "customer", account: { state: "incomplete", phone: "01712345678", phoneVerified: false } }).ok, false);
  assert.equal(bookingCaller({ kind: "customer", account: { state: "incomplete", phone: null } }).ok, false);
  assert.equal(bookingCaller({ kind: "customer", account: { state: "ready", phone: "" } }).ok, false, "ready without a phone never happens, but still no booking");
});
