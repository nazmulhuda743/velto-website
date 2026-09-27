import "server-only";

import { isSupabaseConfigured, supabaseRpc } from "../supabase-server";
import type { FeedbackIssue } from "../customer/extras";
import type { GoalCoupon, GoalRung } from "../customer/goal";
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

/* ---------- monthly goal coupons (docs/technical/sql/website_monthly_goal.sql) ---------- */

export type CouponRow = GoalCoupon & {
  spend: number;
  orderNumber: string | null;
  usedBy: string | null;
  usedAt: string | null;
  createdAt: string;
  customerName: string | null;
  customerPhone: string | null;
};

export type SettleResult =
  | { ok: true; month: string; reached: number; issued: number; expired: number; validFrom: string; validTo: string }
  | { ok: false; error: string };

const GOAL_NOT_INSTALLED = "The monthly goal isn't installed in this database yet (docs/technical/sql/website_monthly_goal.sql).";

const previewCoupons = (): CouponRow[] => {
  const month = new Date(Date.now() - 20 * 86_400_000).toISOString().slice(0, 7);
  const next = new Date(Date.now() + 10 * 86_400_000).toISOString().slice(0, 7);
  return [
    { id: "c1", code: "VG-7K2P9Q", kind: "taka", amount: 200, label: "৳200 off an order next month", labelBn: "", month, spend: 1720, validFrom: `${next}-01`, validTo: `${next}-30`, status: "open", orderNumber: null, usedBy: null, usedAt: null, createdAt: ago(30), customerName: "Preview Customer One", customerPhone: "01700000001" },
    { id: "c2", code: "VG-3M8XZA", kind: "delivery", amount: 0, label: "Free pickup & delivery on every order next month", labelBn: "", month, spend: 940, validFrom: `${next}-01`, validTo: `${next}-30`, status: "open", orderNumber: null, usedBy: null, usedAt: null, createdAt: ago(30), customerName: "Preview Customer Two", customerPhone: "01700000002" },
    { id: "c3", code: "VG-QQ12AB", kind: "taka", amount: 400, label: "৳400 off an order next month", labelBn: "", month, spend: 2610, validFrom: `${next}-01`, validTo: `${next}-30`, status: "used", orderNumber: "VEL-01240", usedBy: "Preview admin", usedAt: ago(5), createdAt: ago(30), customerName: "Preview Customer Three", customerPhone: "01700000003" },
  ];
};

export async function getGoalCoupons(limit = 300): Promise<Loaded<CouponRow[]>> {
  if (isAdminPreview()) return { state: "ok", data: previewCoupons(), preview: true };
  if (!isSupabaseConfigured()) return { state: "not_configured" };
  try {
    return { state: "ok", data: await supabaseRpc<CouponRow[]>("website_goal_coupons", { p_limit: limit }) };
  } catch (error) {
    const m = error instanceof Error ? error.message : "";
    return { state: "error", message: /HTTP 404/.test(m) ? GOAL_NOT_INSTALLED : safeMessage(error) };
  }
}

/** How many customers reached each rung in a month (for setting the ladder, and before issuing). */
export async function previewGoal(month: string, rungs: GoalRung[], doubleFirst: boolean): Promise<Loaded<{ customers: number; spend: number; rungs: { rung: number; customers: number }[] }>> {
  if (isAdminPreview()) return { state: "ok", preview: true, data: { customers: 388, spend: 214000, rungs: rungs.map((_, i) => ({ rung: i + 1, customers: [61, 24, 9, 3][i] ?? 1 })) } };
  if (!isSupabaseConfigured()) return { state: "not_configured" };
  try {
    return { state: "ok", data: await supabaseRpc("website_goal_preview", { p_month: month, p_ladder: rungs, p_double: doubleFirst }) };
  } catch (error) {
    const m = error instanceof Error ? error.message : "";
    return { state: "error", message: /HTTP 404/.test(m) ? GOAL_NOT_INSTALLED : safeMessage(error) };
  }
}

export async function settleGoal(month: string, rungs: GoalRung[], doubleFirst: boolean): Promise<SettleResult> {
  if (isAdminPreview()) return { ok: true, month, reached: 12, issued: 0, expired: 0, validFrom: "", validTo: "" };
  if (!isSupabaseConfigured()) return { ok: false, error: "The database isn't configured." };
  try {
    const r = await supabaseRpc<SettleResult>("website_goal_settle", { p_month: month, p_ladder: rungs, p_double: doubleFirst });
    if (!r.ok) return { ok: false, error: r.error === "month_not_over" ? "That month isn't over yet." : r.error === "no_ladder" ? "Set the ladder on Loyalty first." : "Couldn't issue coupons." };
    return r;
  } catch (error) {
    const m = error instanceof Error ? error.message : "";
    return { ok: false, error: /HTTP 404/.test(m) ? GOAL_NOT_INSTALLED : safeMessage(error) };
  }
}

export async function markCoupon(id: string, status: "used" | "void" | "open", order: string | null, staff: string): Promise<boolean> {
  if (isAdminPreview()) return true;
  return supabaseRpc<boolean>("website_goal_coupon_mark", { p_id: id, p_status: status, p_order: order, p_staff: staff });
}
