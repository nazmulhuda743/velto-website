import "server-only";

import { parsePublicPricingRows } from "../integrations/pricing/validation";
import type { PublicPriceItem } from "../integrations/pricing/types";
import { supabaseFetch, supabaseRpc } from "../supabase-server";

export type WebsiteRequest = {
  id: string;
  title: string;
  type: string;
  status: string;
  source: "website_booking" | "website_quote";
  outlet_code: string | null;
  description: string | null;
  created_at: string;
  done_at: string | null;
  done_by_name: string | null;
};

/** Website bookings and quotes, as they sit in the Velto Ops task list. */
export async function getWebsiteRequests(limit = 200): Promise<WebsiteRequest[]> {
  const params = new URLSearchParams({
    select: "id,title,type,status,source,outlet_code,description,created_at,done_at,done_by_name",
    source: "in.(website_booking,website_quote)",
    order: "created_at.desc",
    limit: String(limit),
  });
  const res = await supabaseFetch(`/rest/v1/tasks?${params}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Requests failed with HTTP ${res.status}`);
  return (await res.json()) as WebsiteRequest[];
}

/** The full public price list (same view the website reads). */
export async function getAllPrices(): Promise<PublicPriceItem[]> {
  const params = new URLSearchParams({
    select: "item_slug,item_name,service_slug,service_name,price_amount_minor,currency,unit_label",
    order: "item_name.asc,service_name.asc",
    limit: "2000",
  });
  const view = process.env.VELTO_PRICING_VIEW || "website_pricing_public";
  const res = await supabaseFetch(`/rest/v1/${view}?${params}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Prices failed with HTTP ${res.status}`);
  return parsePublicPricingRows(await res.json());
}

export type LinkRequest = {
  authUserId: string;
  email: string;
  fullName: string;
  phone: string;
  area: string | null;
  status: "none" | "pending" | "linked" | "rejected";
  requestedAt: string | null;
  decidedAt: string | null;
  decidedBy: string | null;
  linkedCustomer: { id: string; name: string; phone: string } | null;
  candidate: { id: string; name: string; phone: string; code: string | null; zone: string | null; orders: number; lastOrder: string | null; alreadyLinked: boolean } | null;
};

/** Customer-account link requests (service role only; never exposed to customers). */
export async function getLinkRequests(status: "pending" | "all") {
  return supabaseRpc<LinkRequest[]>("portal_link_requests", { p_status: status });
}
