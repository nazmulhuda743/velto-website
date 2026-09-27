import "server-only";

import { isSupabaseConfigured, supabaseRpc } from "../supabase-server";
import type { FeedbackIssue } from "../customer/extras";
import type { Loaded } from "./analytics-data";
import { isAdminPreview } from "./preview";

/**
 * Customer feedback and loyalty numbers for the dashboard
 * (docs/technical/sql/website_customer_extras.sql). Service role only: names and phones on the
 * feedback list stay on the admin server and on the Customer feedback page.
 */

export type FeedbackRow = {
  id: string;
  orderNumber: string;
  rating: number;
  issues: FeedbackIssue[];
  comment: string | null;
  createdAt: string;
  updatedAt: string;
  handledAt: string | null;
  handledBy: string | null;
  taskId: string | null;
  customerName: string | null;
  customerPhone: string | null;
};

export type LoyaltyDistribution = { customers: number; spend: number; tiers: { tier: number; customers: number; spend: number }[] };

const NOT_INSTALLED = "Customer feedback and loyalty aren't installed in this database yet (docs/technical/sql/website_customer_extras.sql).";
const safeMessage = (error: unknown) => {
  const m = error instanceof Error ? error.message : "";
  if (/HTTP 404/.test(m)) return NOT_INSTALLED;
  if (/timeout|abort/i.test(m)) return "The database did not answer in time.";
  return "This could not be read right now.";
};

const ago = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString();
const previewFeedback = (): FeedbackRow[] => [
  { id: "p1", orderNumber: "VEL-01234", rating: 2, issues: ["stain", "late"], comment: "Collar still had the mark.", createdAt: ago(3), updatedAt: ago(3), handledAt: null, handledBy: null, taskId: null, customerName: "Preview Customer One", customerPhone: "01700000001" },
  { id: "p2", orderNumber: "VEL-01230", rating: 5, issues: [], comment: "Very neat folding.", createdAt: ago(20), updatedAt: ago(20), handledAt: null, handledBy: null, taskId: null, customerName: "Preview Customer Two", customerPhone: "01700000002" },
  { id: "p3", orderNumber: "VEL-01211", rating: 3, issues: ["ironing"], comment: null, createdAt: ago(60), updatedAt: ago(60), handledAt: ago(40), handledBy: "Preview admin", taskId: null, customerName: "Preview Customer Three", customerPhone: null },
  { id: "p4", orderNumber: "VEL-01199", rating: 4, issues: [], comment: null, createdAt: ago(90), updatedAt: ago(90), handledAt: null, handledBy: null, taskId: null, customerName: "Preview Customer Four", customerPhone: "01700000004" },
];

export async function getFeedback(limit = 300): Promise<Loaded<FeedbackRow[]>> {
  if (isAdminPreview()) return { state: "ok", data: previewFeedback(), preview: true };
  if (!isSupabaseConfigured()) return { state: "not_configured" };
  try {
    return { state: "ok", data: await supabaseRpc<FeedbackRow[]>("website_feedback_list", { p_limit: limit }) };
  } catch (error) {
    return { state: "error", message: safeMessage(error) };
  }
}

/** Ratings of 3 or less nobody has marked handled yet (the menu badge). */
export async function openFeedbackCount(): Promise<number> {
  const rows = await getFeedback(300);
  return rows.state === "ok" ? rows.data.filter((r) => r.rating <= 3 && !r.handledAt).length : 0;
}

export async function markFeedbackHandled(id: string, staff: string): Promise<boolean> {
  return supabaseRpc<boolean>("website_feedback_handle", { p_id: id, p_staff: staff });
}

export async function getLoyaltyDistribution(months: number, mins: number[]): Promise<Loaded<LoyaltyDistribution>> {
  if (isAdminPreview()) {
    return {
      state: "ok",
      preview: true,
      data: { customers: 731, spend: 1037579, tiers: [ { tier: 1, customers: 572, spend: 419000 }, { tier: 2, customers: 89, spend: 220000 }, { tier: 3, customers: 47, spend: 230000 }, { tier: 4, customers: 23, spend: 168579 } ] },
    };
  }
  if (!isSupabaseConfigured()) return { state: "not_configured" };
  try {
    return { state: "ok", data: await supabaseRpc<LoyaltyDistribution>("website_loyalty_distribution", { p_months: months, p_mins: mins }) };
  } catch (error) {
    return { state: "error", message: safeMessage(error) };
  }
}

/** Orders per phone (01XXXXXXXXX), for the dispatch board's tier badge. {} when unavailable. */
export async function getOrderCounts(phones: string[], months: number): Promise<Record<string, { recent: number; total: number }>> {
  const unique = [...new Set(phones.filter((p) => /^01\d{9}$/.test(p)))].slice(0, 500);
  if (!unique.length || isAdminPreview() || !isSupabaseConfigured()) return {};
  try {
    return await supabaseRpc<Record<string, { recent: number; total: number }>>("website_customer_order_counts", { p_phones: unique, p_months: months });
  } catch {
    return {};
  }
}
