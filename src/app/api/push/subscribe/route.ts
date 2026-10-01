import { NextResponse, type NextRequest } from "next/server";
import { getCustomerSession } from "@/lib/customer/portal";
import { pushEndpointOk } from "@/lib/push/encrypt";
import { CODE } from "@/lib/rhythm-server";
import { readBoundedJson } from "@/lib/security/json-request";
import { supabaseRpc } from "@/lib/supabase-server";

/**
 * Save a browser that allowed notifications. Either the signed-in customer (tied to their proven
 * phone and linked Velto customer) or a reminder link's code (tied to the phone the SMS reached).
 * Nothing is saved for anyone else.
 */
const KEY = /^[A-Za-z0-9_-]{80,100}$/;
const AUTH = /^[A-Za-z0-9_-]{16,32}$/;
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

export async function POST(request: NextRequest) {
  const body = await readBoundedJson(request);
  if (!body.ok) return json({ ok: false }, body.status);
  const v = (body.value ?? {}) as { subscription?: { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } }; lang?: unknown; code?: unknown };
  const endpoint = typeof v.subscription?.endpoint === "string" ? v.subscription.endpoint : "";
  const p256dh = typeof v.subscription?.keys?.p256dh === "string" ? v.subscription.keys.p256dh : "";
  const auth = typeof v.subscription?.keys?.auth === "string" ? v.subscription.keys.auth : "";
  const lang = v.lang === "en" ? "en" : "bn";
  if (!pushEndpointOk(endpoint) || endpoint.length > 1000 || !KEY.test(p256dh) || !AUTH.test(auth)) return json({ ok: false, error: "invalid" }, 400);
  const ua = (request.headers.get("user-agent") ?? "").slice(0, 300);

  try {
    if (typeof v.code === "string") {
      if (!CODE.test(v.code)) return json({ ok: false, error: "invalid" }, 400);
      const ok = await supabaseRpc<boolean>("website_push_save_for_code", { p_code: v.code, p_endpoint: endpoint, p_p256dh: p256dh, p_auth: auth, p_lang: lang, p_ua: ua });
      return json({ ok: Boolean(ok) }, ok ? 200 : 403);
    }
    const session = await getCustomerSession();
    if (session.kind !== "customer") return json({ ok: false, error: "sign_in" }, 401);
    const status = await supabaseRpc<unknown>("website_push_save_for_user", {
      p_auth_user_id: session.user.id, p_endpoint: endpoint, p_p256dh: p256dh, p_auth: auth, p_lang: lang, p_ua: ua,
    });
    return json({ ok: true, status });
  } catch {
    return json({ ok: false, error: "unavailable" }, 503);
  }
}
