import "server-only";

import { isSupabaseConfigured, supabaseFetch } from "../supabase-server";
import type { Loaded } from "./analytics-data";
import type { PriceFields, PriceRow } from "./price-diff";
import { isAdminPreview } from "./preview";

/**
 * Price list editing with Owner approval (docs/technical/sql/website_price_changes.sql).
 * Approved changes are written to the Velto Ops price_list, so Ops billing and the website
 * always match. Every call is service-role, from the admin server only.
 */

export type PendingInfo = { id: string; kind: ChangeKind; by: string; at: string };
export type AdminPriceRow = PriceRow & { pending: PendingInfo | null };
export type ChangeKind = "add" | "edit" | "remove" | "restore";
export type ChangeStatus = "pending" | "approved" | "rejected" | "cancelled";

export type PriceChange = {
  id: string;
  kind: ChangeKind;
  price_id: number | null;
  proposed: Partial<PriceFields>;
  before: PriceRow | null;
  current: PriceRow | null;
  reason: string | null;
  status: ChangeStatus;
  requested_by_id: string | null;
  requested_by_name: string;
  requested_by_role: string;
  requested_at: string;
  decided_by_name: string | null;
  decided_at: string | null;
  decision_note: string | null;
  result_price_id: number | null;
};

const NOT_INSTALLED = "Price editing isn't installed in this database yet (docs/technical/sql/website_price_changes.sql).";

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<{ ok: true; data: T } | { ok: false; status: number; message: string }> {
  try {
    const res = await supabaseFetch(`/rest/v1/rpc/${fn}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(args),
      cache: "no-store",
    });
    if (res.ok) return { ok: true, data: (await res.json()) as T };
    const body = (await res.json().catch(() => null)) as { message?: string } | null;
    return { ok: false, status: res.status, message: res.status === 404 ? NOT_INSTALLED : (body?.message ?? `Failed with HTTP ${res.status}`).slice(0, 200) };
  } catch {
    return { ok: false, status: 0, message: "The database did not answer. Try again." };
  }
}

const previewRows = (): AdminPriceRow[] => {
  const base = (id: number, item_name: string, service_category: string, price: number | null, extra: Partial<AdminPriceRow> = {}): AdminPriceRow => ({
    id,
    item_no: id,
    item_name,
    category: "Shirts & T-Shirts",
    service_category,
    price,
    price_type: price === null ? "poa" : "fixed",
    unit: "item",
    hanger: "request",
    item_group: "Men",
    note: null,
    is_popular: false,
    active: true,
    updated_at: new Date().toISOString(),
    pending: null,
    ...extra,
  });
  return [
    base(1, "Shirt", "Dry Cleaning", 120),
    base(2, "Shirt", "Wash + Iron", 60, { pending: { id: "00000000-0000-4000-8000-0000000000a1", kind: "edit", by: "Preview Manager", at: new Date().toISOString() } }),
    base(3, "Shirt", "Ironing", 25),
    base(4, "Panjabi", "Dry Cleaning", 180, { category: "Panjabi & Ethnic Men's" }),
    base(5, "Carpet", "Dry Cleaning", 45, { category: "Misc", price_type: "per_sqft", unit: "sqft", item_group: "Household" }),
    base(6, "Old Coat", "Dry Cleaning", 300, { category: "Coats & Jackets", active: false }),
  ];
};

export async function getAdminPrices(): Promise<Loaded<AdminPriceRow[]>> {
  if (isAdminPreview()) return { state: "ok", data: previewRows(), preview: true };
  if (!isSupabaseConfigured()) return { state: "not_configured" };
  const r = await rpc<AdminPriceRow[]>("website_price_admin_list", {});
  return r.ok ? { state: "ok", data: r.data } : { state: "error", message: r.message };
}

export async function getPriceChanges(status: ChangeStatus | "all", limit = 100): Promise<Loaded<PriceChange[]>> {
  if (isAdminPreview()) {
    const rows = previewRows();
    const now = Date.now();
    const data: PriceChange[] = [
      {
        id: "00000000-0000-4000-8000-0000000000a1",
        kind: "edit",
        price_id: 2,
        proposed: { ...rows[1], price: 70 },
        before: rows[1],
        current: rows[1],
        reason: "Detergent cost went up",
        status: "pending",
        requested_by_id: null,
        requested_by_name: "Preview Manager",
        requested_by_role: "manager",
        requested_at: new Date(now - 40 * 60_000).toISOString(),
        decided_by_name: null,
        decided_at: null,
        decision_note: null,
        result_price_id: null,
      },
      {
        id: "00000000-0000-4000-8000-0000000000a2",
        kind: "add",
        price_id: null,
        proposed: { item_name: "Hoodie", category: "Sweaters & Pullovers", service_category: "Wash + Iron", price: 90, price_type: "fixed", item_group: "Men", hanger: null, note: null, is_popular: false },
        before: null,
        current: null,
        reason: null,
        status: "pending",
        requested_by_id: null,
        requested_by_name: "Preview Manager",
        requested_by_role: "manager",
        requested_at: new Date(now - 3 * 3_600_000).toISOString(),
        decided_by_name: null,
        decided_at: null,
        decision_note: null,
        result_price_id: null,
      },
    ];
    return { state: "ok", preview: true, data: status === "all" || status === "pending" ? data : [] };
  }
  if (!isSupabaseConfigured()) return { state: "not_configured" };
  const r = await rpc<PriceChange[]>("website_price_change_list", { p_status: status, p_limit: limit });
  return r.ok ? { state: "ok", data: r.data } : { state: "error", message: r.message };
}

export async function pendingPriceCount(): Promise<number> {
  const r = await getPriceChanges("pending", 200);
  return r.state === "ok" ? r.data.length : 0;
}

export async function requestPriceChange(input: {
  kind: ChangeKind;
  priceId: number | null;
  proposed: Record<string, unknown>;
  reason: string;
  by: { id: string; name: string; role: string };
}) {
  return rpc<string>("website_price_change_request", {
    p_kind: input.kind,
    p_price_id: input.priceId,
    p_proposed: input.proposed,
    p_reason: input.reason,
    p_by_id: /^[0-9a-f-]{36}$/i.test(input.by.id) ? input.by.id : null,
    p_by_name: input.by.name,
    p_by_role: input.by.role,
  });
}

export async function decidePriceChange(id: string, decision: "approve" | "reject" | "cancel", byName: string, note: string) {
  return rpc<{ status: string; priceId?: number }>("website_price_change_decide", { p_id: id, p_decision: decision, p_by_name: byName, p_note: note });
}
