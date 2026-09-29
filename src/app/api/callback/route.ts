import { after, NextResponse, type NextRequest } from "next/server";
import { notifyNewRequest } from "@/lib/admin/dispatch";
import { readSubmissionAttribution } from "@/lib/attribution";
import { callbackPush, validateCallback } from "@/lib/booking-recovery";
import { readBoundedJson } from "@/lib/security/json-request";
import { SITE_URL } from "@/lib/site-url";
import { supabaseRpc } from "@/lib/supabase-server";

/**
 * "Get a call back" from the booking form (docs/technical/sql/website_callbacks.sql). Only what the
 * visitor chose to send: name, phone and what they had filled in, plus the same allowlisted
 * attribution as a booking. Same switch as bookings (VELTO_OPS_WRITES_ENABLED): off → 501.
 *   POST { data: { name, phone, area?, what?, services?, preferred?, attribution? }, idempotencyKey }
 *   → 200 { ok: true } · 400 invalid (+ field) · 429 too many today · 501 not switched on · 502
 */
const reply = (body: Record<string, unknown>, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

export async function POST(request: NextRequest) {
  const body = await readBoundedJson(request, 8 * 1024);
  if (!body.ok) return reply({ ok: false, error: "invalid_request" }, body.status);
  const input = (body.value ?? {}) as Record<string, unknown>;
  const key = typeof input.idempotencyKey === "string" && /^[A-Za-z0-9._:-]{16,128}$/.test(input.idempotencyKey) ? input.idempotencyKey : null;
  const data = input.data && typeof input.data === "object" ? (input.data as Record<string, unknown>) : null;
  const parsed = validateCallback(data);
  if (!key || !parsed.ok) return reply({ ok: false, error: "invalid_request", field: parsed.ok ? "request" : parsed.field }, 400);

  if (process.env.VELTO_OPS_WRITES_ENABLED !== "true" || !process.env.VELTO_SUPABASE_URL || !process.env.VELTO_SUPABASE_SECRET_KEY) {
    return reply({ ok: false, error: "not_connected" }, 501);
  }

  const a = readSubmissionAttribution(data?.attribution && typeof data.attribution === "object" ? (data.attribution as Record<string, unknown>) : null);
  try {
    const result = await supabaseRpc<{ ok?: boolean; error?: string; existing?: boolean }>("website_callback_create", {
      p_dedupe_key: `callback:${key}`.slice(0, 128),
      p_payload: {
        ...parsed.value,
        utm_source: a.utm_source,
        utm_medium: a.utm_medium,
        utm_campaign: a.utm_campaign,
        landing_page: a.landing_page,
        referrer_host: a.referrer,
        device: a.device,
      },
    });
    if (result?.ok) {
      // A new request tells the managers now, after the response (best effort); a repeat doesn't.
      if (!result.existing) after(() => notifyNewRequest(callbackPush(parsed.value, SITE_URL)));
      return reply({ ok: true });
    }
    if (result?.error === "rate_limited") return reply({ ok: false, error: "rate_limited" }, 429);
    if (result?.error === "invalid") return reply({ ok: false, error: "invalid_request", field: "request" }, 400);
    return reply({ ok: false, error: "unavailable" }, 502);
  } catch (error) {
    console.error("callback_failed", error instanceof Error ? error.message.slice(0, 120) : "unknown");
    return reply({ ok: false, error: "unavailable" }, 502);
  }
}
