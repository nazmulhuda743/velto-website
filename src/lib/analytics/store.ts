import "server-only";

import { isSupabaseConfigured, supabaseFetch } from "../supabase-server";
import type { CollectBody } from "./collect-validation";

/**
 * Website analytics writes (behavioral events, anonymous consent decisions and
 * server health events) are off unless WEBSITE_ANALYTICS_WRITES_ENABLED is
 * exactly "true". Mirrors VELTO_OPS_WRITES_ENABLED: nothing is stored until the
 * production activation plan (docs/technical/COMMAND-CENTER.md) is approved.
 */
export const isAnalyticsWritesEnabled = () =>
  process.env.WEBSITE_ANALYTICS_WRITES_ENABLED === "true" && isSupabaseConfigured();

const WRITE_TIMEOUT_MS = 2_500;

async function insert(table: string, rows: Record<string, unknown>[]) {
  const res = await supabaseFetch(`/rest/v1/${table}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify(rows),
    cache: "no-store",
    signal: AbortSignal.timeout(WRITE_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`${table} insert failed with HTTP ${res.status}`);
}

/** Store a validated /api/collect body. `marketing` comes from the server-read consent cookie. */
export async function storeCollected(body: CollectBody, marketing: boolean) {
  if (body.type === "events") {
    const a = body.attribution;
    await insert(
      "website_analytics_events",
      body.events.map((e) => ({
        visitor_id: body.visitorId,
        session_id: body.sessionId,
        event: e.event,
        path: e.path,
        service: e.service,
        placement: e.placement,
        detail: e.detail,
        landing_page: a.landing_page,
        referrer_host: a.referrer_host,
        utm_source: a.utm_source,
        utm_medium: a.utm_medium,
        utm_campaign: a.utm_campaign,
        utm_content: a.utm_content,
        utm_term: a.utm_term,
        click_id: marketing ? a.click_id : null,
        device: body.device,
        is_new_visitor: body.isNew,
        consent_marketing: marketing,
      })),
    );
  } else if (body.type === "consent") {
    await insert("website_consent_events", [
      {
        action: body.action,
        analytics: body.analytics,
        marketing: body.marketing,
        policy_version: body.version,
        device: body.device,
      },
    ]);
  } else {
    await insert("website_server_events", [{ kind: "not_found", route: "page", path: body.path }]);
  }
}

export type ServerEventKind =
  | "booking_error"
  | "quote_error"
  | "pricing_error"
  | "tracking_error"
  | "media_upload_error"
  | "content_save_error";

/**
 * Record a website failure for the Health Center. Never throws and never
 * blocks the caller for long: logging must not make a failing request worse.
 * Only a kind, route and safe error code are stored — no payloads.
 */
export async function logServerEvent(kind: ServerEventKind, route: string, code?: string) {
  if (!isAnalyticsWritesEnabled()) return;
  try {
    await insert("website_server_events", [
      { kind, route: route.slice(0, 120), code: code ? code.replace(/[^\w.-]/g, "").slice(0, 60) : null },
    ]);
  } catch (error) {
    console.error("server_event_log_failed", error instanceof Error ? error.message : "unknown");
  }
}
