import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Standard Webhooks signature check (https://www.standardwebhooks.com), used by Supabase Auth
 * HTTP hooks. The secret looks like "v1,whsec_<base64>"; the signature header holds one or
 * more space-separated "v1,<base64 HMAC-SHA256 of `${id}.${timestamp}.${body}`>" entries.
 * No imports beyond node:crypto, so it compiles inside the foundation test build.
 */
export const WEBHOOK_TOLERANCE_SECONDS = 5 * 60;

export function verifyStandardWebhook(
  secret: string,
  headers: { id: string | null; timestamp: string | null; signature: string | null },
  body: string,
  nowSeconds = Math.floor(Date.now() / 1000),
): boolean {
  const { id, timestamp, signature } = headers;
  if (!id || !timestamp || !signature || !/^\d{1,12}$/.test(timestamp)) return false;
  if (Math.abs(nowSeconds - Number(timestamp)) > WEBHOOK_TOLERANCE_SECONDS) return false;
  const encoded = secret.trim().replace(/^v1,/, "").replace(/^whsec_/, "");
  if (!encoded || !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) return false;
  const expected = createHmac("sha256", Buffer.from(encoded, "base64")).update(`${id}.${timestamp}.${body}`).digest();
  for (const entry of signature.split(" ")) {
    const [version, value] = entry.split(",", 2);
    if (version !== "v1" || !value) continue;
    const given = Buffer.from(value, "base64");
    if (given.length === expected.length && timingSafeEqual(given, expected)) return true;
  }
  return false;
}
