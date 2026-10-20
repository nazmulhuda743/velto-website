import "server-only";

import { isSupabaseConfigured, supabaseFetch } from "../supabase-server";
import type { Loaded } from "./analytics-data";
import { APP_REPORT_EVENTS, previewAppEvents, type AppEventRow } from "./app-metrics";
import { isAdminPreview } from "./preview";

const LIMIT = 20_000;

/** The app's first-party events in a range (path /app/…, the report's events only), newest first. */
export async function getAppEvents(from: Date, to: Date): Promise<Loaded<{ rows: AppEventRow[]; truncated: boolean }>> {
  if (isAdminPreview()) return { state: "ok", data: { rows: previewAppEvents(from, to), truncated: false }, preview: true };
  if (!isSupabaseConfigured()) return { state: "not_configured" };
  const q = new URLSearchParams({
    // `*` keeps the read working before docs/technical/sql/website_analytics_lang.sql adds `lang`.
    select: "*",
    path: "like./app/*",
    event: `in.(${APP_REPORT_EVENTS.join(",")})`,
    order: "occurred_at.desc",
    limit: String(LIMIT),
  });
  q.append("occurred_at", `gte.${from.toISOString()}`);
  q.append("occurred_at", `lt.${to.toISOString()}`);
  try {
    const res = await supabaseFetch(`/rest/v1/website_analytics_events?${q}`, { cache: "no-store", signal: AbortSignal.timeout(8_000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const raw = (await res.json()) as AppEventRow[];
    const rows = (Array.isArray(raw) ? raw : []).map((r) => ({
      occurred_at: r.occurred_at,
      visitor_id: r.visitor_id,
      session_id: r.session_id,
      event: r.event,
      path: r.path,
      placement: r.placement ?? null,
      detail: r.detail ?? null,
      lang: r.lang ?? null,
    }));
    return { state: "ok", data: { rows, truncated: rows.length >= LIMIT } };
  } catch (error) {
    console.error("admin_app_events_failed", error instanceof Error ? error.message : "unknown");
    return { state: "error", message: "The app's events could not be read right now." };
  }
}
