/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");
const test = require("node:test");

const m = require("../.foundation-test-build/admin/retention-messages.js");

const facts = { name: "Md. Rahim Uddin", lastOrderNumber: "VEL-01941", lastServices: ["Wash + Iron", "Ironing"], daysSince: 13 };

test("each list has its own honest message in Bangla and English", () => {
  const second = m.retentionMessage("second", facts, "en");
  assert.match(second, /^Hi Rahim, this is Velto\./);
  assert.match(second, /first order \(VEL-01941\)/);
  assert.match(m.retentionMessage("due", facts, "en"), /about 13 days since your last laundry \(Wash & Iron, Ironing\)/);
  assert.match(m.retentionMessage("winback", facts, "en"), /wasn't right, we'd like to hear it/);
  const bn = m.retentionMessage("due", facts, "bn");
  assert.match(bn, /^হ্যালো Rahim, Velto থেকে বলছি।/);
  assert.match(bn, /১৩ দিন আগে/);
  assert.match(bn, /ওয়াশ ও আয়রন, আয়রন/);
});

test("no offers, discounts or prices are ever promised", () => {
  for (const bucket of ["second", "due", "winback"]) {
    for (const lang of ["bn", "en"]) {
      const text = m.retentionMessage(bucket, facts, lang);
      assert.doesNotMatch(text, /%|discount|free|offer|৳|Tk|ছাড়|ফ্রি|অফার/i, `${bucket}/${lang}`);
    }
  }
});

test("a missing or odd name falls back to a plain greeting", () => {
  assert.match(m.retentionMessage("second", { ...facts, name: null }, "en"), /^Hi, this is Velto\./);
  assert.match(m.retentionMessage("winback", { ...facts, name: "01711000000" }, "bn"), /^হ্যালো, Velto থেকে বলছি।/);
});

test("WhatsApp links only for Bangladeshi mobiles, in international form", () => {
  assert.equal(m.whatsappLink("01711-000000", "Hi there"), "https://wa.me/8801711000000?text=Hi%20there");
  assert.equal(m.whatsappLink("+8801911000000", "x"), "https://wa.me/8801911000000?text=x");
  assert.equal(m.whatsappLink("02-9876543", "x"), null);
  assert.equal(m.whatsappLink(null, "x"), null);
});
