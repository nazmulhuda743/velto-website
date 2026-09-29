import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { loginRedirectPath } from "@/lib/i18n/server";
import { EMPTY_PREFERENCES, parsePreferences, type Feedback, type Preferences } from "./extras";
import { parseCoupons, type GoalCoupon } from "./goal";
import { customerSupabase } from "./supabase";

export type LinkStatus = "none" | "pending" | "linked" | "rejected";

export type PortalAccount =
  /** `phone` is set (and verified) when the customer signed in with an SMS code. Email is null then. */
  | { state: "incomplete"; email: string | null; phone?: string | null; phoneVerified?: boolean }
  | {
      state: "ready";
      email: string | null;
      fullName: string;
      phone: string;
      /** The phone was proven by SMS code: it is the sign-in number and can't be edited. */
      phoneVerified?: boolean;
      address: string | null;
      area: string | null;
      link: { status: LinkStatus; requestedAt: string | null; decidedAt: string | null; verifiedPhone: string | null };
      veltoProfile: { name: string; phone: string; address: string | null; zone: string | null } | null;
    };

export type PortalOrder = {
  orderNumber: string;
  status: string;
  statusLabel: string;
  active: boolean;
  orderDate: string;
  pickupDate: string | null;
  deliveryDate: string | null;
  promisedAt: string | null;
  deliveredAt: string | null;
  services: string[];
  items: number | null;
  express: boolean;
  total: number;
  paid: number;
  due: number;
  paymentStatus: string | null;
  outlet: { code: string; name: string } | null;
};

export type PortalOrderDetail = PortalOrder & {
  lines: { item: string; service: string; quantity: number }[];
  timeline: { status: string; label: string; at: string }[];
};

export type CustomerSession =
  | { kind: "disabled" }
  | { kind: "anonymous" }
  | { kind: "unavailable" }
  | { kind: "staff"; user: User }
  | { kind: "customer"; user: User; account: PortalAccount };

/**
 * The signed-in customer for this request, verified with Supabase Auth (getUser checks the
 * token with the Auth server; the cookie alone is never trusted).
 */
export const getCustomerSession = cache(async (): Promise<CustomerSession> => {
  const supabase = await customerSupabase();
  if (!supabase) return { kind: "disabled" };
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    // Only a failed network call is "unavailable"; a missing or expired session is anonymous.
    return { kind: error?.name === "AuthRetryableFetchError" ? "unavailable" : "anonymous" };
  }
  const me = await supabase.rpc("portal_me");
  if (me.error) {
    if (me.error.code === "42501") return { kind: "staff", user: data.user };
    console.error("portal_me_failed", me.error.code);
    return { kind: "unavailable" };
  }
  return { kind: "customer", user: data.user, account: me.data as PortalAccount };
});

/** Account pages: bounce to sign-in (coming back here afterwards) unless a customer is signed in. */
export async function requireCustomer(nextPath: string) {
  const session = await getCustomerSession();
  if (session.kind === "anonymous") redirect(await loginRedirectPath(nextPath));
  return session;
}

export const getPortalOrders = cache(async (): Promise<PortalOrder[] | null> => {
  const supabase = await customerSupabase();
  if (!supabase) return null;
  const { data, error } = await supabase.rpc("portal_orders", { p_limit: 100 });
  if (error) {
    console.error("portal_orders_failed", error.code);
    return null;
  }
  return (data ?? []) as PortalOrder[];
});

/** null = not found or not this customer's (deliberately indistinguishable). */
export async function getPortalOrder(orderNumber: string): Promise<PortalOrderDetail | null | "error"> {
  const supabase = await customerSupabase();
  if (!supabase) return "error";
  const { data, error } = await supabase.rpc("portal_order_get", { p_order_number: orderNumber });
  if (error) {
    console.error("portal_order_failed", error.code);
    return "error";
  }
  return (data ?? null) as PortalOrderDetail | null;
}

/* ---------- loyalty, feedback and preferences (docs/technical/sql/website_customer_extras.sql) ---------- */

/** Orders in the last `months` and in total; null when unavailable (not installed, or an error). */
export const getLoyaltyCounts = cache(async (months: number): Promise<{ recent: number; total: number } | null> => {
  const supabase = await customerSupabase();
  if (!supabase) return null;
  const { data, error } = await supabase.rpc("portal_loyalty", { p_months: months });
  if (error) {
    console.error("portal_loyalty_failed", error.code);
    return null;
  }
  const d = (data ?? {}) as { linked?: boolean; recent?: number; total?: number };
  return d.linked ? { recent: Number(d.recent) || 0, total: Number(d.total) || 0 } : null;
});

export type DispatchPlan = { kind: "pickup" | "delivery"; orderNumber: string | null; slotDate: string; slot: "morning" | "afternoon" | "evening"; assigneeName: string | null };

