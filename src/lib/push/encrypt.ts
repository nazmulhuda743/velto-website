import { createECDH, type ECDH, createHmac, createCipheriv, createPrivateKey, generateKeyPairSync, randomBytes, sign } from "node:crypto";

/**
 * Web Push without a dependency: message encryption (RFC 8291, aes128gcm) and the VAPID
 * signature (RFC 8292), with Node's own crypto. Pure, so tests/command-center/push.test.cjs can
 * decrypt what it encrypts.
 */

export const b64url = (buf: Buffer) => buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
export const fromB64url = (s: string) => Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64");

const hmac = (key: Buffer, data: Buffer) => createHmac("sha256", key).update(data).digest();

export type VapidKeys = { publicKey: string; privateJwk: string };

/** A new P-256 key pair: the public key as the browser wants it (uncompressed, base64url). */
export function newVapidKeys(): VapidKeys {
  const { publicKey, privateKey } = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
  const jwk = publicKey.export({ format: "jwk" }) as { x: string; y: string };
  const raw = Buffer.concat([Buffer.from([4]), fromB64url(jwk.x), fromB64url(jwk.y)]);
  return { publicKey: b64url(raw), privateJwk: JSON.stringify(privateKey.export({ format: "jwk" })) };
}

/** RFC 8291: the encrypted body for one subscription (p256dh and auth from the browser). */
export function encryptPayload(payload: Buffer, p256dh: string, auth: string, salt: Buffer = randomBytes(16), senderKeys?: ECDH) {
  const uaPublic = fromB64url(p256dh);
  const authSecret = fromB64url(auth);
  if (uaPublic.length !== 65 || authSecret.length !== 16) throw new Error("bad subscription keys");
  const sender = senderKeys ?? createECDH("prime256v1");
  if (!senderKeys) sender.generateKeys();
  const asPublic = sender.getPublicKey();
  const ecdh = sender.computeSecret(uaPublic);
  const prkKey = hmac(authSecret, ecdh);
  const keyInfo = Buffer.concat([Buffer.from("WebPush: info\0"), uaPublic, asPublic, Buffer.from([1])]);
  const ikm = hmac(prkKey, keyInfo);
  const prk = hmac(salt, ikm);
  const cek = hmac(prk, Buffer.from("Content-Encoding: aes128gcm\0\x01")).subarray(0, 16);
  const nonce = hmac(prk, Buffer.from("Content-Encoding: nonce\0\x01")).subarray(0, 12);
  const cipher = createCipheriv("aes-128-gcm", cek, nonce);
  const body = Buffer.concat([cipher.update(Buffer.concat([payload, Buffer.from([2])])), cipher.final(), cipher.getAuthTag()]);
  const rs = Buffer.alloc(4);
  rs.writeUInt32BE(4096);
  return Buffer.concat([salt, rs, Buffer.from([asPublic.length]), asPublic, body]);
}

/** RFC 8292: the Authorization header for one push service (the endpoint's origin). */
export function vapidAuthorization(endpoint: string, keys: VapidKeys, subject: string, now = Date.now()) {
  const aud = new URL(endpoint).origin;
  const header = b64url(Buffer.from(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const claims = b64url(Buffer.from(JSON.stringify({ aud, exp: Math.floor(now / 1000) + 12 * 3600, sub: subject })));
  const key = createPrivateKey({ key: JSON.parse(keys.privateJwk), format: "jwk" });
  const signature = sign("sha256", Buffer.from(`${header}.${claims}`), { key, dsaEncoding: "ieee-p1363" });
  return `vapid t=${header}.${claims}.${b64url(signature)}, k=${keys.publicKey}`;
}

/** Only real push services receive our messages (the endpoint comes from the browser). */
export function pushEndpointOk(endpoint: string) {
  try {
    const u = new URL(endpoint);
    return (
      u.protocol === "https:" &&
      /(^|\.)(googleapis\.com|mozilla\.com|mozaws\.net|push\.apple\.com|notify\.windows\.com|push\.services\.mozilla\.com)$/.test(u.hostname)
    );
  } catch {
    return false;
  }
}

export type PushMessage = { title: string; body: string; url: string; tag?: string };
