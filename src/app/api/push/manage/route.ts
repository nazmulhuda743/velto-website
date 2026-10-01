import { NextResponse, type NextRequest } from "next/server";
import { getCustomerSession } from "@/lib/customer/portal";
import { readBoundedJson } from "@/lib/security/json-request";
import { supabaseRpc } from "@/lib/supabase-server";

/**
 * The signed-in customer's notification settings: status, what to receive, and turning off (this
 * phone or everywhere). There is no test: turning on already sends one notification.
 */
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

export async function POST(request: NextRequest) {
  const session = await getCustomerSession();
  if (session.kind !== "customer") return json({ ok: false, error: "sign_in" }, 401);
  const body = await readBoundedJson(request);
  if (!body.ok) return json({ ok: false }, body.status);
  const v = (body.value ?? {}) as { action?: unknown; orderUpdates?: unknown; reminders?: unknown; endpoint?: unknown; lang?: unknown };
  const uid = session.user.id;
  try {
    if (v.action === "status") return json({ ok: true, status: await supabaseRpc("website_push_status", { p_auth_user_id: uid }) });
    if (v.action === "prefs") {
      const status = await supabaseRpc("website_push_prefs", {
        p_auth_user_id: uid,
        p_order_updates: typeof v.orderUpdates === "boolean" ? v.orderUpdates : null,
        p_reminders: typeof v.reminders === "boolean" ? v.reminders : null,
      });
      return json({ ok: true, status });
    }
    if (v.action === "off") {
      const endpoint = typeof v.endpoint === "string" && v.endpoint.length <= 1000 ? v.endpoint : null;
      return json({ ok: true, status: await supabaseRpc("website_push_remove", { p_auth_user_id: uid, p_endpoint: endpoint }) });
    }
    return json({ ok: false, error: "action" }, 400);
  } catch {
    return json({ ok: false, error: "unavailable" }, 503);
  }
}
