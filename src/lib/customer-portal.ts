import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

export type PortalLinkStatus = "none" | "pending" | "linked" | "rejected";
export type PortalProfile = {
  state: "ready" | "unlinked" | string;
  email: string | null;
  fullName: string | null;
  phone: string | null;
  address: string | null;
  area: string | null;
  link: {
    status: PortalLinkStatus;
    verifiedPhone?: string | null;
    requestedAt?: string | null;
    decidedAt?: string | null;
  };
  veltoProfile?: { name?: string | null; phone?: string | null; address?: string | null; zone?: string | null } | null;
};

export type PortalOrder = {
  orderNumber: string;
  orderDate: string | null;
  pickupDate: string | null;
  deliveryDate: string | null;
  promisedAt: string | null;
  deliveredAt: string | null;
  services: string[] | null;
  items: number | null;
  status: string;
  statusLabel: string;
  active: boolean;
  express: boolean;
  total: number | null;
  paid: number | null;
  due: number | null;
  paymentStatus: string | null;
  outlet: { code?: string | null; name?: string | null } | null;
};

export type PortalOrderDetail = PortalOrder & {
  timeline?: Array<{ status: string; label: string; at: string | null }>;
  lines?: Array<{ item: string; service: string; quantity: number }>;
};

async function rpc<T>(supabase: SupabaseClient, name: string, args?: Record<string, unknown>) {
  const { data, error } = await supabase.rpc(name, args);
  if (error) throw new Error(`portal_rpc_failed:${name}`);
  return data as T;
}

export const portalMe = (supabase: SupabaseClient) => rpc<PortalProfile>(supabase, "portal_me");
export const portalOrders = (supabase: SupabaseClient, limit = 50) => rpc<PortalOrder[]>(supabase, "portal_orders", { p_limit: limit });

export async function portalOrder(supabase: SupabaseClient, orderNumber: string) {
  const ref = orderNumber.toUpperCase();
  if (!/^VELR?-\d{5}$/.test(ref)) return null;
  return rpc<PortalOrderDetail | null>(supabase, "portal_order_get", { p_order_number: ref });
}

export async function savePortalProfile(
  supabase: SupabaseClient,
  input: { fullName: string; phone: string | null; address: string | null; area: string | null; termsVersion?: string | null },
) {
  return rpc<PortalProfile>(supabase, "portal_profile_save", {
    p_full_name: input.fullName,
    p_phone: input.phone,
    p_address: input.address,
    p_area: input.area,
    p_terms_version: input.termsVersion ?? null,
  });
}

export const requestHistoryLink = (supabase: SupabaseClient) => rpc<unknown>(supabase, "portal_request_link");
export const touchPortalLogin = (supabase: SupabaseClient) => rpc<unknown>(supabase, "portal_touch_login");
