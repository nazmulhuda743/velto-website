/**
 * Browser side of notifications. The phone's own "Allow" prompt is only ever shown after the
 * customer tapped our "Turn on" button (a "Block" there can't be undone from the site).
 */

export type PushSupport = "ok" | "ios_install" | "unsupported";

const isIos = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const isStandalone = () =>
  window.matchMedia?.("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;

/** iPhone allows notifications only for a site added to the home screen (iOS 16.4+). */
export function pushSupport(): PushSupport {
  if (typeof window === "undefined") return "unsupported";
  const apis = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  if (isIos() && !isStandalone()) return "ios_install";
  return apis ? "ok" : "unsupported";
}

export const permission = (): NotificationPermission | "unsupported" => (typeof Notification === "undefined" ? "unsupported" : Notification.permission);

function keyBytes(base64url: string) {
  const b64 = base64url.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (base64url.length % 4)) % 4);
  const raw = atob(b64);
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

async function registration() {
  return (await navigator.serviceWorker.getRegistration("/")) ?? (await navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }));
}

/** This browser's subscription, if it has one. */
export async function currentSubscription(): Promise<PushSubscription | null> {
  if (pushSupport() !== "ok") return null;
  try {
    const reg = await navigator.serviceWorker.getRegistration("/");
    return (await reg?.pushManager.getSubscription()) ?? null;
  } catch {
    return null;
  }
}

export type SubscribeResult = { ok: true; welcomed: boolean } | { ok: false; reason: "denied" | "unsupported" | "failed" | "sign_in" };

/** Ask the phone, subscribe, and save it on the Velto server (signed in, or with a reminder code). */
export async function subscribe(lang: "bn" | "en", code?: string): Promise<SubscribeResult> {
  if (pushSupport() !== "ok") return { ok: false, reason: "unsupported" };
  try {
    const answer = await Notification.requestPermission();
    if (answer !== "granted") return { ok: false, reason: "denied" };
    const keyRes = await fetch("/api/push/key", { cache: "no-store" });
    const key = (await keyRes.json().catch(() => null)) as { ok?: boolean; publicKey?: string } | null;
    if (!key?.ok || !key.publicKey) return { ok: false, reason: "failed" };
    const reg = await registration();
    await navigator.serviceWorker.ready;
    const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(key.publicKey) }));
    const res = await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subscription: sub.toJSON(), lang, ...(code ? { code } : {}) }),
    });
    if (res.status === 401) return { ok: false, reason: "sign_in" };
    if (!res.ok) return { ok: false, reason: "failed" };
    const saved = (await res.json().catch(() => null)) as { welcomed?: boolean } | null;
    return { ok: true, welcomed: saved?.welcomed === true };
  } catch {
    return { ok: false, reason: "failed" };
  }
}

/** Turn off on this phone: the browser forgets it and so does Velto. */
export async function unsubscribe(): Promise<void> {
  const sub = await currentSubscription();
  const endpoint = sub?.endpoint;
  await sub?.unsubscribe().catch(() => false);
  await fetch("/api/push/manage", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "off", endpoint }) }).catch(() => null);
}
