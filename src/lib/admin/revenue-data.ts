import "server-only";

import { isSupabaseConfigured, supabaseFetch, supabaseRpc } from "../supabase-server";
import type { Loaded } from "./analytics-data";
import { isAdminPreview } from "./preview";
import { previewRevenue } from "./revenue-fixtures";
import type { ConversionRow, LeadRow, SpendInput, SpendRow, Totals } from "./revenue";

/**
 * Server-only reads/writes for revenue attribution. Every call goes through the
 * service role on the server; the browser never reaches these tables. Filters
 * are passed as validated PostgREST parameters or RPC arguments — never SQL.
 */

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const safe = (error: unknown) => {
  const m = error instanceof Error ? error.message : "";
  if (/HTTP 404/.test(m)) return "The revenue attribution tables are not installed in this database yet.";
  return "Revenue attribution data could not be read right now.";
};

function assertDays(from: string, to: string) {
  if (!DAY.test(from) || !DAY.test(to)) throw new Error("invalid range");
}

export type RevenueData = { conversions: ConversionRow[]; leads: LeadRow[]; totals: Totals; spend: SpendRow[] };

export async function getRevenueData(from: string, to: string): Promise<Loaded<RevenueData>> {
  assertDays(from, to);
  if (isAdminPreview()) return { state: "ok", data: previewRevenue(from, to), preview: true };
  if (!isSupabaseConfigured()) return { state: "not_configured" };
  try {
    const [conversions, leads, totals, spend] = await Promise.all([
      supabaseRpc<ConversionRow[]>("website_attribution_conversions", { p_from: from, p_to: to }),
      supabaseRpc<LeadRow[]>("website_attribution_leads", { p_from: from, p_to: to }),
      supabaseRpc<Totals>("website_attribution_totals", { p_from: from, p_to: to }),
      listSpend(from, to),
    ]);
    return { state: "ok", data: { conversions, leads, totals, spend } };
  } catch (error) {
    console.error("revenue_data_failed", error instanceof Error ? error.message : "unknown");
    return { state: "error", message: safe(error) };
  }
}

export async function listSpend(from: string, to: string): Promise<SpendRow[]> {
  assertDays(from, to);
  if (isAdminPreview()) return previewRevenue(from, to).spend;
  const params = new URLSearchParams({ select: "*", deleted_at: "is.null", order: "spend_date.desc,campaign_name.asc", limit: "5000" });
  params.append("spend_date", `gte.${from}`);
  params.append("spend_date", `lte.${to}`);
  const res = await supabaseFetch(`/rest/v1/website_marketing_spend?${params}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as SpendRow[];
}

export type WriteResult = { ok: true } | { ok: false; error: string };

const duplicateMessage = "An entry for this date, platform, campaign, ad set and ad already exists. Edit that entry instead.";

export async function insertSpend(rows: SpendInput[], actor: string, source: "manual" | "csv", batchId?: string): Promise<WriteResult> {
  if (isAdminPreview()) return { ok: false, error: "Preview mode does not save." };
  if (!rows.length) return { ok: true };
  const res = await supabaseFetch("/rest/v1/website_marketing_spend", {
    method: "POST",
    headers: { "Content-Type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify(rows.map((r) => ({ ...r, created_by: actor.slice(0, 120), import_source: source, import_batch_id: batchId ?? null }))),
    cache: "no-store",
  });
  if (res.status === 409) return { ok: false, error: duplicateMessage };
  if (!res.ok) return { ok: false, error: `Saving spend failed (HTTP ${res.status}).` };
  return { ok: true };
}

export async function updateSpend(id: string, row: SpendInput, actor: string): Promise<WriteResult> {
  if (!UUID.test(id)) return { ok: false, error: "Unknown entry." };
  if (isAdminPreview()) return { ok: false, error: "Preview mode does not save." };
  const res = await supabaseFetch(`/rest/v1/website_marketing_spend?id=eq.${id}&deleted_at=is.null`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify({ ...row, updated_at: new Date().toISOString(), updated_by: actor.slice(0, 120) }),
    cache: "no-store",
  });
  if (res.status === 409) return { ok: false, error: duplicateMessage };
  if (!res.ok) return { ok: false, error: `Updating spend failed (HTTP ${res.status}).` };
  return { ok: true };
}

/** Soft delete: the row stays for audit but no longer counts. */
export async function deleteSpend(id: string, actor: string): Promise<WriteResult> {
  if (!UUID.test(id)) return { ok: false, error: "Unknown entry." };
  if (isAdminPreview()) return { ok: false, error: "Preview mode does not save." };
  const res = await supabaseFetch(`/rest/v1/website_marketing_spend?id=eq.${id}&deleted_at=is.null`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify({ deleted_at: new Date().toISOString(), deleted_by: actor.slice(0, 120) }),
    cache: "no-store",
  });
  if (!res.ok) return { ok: false, error: `Deleting spend failed (HTTP ${res.status}).` };
  return { ok: true };
}

export type ReviewItem = {
  issue: "name_mismatch" | "staff_link_other_customer" | "order_claimed_by_other_lead" | "multiple_identifiers" | "staff_order_not_found" | "unresolved_lead";
  link_id: string | null;
  lead_id: string;
  lead_reference: string;
  lead_kind: "booking" | "quote";
  lead_created_at: string;
  link_method: string | null;
  link_status: string | null;
  customer_ref: string | null;
  order_number: string | null;
  staff_order_number: string | null;
  detail: string | null;
};

export async function getReviewQueue(): Promise<Loaded<ReviewItem[]>> {
  if (isAdminPreview()) return { state: "ok", data: previewRevenue("2026-01-01", "2026-12-31").review, preview: true };
  if (!isSupabaseConfigured()) return { state: "not_configured" };
  try {
    return { state: "ok", data: await supabaseRpc<ReviewItem[]>("website_attribution_review", {}) };
  } catch (error) {
    return { state: "error", message: safe(error) };
  }
}

export async function reviewLink(linkId: string, action: "confirm" | "reject" | "reverse", actor: string, note: string): Promise<WriteResult> {
  if (!UUID.test(linkId)) return { ok: false, error: "Unknown link." };
  if (isAdminPreview()) return { ok: false, error: "Preview mode does not save." };
  const r = await supabaseRpc<{ ok: boolean; error?: string }>("website_review_link", {
    p_link_id: linkId,
    p_action: action,
    p_actor: actor.slice(0, 120),
    p_note: note.slice(0, 200) || null,
  });
  return r.ok ? { ok: true } : { ok: false, error: r.error === "not_live" ? "This link was already changed." : "The link could not be updated." };
}

export async function runMatching(): Promise<{ ok: true; summary: { linked: number; updated: number; superseded: number } } | { ok: false; error: string }> {
  if (isAdminPreview()) return { ok: false, error: "Preview mode does not run matching." };
  try {
    const r = await supabaseRpc<{ linked: number; updated: number; superseded: number }>("website_match_leads", { p_lookback_days: 120 });
    return { ok: true, summary: r };
  } catch {
    return { ok: false, error: "Matching could not run right now." };
  }
}
