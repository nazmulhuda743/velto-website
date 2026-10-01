import "server-only";

import { supabaseRpc } from "../supabase-server";
import { SITE_URL } from "../site-url";
import { encryptPayload, newVapidKeys, pushEndpointOk, vapidAuthorization, type PushMessage, type VapidKeys } from "./encrypt";

/**
 * Sending notifications (docs/technical/sql/website_push.sql). The VAPID key pair is created by
 * this server the first time it is needed and kept in the database (service role only), so no
 * secret is ever typed, copied or sent anywhere.
 */

export type PushTarget = { endpoint: string; p256dh: string; auth: string; lang?: string };

let cached: VapidKeys | null = null;

export async function vapidKeys(): Promise<VapidKeys> {
  if (cached) return cached;
  let keys = await supabaseRpc<{ publicKey: string; privateJwk: string } | null>("website_push_keys_get", {});
  if (!keys) {
    const fresh = newVapidKeys();
    keys = await supabaseRpc<{ publicKey: string; privateJwk: string }>("website_push_keys_init", { p_public: fresh.publicKey, p_private: fresh.privateJwk });
  }
  cached = keys;
  return keys;
}

export const vapidPublicKey = async () => (await vapidKeys()).publicKey;

/** One notification to one browser. `gone` means the subscription no longer exists. */
export async function sendPush(target: PushTarget, message: PushMessage): Promise<{ ok: boolean; gone: boolean; status: number }> {
  if (!pushEndpointOk(target.endpoint)) return { ok: false, gone: true, status: 0 };
  try {
    const keys = await vapidKeys();
    const body = encryptPayload(Buffer.from(JSON.stringify(message)), target.p256dh, target.auth);
    const res = await fetch(target.endpoint, {
      method: "POST",
      headers: {
        "Content-Encoding": "aes128gcm",
        "Content-Type": "application/octet-stream",
        TTL: "86400",
        // Every Velto notification is something the customer should see now; "normal" lets Android
        // hold it back while the phone saves battery.
        Urgency: "high",
        Authorization: vapidAuthorization(target.endpoint, keys, SITE_URL),
      },
      body: new Uint8Array(body),
      signal: AbortSignal.timeout(8000),
      cache: "no-store",
    });
    const ok = res.status >= 200 && res.status < 300;
    // The push service's answer, without the subscription token (Vercel logs).
    if (!ok) console.warn("push refused", new URL(target.endpoint).hostname, res.status, (await res.text().catch(() => "")).slice(0, 160));
    return { ok, gone: res.status === 404 || res.status === 410, status: res.status };
  } catch (e) {
    console.warn("push failed", new URL(target.endpoint).hostname, e instanceof Error ? e.name : "error");
    return { ok: false, gone: false, status: 0 };
  }
}

/** Send and record the outcome (failures stop a subscription after five in a row). */
export async function sendAndRecord(target: PushTarget, message: PushMessage) {
  const r = await sendPush(target, message);
  await supabaseRpc("website_push_result", { p_endpoint: target.endpoint, p_ok: r.ok, p_gone: r.gone }).catch(() => null);
  return r.ok;
}

/** Same, with the push service's answer (staff's "Send test notification"). */
export async function sendAndReport(target: PushTarget, message: PushMessage) {
  const r = await sendPush(target, message);
  await supabaseRpc("website_push_result", { p_endpoint: target.endpoint, p_ok: r.ok, p_gone: r.gone }).catch(() => null);
  return r;
}
