/* eslint-disable @typescript-eslint/no-require-imports */
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const c = require("../../.command-center-test-build/lib/push/catalog.js");

// A full context: every state gets everything it could use, so the rules are tested at their worst.
const ctx = { orderNumber: "VEL-01482", window: "today, 6–8 PM", returnDay: "Thursday", garments: 18, amount: 460, service: "Iron Only", bookPath: "/r/Ab3xK9pQ", reason: "The bKash number did not match" };

test("every state renders in both languages and passes the copy rules", () => {
  for (const d of c.PUSH_DESIGNS) {
    for (const lang of ["en", "bn"]) {
      const m = c.renderPush(d.id, { ...ctx, bookPath: lang === "bn" ? "/bn/r/Ab3xK9pQ" : "/r/Ab3xK9pQ" }, lang, 1);
      assert.ok(m.title && m.body, `${d.id} ${lang} has words`);
      assert.deepEqual(c.copyProblems(m), [], `${d.id} ${lang}: ${m.title} / ${m.body}`);
      assert.ok(m.url.startsWith(lang === "bn" ? "/bn/" : "/"), `${d.id} ${lang} links into the site`);
      assert.equal(m.cls, d.cls);
      assert.ok(m.tag.endsWith(`:${d.lane}`), `${d.id} collapse key ends with its lane`);
    }
  }
});

test("only action-required (class 1) pushes carry a button, and the button only opens a screen", () => {
  for (const d of c.PUSH_DESIGNS) {
    const m = c.renderPush(d.id, ctx, "en", 1);
    if (d.cls === 1) {
      assert.equal(m.actions.length, 1, d.id);
      assert.equal(m.actions[0].url, m.url, d.id);
    } else assert.equal(m.actions, undefined, d.id);
  }
});

test("truth rules hold in the words", () => {
  const en = (id) => c.renderPush(id, ctx, "en", 1);
  assert.doesNotMatch(en("P01").title, /confirmed/i);
  assert.doesNotMatch(`${en("P04").title} ${en("P04").body}`, /18|460|৳/);
  assert.doesNotMatch(`${en("P14").title} ${en("P14").body}`, /received your payment|paid|confirmed/i);
  assert.doesNotMatch(`${en("P10").title} ${en("P10").body}`, /on the way/i);
  assert.match(en("P16").body, /stays in place until we confirm/);
  // A balance is never sent (a website can't know the phone is locked).
  assert.doesNotMatch(`${en("P13").title} ${en("P13").body}`, /460|৳/);
  // Delivered with a balance says so; delivered settled never mentions money.
  assert.match(en("P12b").body, /৳460/);
  assert.doesNotMatch(en("P12").body, /৳|receipt/);
  // A care push never describes the garment or its fault.
  assert.doesNotMatch(en("P07").body, /stain|colour|silk|kurta|shirt/i);
});

test("a newer state on the same order replaces the older card; other orders don't", () => {
  const a = c.renderPush("P10", ctx, "en", 1);
  const b = c.renderPush("P11", ctx, "en", 2);
  assert.equal(a.tag, b.tag);
  assert.notEqual(c.renderPush("P10", { ...ctx, orderNumber: "VEL-01491" }, "en", 1).tag, a.tag);
  // The decision recorded replaces the approval request (same care lane).
  assert.equal(c.renderPush("P07", ctx, "en", 1).tag, c.renderPush("P08", ctx, "en", 2).tag);
});

test("links land on the thing the push is about", () => {
  assert.equal(c.renderPush("P07", ctx, "en", 1).url, "/account/orders/VEL-01482#care");
  assert.equal(c.renderPush("P13", ctx, "bn", 1).url, "/bn/account/orders/VEL-01482#payment");
  assert.equal(c.renderPush("P18", ctx, "en", 1).url, "/account/orders/VEL-01482#delivery");
  assert.equal(c.renderPush("P20", ctx, "en", 1).url, "/r/Ab3xK9pQ");
  assert.equal(c.renderPush("P02", ctx, "en", 1).url, "/account#pickups");
});

test("the order label ladder picks the friendliest unambiguous name", () => {
  const one = [{ orderNumber: "VEL-1", service: "Iron Only", garments: 18 }];
  assert.equal(c.orderLabel(one, "VEL-1", "en"), null);
  const services = [...one, { orderNumber: "VEL-2", service: "Dry Clean", garments: 4 }];
  assert.equal(c.orderLabel(services, "VEL-1", "en"), "Iron Only");
  const sizes = [...one, { orderNumber: "VEL-2", service: "Iron Only", garments: 6 }];
  assert.equal(c.orderLabel(sizes, "VEL-1", "en"), "18-garment");
  assert.equal(c.orderLabel(sizes, "VEL-1", "bn"), "১৮টি কাপড়ের");
  const same = [...one, { orderNumber: "VEL-2", service: "Iron Only", garments: 18 }];
  assert.equal(c.orderLabel(same, "VEL-1", "en"), "VEL-1");
  assert.equal(c.renderPush("P10", { orderNumber: "VEL-1", label: "Iron Only" }, "en", 1).title, "Your Iron Only order is ready");
  assert.equal(c.renderPush("P10", { orderNumber: "VEL-1", label: "VEL-1" }, "en", 1).title, "Order VEL-1 is ready");
  assert.equal(c.renderPush("P10", { orderNumber: "VEL-1", label: "18-garment" }, "en", 1).title, "Your 18-garment order is ready");
});

test("the copy linter catches the banned patterns", () => {
  assert.deepEqual(c.copyProblems({ title: "Order status updated", body: "x" }), ["banned phrase"]);
  assert.ok(c.copyProblems({ title: "Ready ✓", body: "x" }).includes("emoji") || c.copyProblems({ title: "Ready 🎉", body: "x" }).includes("emoji"));
  assert.deepEqual(c.copyProblems({ title: "Come back!", body: "We miss you!" }).sort(), ["banned phrase", "second exclamation mark"]);
  assert.deepEqual(c.copyProblems({ title: "VEL-01482", body: "x" }), ["order code as headline"]);
  assert.deepEqual(c.copyProblems({ title: "On the way", body: "To House 14 Road 4" }), ["address or phone"]);
});
