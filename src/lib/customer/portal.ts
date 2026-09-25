import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { customerSupabase } from "./supabase";

export type LinkStatus = "none" | "pending" | "linked" | "rejected";

export type PortalAccount =
  | { state: "incomplete"; email: string }
  | {
      state: "ready";
      email: string;
      fullName: string;
      phone: string;
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
  if (session.kind === "anonymous") redirect(`/login?next=${encodeURIComponent(nextPath)}`);
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
