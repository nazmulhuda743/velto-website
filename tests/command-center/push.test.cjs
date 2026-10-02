/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");
const test = require("node:test");
const crypto = require("node:crypto");

const p = require("../../.command-center-test-build/lib/push/encrypt.js");

const hmac = (k, d) => crypto.createHmac("sha256", k).update(d).digest();

/** The browser's side of RFC 8291, written independently of the module. */
function decrypt(body, ua, authSecret) {
  const salt = body.subarray(0, 16);
  const idlen = body[20];
  const asPublic = body.subarray(21, 21 + idlen);
  const data = body.subarray(21 + idlen);
  const ecdh = ua.computeSecret(asPublic);
  const prkKey = hmac(authSecret, ecdh);
  const ikm = hmac(prkKey, Buffer.concat([Buffer.from("WebPush: info\0"), ua.getPublicKey(), asPublic, Buffer.from([1])]));
  const prk = hmac(salt, ikm);
  const cek = hmac(prk, Buffer.concat([Buffer.from("Content-Encoding: aes128gcm\0"), Buffer.from([1])])).subarray(0, 16);
  const nonce = hmac(prk, Buffer.concat([Buffer.from("Content-Encoding: nonce\0"), Buffer.from([1])])).subarray(0, 12);
  const d = crypto.createDecipheriv("aes-128-gcm", cek, nonce);
  d.setAuthTag(data.subarray(data.length - 16));
  const plain = Buffer.concat([d.update(data.subarray(0, data.length - 16)), d.final()]);
  assert.equal(plain[plain.length - 1], 2, "last-record delimiter");
  return { text: plain.subarray(0, -1).toString("utf8"), rs: body.readUInt32BE(16) };
}

test("encryptPayload round-trips through the browser's decryption", () => {
  const ua = crypto.createECDH("prime256v1");
  ua.generateKeys();
  const authSecret = crypto.randomBytes(16);
  const message = JSON.stringify({ title: "আপনার কাপড় রেডি", body: "Order VEL-0001", url: "/account" });
  const body = p.encryptPayload(Buffer.from(message), p.b64url(ua.getPublicKey()), p.b64url(authSecret));
  const out = decrypt(body, ua, authSecret);
  assert.equal(out.text, message);
  assert.equal(out.rs, 4096);
  assert.throws(() => p.encryptPayload(Buffer.from("x"), "short", p.b64url(authSecret)), /bad subscription keys/);
});

test("VAPID: an ES256 token the public key verifies, for the push service's origin", () => {
  const keys = p.newVapidKeys();
  assert.equal(p.fromB64url(keys.publicKey).length, 65);
  const auth = p.vapidAuthorization("https://fcm.googleapis.com/fcm/send/abc", keys, "https://www.velto.com.bd", Date.UTC(2026, 9, 1));
  const m = /^vapid t=([^.]+)\.([^.]+)\.([^,]+), k=(.+)$/.exec(auth);
  assert.ok(m, auth);
  const claims = JSON.parse(p.fromB64url(m[2]).toString());
  assert.equal(claims.aud, "https://fcm.googleapis.com");
  assert.equal(claims.sub, "https://www.velto.com.bd");
  assert.equal(claims.exp, Date.UTC(2026, 9, 1) / 1000 + 12 * 3600);
  const raw = p.fromB64url(m[4]);
  const pub = crypto.createPublicKey({ key: { kty: "EC", crv: "P-256", x: p.b64url(raw.subarray(1, 33)), y: p.b64url(raw.subarray(33)) }, format: "jwk" });
  assert.ok(crypto.verify("sha256", Buffer.from(`${m[1]}.${m[2]}`), { key: pub, dsaEncoding: "ieee-p1363" }, p.fromB64url(m[3])));
});

test("only real push services", () => {
  assert.equal(p.pushEndpointOk("https://fcm.googleapis.com/fcm/send/x"), true);
  assert.equal(p.pushEndpointOk("https://web.push.apple.com/x"), true);
  assert.equal(p.pushEndpointOk("https://updates.push.services.mozilla.com/wpush/v2/x"), true);
  assert.equal(p.pushEndpointOk("https://evil.example/fcm.googleapis.com"), false);
  assert.equal(p.pushEndpointOk("http://fcm.googleapis.com/x"), false);
  assert.equal(p.pushEndpointOk("https://googleapis.com.evil.example/x"), false);
});

const msg = require("../../.command-center-test-build/lib/push/messages.js");

