import { NextResponse, type NextRequest } from "next/server";
import { careMessage, orderMessage } from "@/lib/push/messages";
import { sendAndRecord, type PushTarget } from "@/lib/push/server";
import { rhythmReady, runKeyOk } from "@/lib/rhythm-server";
import { supabaseRpc } from "@/lib/supabase-server";

/**
 * Order updates, every 10 minutes (pg_cron, website_rhythm_schedule.sql): an order that was
 * picked up, became ready or was delivered since the customer allowed notifications. The
 * database marks each order + status as sent before we send, so nothing goes twice.
 */
export const maxDuration = 60;

type CareEvent = { order_id: string; step: string; order_number: string; decision: string | null; targets: PushTarget[] };
type Event = { order_id: string; status: string; order_number: string; items: number | null; first_name: string | null; targets: PushTarget[] };

export async function POST(request: NextRequest) {
  const key = request.headers.get("x-rhythm-key") ?? "";
  if (!rhythmReady() || key.length < 32 || !(await runKeyOk(key).catch(() => false))) {
    return NextResponse.json({ ok: false }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }
  const events = await supabaseRpc<Event[]>("website_push_order_events", { p_limit: 100 });
  let sent = 0;
  let failed = 0;
  for (const e of events) {
    await Promise.all(
      e.targets.slice(0, 10).map(async (t) => {
        const m = orderMessage(e.status, { orderNumber: e.order_number, items: e.items }, t.lang === "en" ? "en" : "bn");
        if (!m) return;
        if (await sendAndRecord(t, m)) sent++;
        else failed++;
      }),
    );
  }
  // Care approvals (website_care.sql). Until that SQL is applied the function is missing: skip.
  const care = await supabaseRpc<CareEvent[]>("website_push_care_events", { p_limit: 100 }).catch(() => [] as CareEvent[]);
  for (const e of care) {
    await Promise.all(
      e.targets.slice(0, 10).map(async (t) => {
        const m = careMessage(e.step, e.order_number, t.lang === "en" ? "en" : "bn");
        if (!m) return;
        if (await sendAndRecord(t, m)) sent++;
        else failed++;
      }),
    );
  }
  return NextResponse.json({ ok: true, orders: events.length, care: care.length, sent, failed }, { headers: { "Cache-Control": "no-store" } });
}
