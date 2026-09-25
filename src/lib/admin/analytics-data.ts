import "server-only";

import { cache } from "react";
import { isAnalyticsWritesEnabled } from "../analytics/store";
import { isSupabaseConfigured, supabaseFetch, supabaseRpc } from "../supabase-server";
import { getWebsiteRequests, type WebsiteRequest } from "./data";
import type { ConsentSummary, DateRange, SessionRow } from "./insights";
import { isAdminPreview } from "./preview";
import { previewConsent, previewRequests, previewSessions } from "./preview-fixtures";

/**
 * Server-side reads for the Command Center. Every loader degrades to an
 * explicit state instead of throwing, so a missing table or an unreachable
 * database shows an honest empty state — never invented numbers.
 */

export type Loaded<T> =
  | { state: "ok"; data: T; preview?: boolean }
  | { state: "not_configured" }
  | { state: "error"; message: string };

const SESSION_LIMIT = 20_000;

const safeMessage = (error: unknown) => {
  const m = error instanceof Error ? error.message : "";
  if (/HTTP 404/.test(m)) return "The analytics tables are not installed in this database yet.";
  if (/timeout|abort/i.test(m)) return "The database did not answer in time.";
  return "The analytics database could not be read right now.";
};

export const getSessions = cache(async (fromIso: string, toIso: string): Promise<Loaded<{ rows: SessionRow[]; truncated: boolean }>> => {
  if (isAdminPreview()) {
    const rows = previewSessions().filter((s) => s.started_at >= fromIso && s.started_at < toIso);
    return { state: "ok", data: { rows, truncated: false }, preview: true };
  }
  if (!isSupabaseConfigured()) return { state: "not_configured" };
  try {
    const rows = await supabaseRpc<SessionRow[]>("website_analytics_sessions", { p_from: fromIso, p_to: toIso, p_limit: SESSION_LIMIT });
    return { state: "ok", data: { rows: Array.isArray(rows) ? rows : [], truncated: Array.isArray(rows) && rows.length >= SESSION_LIMIT } };
  } catch (error) {
    console.error("admin_sessions_failed", error instanceof Error ? error.message : "unknown");
    return { state: "error", message: safeMessage(error) };
  }
});

export const sessionsFor = (range: Pick<DateRange, "from" | "to">) => getSessions(range.from.toISOString(), range.to.toISOString());

export async function getConsentSummary(range: DateRange): Promise<Loaded<ConsentSummary>> {
  if (isAdminPreview()) return { state: "ok", data: previewConsent(range.days), preview: true };
  if (!isSupabaseConfigured()) return { state: "not_configured" };
  try {
    const data = await supabaseRpc<ConsentSummary>("website_consent_summary", { p_from: range.from.toISOString(), p_to: range.to.toISOString() });
    return { state: "ok", data };
  } catch (error) {
    return { state: "error", message: safeMessage(error) };
  }
}

export type AnalyticsHealth = {
  last_event_at: string | null;
  last_page_view_at: string | null;
  last_booking_success_at: string | null;
  last_quote_success_at: string | null;
  last_consent_at: string | null;
  events_24h: number;
  marketing_events_24h: number;
};

export const getAnalyticsHealth = cache(async (): Promise<Loaded<AnalyticsHealth>> => {
  if (isAdminPreview()) {
    const rows = previewSessions();
    const last = (event: string) => rows.find((s) => s.events_seen?.includes(event))?.ended_at ?? null;
    return {
      state: "ok",
      preview: true,
      data: {
        last_event_at: rows[0]?.ended_at ?? null,
        last_page_view_at: rows[0]?.ended_at ?? null,
        last_booking_success_at: last("booking_success"),
        last_quote_success_at: last("quote_success"),
        last_consent_at: rows[0]?.started_at ?? null,
        events_24h: rows.filter((s) => Date.now() - Date.parse(s.started_at) < 86_400_000).reduce((a, s) => a + s.event_count, 0),
        marketing_events_24h: 0,
      },
    };
  }
  if (!isSupabaseConfigured()) return { state: "not_configured" };
  try {
    return { state: "ok", data: await supabaseRpc<AnalyticsHealth>("website_analytics_health", {}) };
  } catch (error) {
    return { state: "error", message: safeMessage(error) };
  }
});

export type ServerEvent = { id: number; occurred_at: string; kind: string; route: string | null; code: string | null; path: string | null };

export const getServerEvents = cache(async (days = 7): Promise<Loaded<ServerEvent[]>> => {
  if (isAdminPreview()) {
    const now = Date.now();
    const at = (h: number) => new Date(now - h * 3_600_000).toISOString();
    return {
      state: "ok",
      preview: true,
      data: [
        { id: 3, occurred_at: at(2), kind: "not_found", route: "page", code: null, path: "/services/curtains" },
        { id: 2, occurred_at: at(20), kind: "pricing_error", route: "/api/prices", code: "unavailable", path: null },
        { id: 1, occurred_at: at(52), kind: "not_found", route: "page", code: null, path: "/offer" },
      ],
    };
  }
  if (!isSupabaseConfigured()) return { state: "not_configured" };
  try {
    const params = new URLSearchParams({
      select: "id,occurred_at,kind,route,code,path",
      occurred_at: `gte.${new Date(Date.now() - days * 86_400_000).toISOString()}`,
      order: "occurred_at.desc",
      limit: "300",
    });
    const res = await supabaseFetch(`/rest/v1/website_server_events?${params}`, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return { state: "ok", data: (await res.json()) as ServerEvent[] };
  } catch (error) {
    return { state: "error", message: safeMessage(error) };
  }
});

/** Website requests from Velto Ops (preview: synthetic). */
export const getRequests = cache(async (limit = 500): Promise<Loaded<WebsiteRequest[]>> => {
  if (isAdminPreview()) return { state: "ok", data: previewRequests(), preview: true };
  if (!isSupabaseConfigured()) return { state: "not_configured" };
  try {
    return { state: "ok", data: await getWebsiteRequests(limit) };
  } catch {
    return { state: "error", message: "Couldn't load requests from Velto Ops right now." };
  }
});

export type HealthMemory = Record<string, { last_ok_at: string | null }>;

/** Remember each check's outcome so the Health Center can show the latest successful check. */
export async function recordHealthChecks(results: { id: string; status: "healthy" | "warning" | "error" }[]): Promise<HealthMemory> {
  if (isAdminPreview() || !isSupabaseConfigured()) return {};
  const now = new Date().toISOString();
  try {
    const params = new URLSearchParams({ select: "check_id,last_ok_at" });
    const res = await supabaseFetch(`/rest/v1/website_health_checks?${params}`, { cache: "no-store" });
    const existing = res.ok ? ((await res.json()) as { check_id: string; last_ok_at: string | null }[]) : [];
    const memory: HealthMemory = Object.fromEntries(existing.map((r) => [r.check_id, { last_ok_at: r.last_ok_at }]));
    const rows = results.map((r) => ({
      check_id: r.id,
      status: r.status,
      last_checked_at: now,
      last_ok_at: r.status === "healthy" ? now : (memory[r.id]?.last_ok_at ?? null),
    }));
    if (res.ok) {
      await supabaseFetch("/rest/v1/website_health_checks?on_conflict=check_id", {
        method: "POST",
        headers: { "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal" },
        body: JSON.stringify(rows),
        cache: "no-store",
      });
    }
    return Object.fromEntries(rows.map((r) => [r.check_id, { last_ok_at: r.last_ok_at }]));
  } catch {
    return {};
  }
}

export { isAnalyticsWritesEnabled };
