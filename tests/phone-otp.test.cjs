/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");
const { createHmac } = require("node:crypto");
const test = require("node:test");

const { verifyStandardWebhook } = require("../.foundation-test-build/security/standard-webhooks.js");
const { bdPhoneToE164, hookPhone, linkCodeMessage, otpMessage, validOtp } = require("../.foundation-test-build/sms/otp.js");

const key = Buffer.from("velto-test-secret-velto-test-secret");
const secret = `v1,whsec_${key.toString("base64")}`;
const sign = (id, ts, body) => `v1,${createHmac("sha256", key).update(`${id}.${ts}.${body}`).digest("base64")}`;

test("accepts a correctly signed Supabase hook", () => {
  const body = JSON.stringify({ user: { phone: "8801712345678" }, sms: { otp: "123456" } });
  const now = 1_790_000_000;
  const headers = { id: "msg_1", timestamp: String(now), signature: sign("msg_1", now, body) };
  assert.equal(verifyStandardWebhook(secret, headers, body, now), true);
  // Several signatures (secret rotation): any valid one passes.
  assert.equal(verifyStandardWebhook(secret, { ...headers, signature: `v1,AAAA ${headers.signature}` }, body, now), true);
});

test("rejects tampered, stale, unsigned or wrongly keyed hooks", () => {
  const body = JSON.stringify({ user: { phone: "8801712345678" }, sms: { otp: "123456" } });
  const now = 1_790_000_000;
  const good = { id: "msg_1", timestamp: String(now), signature: sign("msg_1", now, body) };
  assert.equal(verifyStandardWebhook(secret, good, body.replace("123456", "654321"), now), false);
  assert.equal(verifyStandardWebhook(secret, good, body, now + 6 * 60), false);
  assert.equal(verifyStandardWebhook(secret, { ...good, signature: null }, body, now), false);
  assert.equal(verifyStandardWebhook(secret, { ...good, id: "msg_2" }, body, now), false);
  assert.equal(verifyStandardWebhook(`v1,whsec_${Buffer.from("other").toString("base64")}`, good, body, now), false);
  assert.equal(verifyStandardWebhook(secret, { ...good, timestamp: "soon" }, body, now), false);
});

test("only Bangladeshi mobiles can receive a code", () => {
  assert.equal(hookPhone("8801712345678"), "01712345678");
  assert.equal(hookPhone("+8801912345678"), "01912345678");
  assert.equal(hookPhone("+14155550123"), null);
  assert.equal(hookPhone("8801212345678"), null);
  assert.equal(hookPhone(8801712345678), null);
  assert.equal(bdPhoneToE164("01712345678"), "+8801712345678");
});

test("codes are six digits; the SMS is one plain segment with the WebOTP line", () => {
  assert.equal(validOtp(" 123 456 "), "123456");
  assert.equal(validOtp("12345"), null);
  assert.equal(validOtp("12345a"), null);
  const sms = otpMessage("482913");
  // The gateway adds the "(Velto)" header itself; repeating it here would show it twice.
  assert.doesNotMatch(sms, /\(Velto\)/);
  assert.match(sms, /482913/);
  assert.match(sms, /\n@www\.velto\.com\.bd #482913$/);
  assert.ok(sms.length <= 160, `SMS is ${sms.length} characters`);
  assert.match(sms, /^[\x20-\x7e\n]+$/, "GSM-7 friendly ASCII only");
  assert.match(sms, /^Use OTP: 482913 to sign in to Velto\./);
  const link = linkCodeMessage("482913");
  assert.doesNotMatch(link, /\(Velto\)/);
  assert.match(link, /^Use OTP: 482913 to show your Velto orders\./);
  assert.match(link, /\n@www\.velto\.com\.bd #482913$/);
  assert.ok(link.length <= 160, `SMS is ${link.length} characters`);
});

const { sniffPhotoType, readPhotoIds } = require("../.foundation-test-build/booking-photos.js");

test("booking photos: the real type comes from the bytes", () => {
  assert.equal(sniffPhotoType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0])), "image/jpeg");
  assert.equal(sniffPhotoType(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0])), "image/png");
  assert.equal(sniffPhotoType(new TextEncoder().encode("RIFF\0\0\0\0WEBPVP8 ")), "image/webp");
  assert.equal(sniffPhotoType(new TextEncoder().encode("<svg xmlns=...>")), null);
  assert.equal(sniffPhotoType(new TextEncoder().encode("GIF89a......")), null);
  assert.equal(readPhotoIds(undefined), undefined);
  assert.equal(readPhotoIds([]), undefined);
  assert.deepEqual(readPhotoIds(["0123456789abcdef0123456789abcdef", "0123456789abcdef0123456789abcdef"]), ["0123456789abcdef0123456789abcdef"]);
});