test("order updates come from the catalogue: truthful, one card per order, no buttons", () => {
  const bn = msg.orderMessage("Picked", { orderNumber: "VEL-01288", items: 12 }, "bn");
  assert.equal(bn.title, "কাপড় নিয়ে এসেছি");
  // Collected never carries a count or a price: the rider's count is provisional.
  assert.doesNotMatch(bn.body, /১২/);
  assert.equal(bn.url, "/bn/account/orders/VEL-01288");
  const en = msg.orderMessage("Picked", { orderNumber: "VEL-1", items: 1 }, "en");
  assert.equal(en.title, "Laundry collected");
  assert.equal(en.body, "Your bag is with Velto. We will confirm the garment count and price after verification.");
  const ready = msg.orderMessage("Ready", { orderNumber: "VEL-1", items: 18 }, "en");
  assert.equal(ready.title, "Your order is ready");
  assert.equal(ready.body, "All 18 garments have passed final checks. We will confirm your delivery window shortly.");
  assert.equal(ready.icon, "/notify/ready.png");
  assert.equal(ready.actions, undefined);
  assert.equal(ready.cls, 2);
  // Same order, same lane: Ready replaces Collected in the shade.
  assert.equal(ready.tag, en.tag);
  assert.equal(ready.tag, "VEL-1:order");
  const delivered = msg.orderMessage("Delivered", { orderNumber: "VEL-1", items: 3 }, "en");
  assert.equal(delivered.title, "Delivered · 3 garments returned");
  assert.doesNotMatch(delivered.body, /receipt|rate|book again/i);
  assert.equal(msg.orderMessage("Cancelled", { orderNumber: "VEL-1", items: 3 }, "en"), null);
});

test("reminder push opens the one-tap page, silently", () => {
  const bn = msg.reminderMessage({ firstName: "Nazmul Huda", service: "Ironing", code: "Ab3xK9pQ" }, "bn");
  assert.equal(bn.title, "নিয়মিত পিকআপের সময় হয়েছে?");
  assert.match(bn.body, /আয়রন/);
  assert.equal(bn.url, "/bn/r/Ab3xK9pQ");
  assert.equal(bn.cls, 3);
  const en = msg.reminderMessage({ firstName: null, service: "Ironing", code: "Ab3xK9pQ" }, "en");
  assert.equal(en.title, "Time for your usual pickup?");
  assert.equal(en.body, "Your usual Iron Only pickup is ready to book again.");
  assert.equal(en.url, "/r/Ab3xK9pQ");
  assert.equal(en.icon, "/notify/reminder.png");
  assert.equal(en.actions, undefined);
});

test("reminder push wording follows the playbook", () => {
  // No pattern yet: ask, don't claim a memory.
  assert.equal(msg.reminderMessage({ firstName: "Rafi", service: "Ironing", code: "Ab3xK9pQ", playbook: "onetimer" }, "en").title, "Ready for another pickup?");
  assert.equal(msg.reminderMessage({ firstName: null, service: null, code: "Ab3xK9pQ" }, "en").title, "Ready for another pickup?");
  assert.equal(msg.reminderMessage({ firstName: null, service: null, code: "Ab3xK9pQ", playbook: "seasonal" }, "bn").title, "শীতের কাপড় পরিষ্কারের সময়");
  assert.equal(msg.reminderMessage({ firstName: null, service: null, code: "Ab3xK9pQ", playbook: "seasonal" }, "bn").url, "/bn/r/Ab3xK9pQ");
});

test("care approval pushes: approval needed, reminders replace it, decision received", () => {
  const first = msg.careMessage("pending", "VEL-01491", "en");
  assert.equal(first.title, "Your approval is needed");
  assert.equal(first.cls, 1);
  assert.equal(first.url, "/account/orders/VEL-01491#care");
  assert.equal(first.actions.length, 1);
  // The garment and its fault never appear in the notification.
  assert.doesNotMatch(first.body, /kurta|silk|bleed|stain/i);
  const reminder = msg.careMessage("reminder1", "VEL-01491", "bn");
  assert.equal(reminder.tag, first.tag);
  assert.equal(reminder.url, "/bn/account/orders/VEL-01491#care");
  const decided = msg.careMessage("decided", "VEL-01491", "en");
  assert.equal(decided.title, "Decision received");
  assert.equal(decided.tag, first.tag);
  assert.equal(decided.cls, 2);
  assert.equal(msg.careMessage("other", "VEL-01491", "en"), null);
});
