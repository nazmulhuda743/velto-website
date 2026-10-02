import { NextResponse, type NextRequest } from "next/server";
import { getCustomerSession } from "@/lib/customer/portal";
import { readBoundedJson } from "@/lib/security/json-request";
import { supabaseFetch, supabaseRpc } from "@/lib/supabase-server";

/**
 * The signed-in customer's notification settings: status, what to receive, and turning off (this
 * phone or everywhere). There is no test: turning on already sends one notification.
 */
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

/** The six switches in Profile → Notifications: request field → website_push_prefs_set key. */
const PREF_KEYS = { orderUpdates: "order", pickupUpdates: "pickup", careUpdates: "care", paymentUpdates: "payment", reminders: "reminders", offers: "offers" } as const;

/** Saves only the switches sent. Before website_push_prefs.sql is applied, the two older ones still save. */
async function savePrefs(uid: string, v: Record<string, unknown>) {
  const prefs: Record<string, boolean> = {};
  for (const [field, key] of Object.entries(PREF_KEYS)) if (typeof v[field] === "boolean") prefs[key] = v[field] as boolean;
  const res = await supabaseFetch("/rest/v1/rpc/website_push_prefs_set", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ p_auth_user_id: uid, p_prefs: prefs }),
    cache: "no-store",
  });
  if (res.ok) return res.json();
  if (res.status !== 404) throw new Error(`rpc website_push_prefs_set failed with HTTP ${res.status}`);
  return supabaseRpc("website_push_prefs", {
    p_auth_user_id: uid,
    p_order_updates: typeof prefs.order === "boolean" ? prefs.order : null,
    p_reminders: typeof prefs.reminders === "boolean" ? prefs.reminders : null,
  });
}

export async function POST(request: NextRequest) {
  const session = await getCustomerSession();
  if (session.kind !== "customer") return json({ ok: false, error: "sign_in" }, 401);
  const body = await readBoundedJson(request);
  if (!body.ok) return json({ ok: false }, body.status);
  const v = (body.value ?? {}) as Record<string, unknown>;
  const uid = session.user.id;
  try {
    if (v.action === "status") return json({ ok: true, status: await supabaseRpc("website_push_status", { p_auth_user_id: uid }) });
    if (v.action === "prefs") return json({ ok: true, status: await savePrefs(uid, v) });
    if (v.action === "off") {
      const endpoint = typeof v.endpoint === "string" && v.endpoint.length <= 1000 ? v.endpoint : null;
      return json({ ok: true, status: await supabaseRpc("website_push_remove", { p_auth_user_id: uid, p_endpoint: endpoint }) });
    }
    return json({ ok: false, error: "action" }, 400);
  } catch {
    return json({ ok: false, error: "unavailable" }, 503);
  }
}
