/**
 * Server-side conversion contract for Meta's Conversions API. Runtime-neutral, and NOT wired to
 * any sender: there is no access token in this project and nothing is sent. It fixes the rules a
 * future sender (Ops PWA, a Supabase function or a website cron) must follow, and is unit-tested.
 *
 * Stages (see src/lib/analytics/destinations.ts for the browser side):
 *   Contact   WhatsApp click            browser only; event id contact.<click id> is stored with the ref
 *   Lead      booking / quote accepted  browser now; server copy may reuse lead.<WEB-ref> to deduplicate
 *   Purchase  order with a billed value server only, event id purchase.<order id>
 *
 * An order that exists but has no final billed value is NOT a Purchase. Nothing here invents a value.
 */
import { eventIds } from "../analytics/destinations";
import type { AdClickIds } from "../whatsapp-ref";

/** Meta accepts server events up to 7 days after they happened. */
export const MAX_EVENT_AGE_SECONDS = 7 * 24 * 60 * 60;

export type OrderForPurchase = {
  orderId: string;
  /** Billed total in BDT (orders.total_amount). Null or 0 while it isn't final. */
  billedValue: number | null;
  status: string;
  /** When the value became final (ISO). */
  billedAt: string;
  /** Normalized service ids (dry_cleaning, ...). */
  services?: string[];
};

export type AttributionForPurchase = {
  /** Marketing consent recorded when the click ids were captured. */
  marketingConsent: boolean;
  clickIds: AdClickIds;
};

export type MetaServerEvent = {
  event_name: "Purchase";
  event_time: number;
  event_id: string;
  action_source: "system_generated";
  user_data: { fbc?: string; fbp?: string };
  custom_data: { currency: "BDT"; value: number; order_id: string; content_category?: string; content_ids?: string[] };
};

export type PurchaseDecision =
  | { ok: true; event: MetaServerEvent }
  | { ok: false; reason: "no_consent" | "no_click_ids" | "value_not_final" | "cancelled" | "too_old" | "bad_time" };

export function metaPurchaseEvent(
  order: OrderForPurchase,
  attribution: AttributionForPurchase,
  nowMs: number,
): PurchaseDecision {
  if (!attribution.marketingConsent) return { ok: false, reason: "no_consent" };
  const { fbc, fbp } = attribution.clickIds;
  if (!fbc && !fbp) return { ok: false, reason: "no_click_ids" };
  if (/^cancel/i.test(order.status.trim())) return { ok: false, reason: "cancelled" };
  const value = order.billedValue;
  if (value === null || !Number.isFinite(value) || value <= 0) return { ok: false, reason: "value_not_final" };
  const at = Date.parse(order.billedAt);
  if (Number.isNaN(at) || at > nowMs + 60_000) return { ok: false, reason: "bad_time" };
  const eventTime = Math.floor(at / 1000);
  if (Math.floor(nowMs / 1000) - eventTime > MAX_EVENT_AGE_SECONDS) return { ok: false, reason: "too_old" };

  const services = order.services?.filter(Boolean);
  return {
    ok: true,
    event: {
      event_name: "Purchase",
      event_time: eventTime,
      event_id: eventIds.purchase(order.orderId),
      // The order is completed in Velto's own system, not on a web page.
      action_source: "system_generated",
      user_data: { ...(fbc ? { fbc } : {}), ...(fbp ? { fbp } : {}) },
      custom_data: {
        currency: "BDT",
        value: Math.round(value * 100) / 100,
        order_id: order.orderId,
        ...(services?.length === 1 ? { content_category: services[0] } : {}),
        ...(services?.length ? { content_ids: services } : {}),
      },
    },
  };
}
