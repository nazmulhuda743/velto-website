/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");
const test = require("node:test");

const r = require("../../.command-center-test-build/lib/rhythm.js");

test("defaults are off and the texts are valid", () => {
  const s = r.parseRhythm(undefined);
  assert.equal(s.regularDue.enabled, false);
  assert.equal(s.slipping.enabled, false);
  assert.equal(r.templateProblem(r.DEFAULT_TEXT_BN), null);
  assert.equal(r.templateProblem(r.DEFAULT_TEXT_EN), null);
});

test("parseRhythm keeps limits in range and refuses a text without the link", () => {
  const s = r.parseRhythm({ regularDue: { enabled: true, maxPerRun: 9999, textBn: "no link here", lang: "fr" }, slipping: { enabled: "yes", maxPerDay: 3 } });
  assert.equal(s.regularDue.enabled, true);
  assert.equal(s.regularDue.maxPerRun, 40);
  assert.equal(s.regularDue.textBn, r.DEFAULT_TEXT_BN);
  assert.equal(s.regularDue.lang, "bn");
  assert.equal(s.slipping.enabled, false);
  assert.equal(s.slipping.maxPerDay, 3);
  assert.match(r.templateProblem("Velto: hi"), /\{link\}/);
  assert.match(r.templateProblem(`{link} ${"অনেক লম্বা ".repeat(40)}`), /too long/);
});

test("messages read naturally with and without a first name", () => {
  const link = r.rhythmLink("https://www.velto.com.bd", "Ab3xK9pQ", "bn");
  assert.equal(link, "www.velto.com.bd/bn/r/Ab3xK9pQ");
  assert.equal(r.rhythmLink("https://www.velto.com.bd/", "Ab3xK9pQ", "en"), "www.velto.com.bd/r/Ab3xK9pQ");
  assert.equal(r.renderMessage(r.DEFAULT_TEXT_BN, { firstName: "Nazmul Huda", service: "Ironing", link }, "bn"), `Velto: Nazmul, আয়রনের কাপড় জমেছে? পিকআপ এক ট্যাপে: ${link}`);
  assert.equal(r.renderMessage(r.DEFAULT_TEXT_BN, { firstName: null, service: null, link }, "bn"), `Velto: লন্ড্রির কাপড় জমেছে? পিকআপ এক ট্যাপে: ${link}`);
  assert.equal(r.renderMessage(r.DEFAULT_TEXT_EN, { firstName: "", service: "Wash + Iron", link }, "en"), `Velto: Hi, time for your wash & iron pickup? Book in one tap: ${link}`);
});

test("SMS parts: plain text 160/153, Bangla 70/67", () => {
  assert.deepEqual(r.smsParts("a".repeat(160)), { unicode: false, length: 160, parts: 1 });
  assert.equal(r.smsParts("a".repeat(161)).parts, 2);
  assert.equal(r.smsParts("€".repeat(80)).length, 160, "extension characters count double");
  assert.deepEqual(r.smsParts("আ".repeat(70)), { unicode: true, length: 70, parts: 1 });
  assert.equal(r.smsParts("আ".repeat(71)).parts, 2);
  const bn = r.renderMessage(r.DEFAULT_TEXT_BN, { firstName: "Nazmul", service: "Dry Cleaning", link: r.SAMPLE_LINK }, "bn");
  assert.ok(r.smsParts(bn).parts <= 2, `default Bangla SMS is ${r.smsParts(bn).parts} parts`);
});

test("SMS only between 10:00 and 20:00 Dhaka", () => {
  assert.equal(r.smsHourOk(new Date("2026-10-01T12:25:00Z")), true, "18:25 Dhaka");
  assert.equal(r.smsHourOk(new Date("2026-10-01T14:05:00Z")), false, "20:05 Dhaka");
  assert.equal(r.smsHourOk(new Date("2026-10-01T03:00:00Z")), false, "09:00 Dhaka");
  assert.equal(r.smsHourOk(new Date("2026-10-01T04:30:00Z")), true, "10:30 Dhaka");
});
