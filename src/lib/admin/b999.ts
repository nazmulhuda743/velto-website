import "server-only";

import { isAdminPreview } from "./preview";
import { isSupabaseConfigured, supabaseRpc } from "../supabase-server";

/** Admin → Blanket ৳999 (docs/technical/B999.md): the B999 bookings and their price checks. */
export type B999Row = {
  id: string;
  reference: string;
  name: string;
  phone: string;
  sector: number;
  address: string;
  pickupDate: string;
  status: "booked" | "cancelled";
  priceStatus: "locked" | "confirmation_required" | "approved" | "declined";
  proposedRegular: number | null;
  proposedHeavy: number | null;
  proposedExtraRegular: number | null;
  proposedExtraHeavy: number | null;
  proposedTotal: number | null;
  approvedTotal: number | null;
  declinedHeavy: number | null;
  decisionChannel: string | null;
  flaggedBy: string | null;
  flaggedAt: string | null;
  decidedBy: string | null;
  decidedAt: string | null;
  staffNote: string | null;
  utmSource: string | null;
  utmCampaign: string | null;
  createdAt: string;
  orderNumber: string | null;
  orderTotal: number | null;
  mismatch: boolean;
};

export type B999List = { state: "ok"; rows: B999Row[]; preview?: boolean } | { state: "not_configured" } | { state: "error"; message: string };

const row = (o: Partial<B999Row>): B999Row => ({
  id: "00000000-0000-0000-0000-000000000001",
  reference: "WEB-PREVIEW1",
  name: "Preview customer",
  phone: "01711000000",
  sector: 7,
  address: "House 12, Road 3",
  pickupDate: new Date(Date.now() + 86_400_000).toISOString().slice(0, 10),
  status: "booked",
  priceStatus: "locked",
  proposedRegular: null,
  proposedHeavy: null,
  proposedExtraRegular: null,
  proposedExtraHeavy: null,
  proposedTotal: null,
  approvedTotal: null,
  declinedHeavy: null,
  decisionChannel: null,
  flaggedBy: null,
  flaggedAt: null,
  decidedBy: null,
  decidedAt: null,
  staffNote: null,
  utmSource: "facebook",
  utmCampaign: "b999",
  createdAt: new Date().toISOString(),
  orderNumber: null,
  orderTotal: null,
  mismatch: false,
  ...o,
});

/** Synthetic rows for local visual QA only (next dev with VELTO_ADMIN_PREVIEW=1). */
const PREVIEW: B999Row[] = [
  row({}),
  row({ id: "00000000-0000-0000-0000-000000000002", reference: "WEB-PREVIEW2", name: "Second preview", priceStatus: "confirmation_required", proposedRegular: 2, proposedHeavy: 1, proposedExtraRegular: 0, proposedExtraHeavy: 0, proposedTotal: 1049, flaggedBy: "Preview admin", flaggedAt: new Date().toISOString(), staffNote: "One looks heavy at pickup" }),
  row({ id: "00000000-0000-0000-0000-000000000003", reference: "WEB-PREVIEW3", name: "Third preview", priceStatus: "approved", proposedRegular: 3, proposedHeavy: 0, proposedExtraRegular: 1, proposedExtraHeavy: 0, proposedTotal: 1399, approvedTotal: 1399, decisionChannel: "phone", decidedBy: "Preview admin", decidedAt: new Date().toISOString(), orderNumber: "VEL-01999", orderTotal: 999, mismatch: true }),
];

export async function getB999List(days = 30): Promise<B999List> {
  if (isAdminPreview()) return { state: "ok", rows: PREVIEW, preview: true };
  if (!isSupabaseConfigured()) return { state: "not_configured" };
  try {
    return { state: "ok", rows: (await supabaseRpc<B999Row[]>("website_b999_list", { p_days: days })) ?? [] };
  } catch (e) {
    console.error("b999_list_failed", e instanceof Error ? e.message.slice(0, 120) : "unknown");
    return { state: "error", message: "Couldn't load B999 bookings. Try again in a moment." };
  }
}

type Res = { ok: boolean; error?: string };
export const flagB999 = (id: string, c: { regular: number; heavy: number; extraRegular: number; extraHeavy: number }, total: number, note: string, by: string) =>
  supabaseRpc<Res>("website_b999_flag", { p_id: id, p_regular: c.regular, p_heavy: c.heavy, p_extra_regular: c.extraRegular, p_extra_heavy: c.extraHeavy, p_total: total, p_note: note, p_by: by });
export const decideB999 = (id: string, decision: "approved" | "declined", channel: string, declinedHeavy: number, total: number | null, by: string) =>
  supabaseRpc<Res>("website_b999_decide", { p_id: id, p_decision: decision, p_channel: channel, p_declined_heavy: declinedHeavy, p_total: total, p_by: by });
export const linkB999Order = (id: string, orderNumber: string) => supabaseRpc<Res>("website_b999_link_order", { p_id: id, p_order_number: orderNumber });
export const cancelB999 = (id: string, by: string) => supabaseRpc<Res>("website_b999_cancel", { p_id: id, p_by: by });