/** Planned pickups and deliveries from the dispatch board (day + window + person); [] when none or unavailable. */
export const getDispatchPlans = cache(async (): Promise<DispatchPlan[]> => {
  const supabase = await customerSupabase();
  if (!supabase) return [];
  const { data, error } = await supabase.rpc("portal_dispatch_plans");
  if (error) {
    if (error.code !== "PGRST202") console.error("portal_dispatch_plans_failed", error.code);
    return [];
  }
  if (!Array.isArray(data)) return [];
  return data.filter(
    (p): p is DispatchPlan =>
      !!p && typeof p === "object" && ((p as DispatchPlan).kind === "pickup" || (p as DispatchPlan).kind === "delivery") &&
      /^\d{4}-\d{2}-\d{2}$/.test(String((p as DispatchPlan).slotDate)) && ["morning", "afternoon", "evening"].includes(String((p as DispatchPlan).slot)),
  );
});

export type GoalRead = { month: string; today: string; spend: number; orders: number; firstDoubled: number; coupons: GoalCoupon[] };

/** This month's spend and the coupons still valid; null when unavailable (not installed, not linked, or an error). */
export const getGoal = cache(async (doubleFirst: boolean): Promise<GoalRead | null> => {
  const supabase = await customerSupabase();
  if (!supabase) return null;
  const { data, error } = await supabase.rpc("portal_goal", { p_double: doubleFirst });
  if (error) {
    console.error("portal_goal_failed", error.code);
    return null;
  }
  const d = (data ?? {}) as Record<string, unknown>;
  if (d.linked !== true) return null;
  return {
    month: String(d.month ?? ""),
    today: String(d.today ?? ""),
    spend: Math.max(0, Math.round(Number(d.spend) || 0)),
    orders: Number(d.orders) || 0,
    firstDoubled: Math.max(0, Math.round(Number(d.firstDoubled) || 0)),
    coupons: parseCoupons(d.coupons),
  };
});

/** The customer's ratings; [] when none or unavailable (the account then simply asks again). */
export const getFeedbackList = cache(async (): Promise<Feedback[]> => {
  const supabase = await customerSupabase();
  if (!supabase) return [];
  const { data, error } = await supabase.rpc("portal_feedback_list");
  if (error) {
    console.error("portal_feedback_list_failed", error.code);
    return [];
  }
  return (data ?? []) as Feedback[];
});

export const getPreferences = cache(async (): Promise<Preferences> => {
  const supabase = await customerSupabase();
  if (!supabase) return EMPTY_PREFERENCES;
  const { data, error } = await supabase.rpc("portal_prefs_get");
  if (error) {
    console.error("portal_prefs_get_failed", error.code);
    return EMPTY_PREFERENCES;
  }
  return parsePreferences(data);
});

/* ---------- open website pickups (docs/technical/sql/website_customer_pickups.sql) ---------- */

export type PortalPickup = {
  id: string;
  reference: string;
  createdAt: string;
  /** The customer's wish as written ("Tomorrow Mon 28 Sep, Afternoon"). */
  requested: string | null;
  /** Set once Velto has planned a day and part of the day. */
  plannedDate: string | null;
  plannedSlot: "morning" | "afternoon" | "evening" | null;
  stage: "new" | "confirmed" | "assigned" | "scheduled";
  cutoffAt: string | null;
  changeable: boolean;
  changesLeft: number;
};

/** Open pickups for the caller's proven phone; null when unavailable (not installed, or an error). */
export const getPickups = cache(async (): Promise<{ verified: boolean; pickups: PortalPickup[] } | null> => {
  const supabase = await customerSupabase();
  if (!supabase) return null;
  const { data, error } = await supabase.rpc("portal_pickups");
  if (error) {
    console.error("portal_pickups_failed", error.code);
    return null;
  }
  const d = (data ?? {}) as { verified?: boolean; pickups?: PortalPickup[] };
  return { verified: Boolean(d.verified), pickups: d.pickups ?? [] };
});

/* ---------- welcome back: match preview (docs/technical/sql/website_identity_claim.sql) ---------- */

export type MatchPreview =
  | { state: "linked" | "unverified" | "none" | "rejected" | "assisted"; hasProfile: boolean }
  | { state: "recent"; hasProfile: boolean; firstName?: string; orders: number; lastOrder: string }
  | { state: "stepup"; hasProfile: boolean; attemptsLeft: number };

/** What may be said about the Velto record matching the proven phone; null when unavailable. */
export const getMatchPreview = cache(async (): Promise<MatchPreview | null> => {
  const supabase = await customerSupabase();
  if (!supabase) return null;
  const { data, error } = await supabase.rpc("portal_match_preview");
  if (error) {
    if (error.code !== "PGRST202") console.error("portal_match_preview_failed", error.code);
    return null;
  }
  return (data ?? null) as MatchPreview | null;
});
