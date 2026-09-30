/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");
const test = require("node:test");
const { makeDraft, readDraft, draftHasContent, validateCallback, bdPhone, callbackPush, DRAFT_MAX_AGE_MS } = require("../.foundation-test-build/booking-recovery.js");

const empty = { service: null, services: [], what: "", items: [], sector: "", address: "", backBy: "", name: "", phone: "", notes: "" };
const now = Date.parse("2026-09-29T12:00:00Z");

test("a draft is only kept when the visitor typed or chose something", () => {
  assert.equal(makeDraft(empty, now), null);
  assert.equal(makeDraft({ ...empty, notes: "only a preset note" }, now), null, "a note the page prefilled isn't the visitor's own input");
  assert.equal(makeDraft({ ...empty, sector: "7" }, now), null);
  assert.ok(makeDraft({ ...empty, what: "5 shirts" }, now));
  assert.ok(makeDraft({ ...empty, phone: "0171" }, now));
  assert.ok(draftHasContent({ ...empty, services: ["ironing"] }));
});

test("a draft round-trips and is read back defensively", () => {
  const line = { id: "a1", item: "Shirt", service: "ironing", quantity: 3, options: ["ironing", "wash-and-iron"], prices: { ironing: 2000, "wash-and-iron": null } };
  const d = makeDraft({ ...empty, what: "5 shirts", items: [line], sector: "7", name: "Nadia", phone: "01712 345678", backBy: "2026-10-03" }, now);
  const back = readDraft(JSON.stringify(d), now + 3600_000);
  assert.deepEqual(back, d);
  assert.equal(readDraft(JSON.stringify(d), now + DRAFT_MAX_AGE_MS + 1), null, "older than 7 days is dropped");
  assert.equal(readDraft("{not json", now), null);
  assert.equal(readDraft(JSON.stringify({ ...d, v: 2 }), now), null, "other versions ignored");
  assert.equal(readDraft(null, now), null);
  const junk = readDraft(JSON.stringify({ ...d, items: [{ item: "", quantity: 1 }, { item: "Pant", quantity: 0 }, { item: "Sari", quantity: 2, prices: { x: "free" } }], backBy: "soon" }), now);
  assert.equal(junk.items.length, 1, "bad lines dropped");
  assert.deepEqual(junk.items[0].prices, {}, "bad prices dropped");
  assert.equal(junk.backBy, "");
});

test("call-back requests need a real name and a Bangladesh mobile", () => {
  assert.equal(bdPhone("+880 1712-345678"), "01712345678");
  assert.equal(bdPhone("01212345678"), null, "not a mobile prefix");
  assert.deepEqual(validateCallback({ name: "N", phone: "01712345678" }), { ok: false, field: "name" });
  assert.deepEqual(validateCallback({ name: "Nadia", phone: "12345" }), { ok: false, field: "phone" });
  assert.deepEqual(validateCallback("x"), { ok: false, field: "request" });
  const ok = validateCallback({ name: "  Nadia  Rahman ", phone: "8801712345678", what: "5 shirts\nand a sari", area: "Uttara Sector 7", extra: "ignored" });
  assert.equal(ok.ok, true);
  assert.deepEqual(ok.value, { name: "Nadia Rahman", phone: "01712345678", area: "Uttara Sector 7", what: "5 shirts and a sari", services: undefined, preferred: undefined });
});

test("managers get a short call-back alert", () => {
  const p = callbackPush({ name: "Nadia Rahman", area: "Uttara Sector 7" }, "https://www.velto.com.bd/", Date.parse("2026-09-29T06:00:00Z"));
  assert.equal(p.title, "📞 Call-back request");
  assert.equal(p.body, "Nadia Rahman · Uttara Sector 7. Started a booking but asked us to call. Call within 30 min.");
  assert.equal(p.url, "https://www.velto.com.bd/admin/requests#callbacks");
  const n = callbackPush({ name: "Nadia" }, "https://x.test", Date.parse("2026-09-29T01:00:00Z"));
  assert.equal(n.body, "Nadia. Started a booking but asked us to call. Night request: call in the morning (from 9 AM).");
});

test("the call-back WhatsApp message greets by first name in both languages", () => {
  const { callbackMessage } = require("../.foundation-test-build/admin/request-flow.js");
  assert.match(callbackMessage({ name: "Nadia Rahman" }, "en"), /^Hello Nadia, this is Velto\. You asked us to call you about a pickup\./);
  assert.match(callbackMessage({ name: "Nadia Rahman" }, "bn"), /কল করতে বলেছিলেন/);
  assert.ok(callbackMessage({ name: null }, "en").startsWith("Hello, this is Velto."));
});

test("call-back result: sent, blocked when this number's requests today were all handled, else failed", () => {
  const { callbackOutcome } = require("../.foundation-test-build/booking-recovery.js");
  assert.equal(callbackOutcome({ ok: true }), "sent");
  // 429 only comes when nothing is open for the number, so nobody is waiting to call: never "sent".
  assert.equal(callbackOutcome({ ok: false, code: "rate_limited" }), "blocked");
  for (const code of ["unavailable", "not_connected", "invalid_request"]) assert.equal(callbackOutcome({ ok: false, code }), "failed", code);
});
