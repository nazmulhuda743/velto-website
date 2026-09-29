import "server-only";

import { cache } from "react";
import type { UpsellHints } from "./booking-upsell";
import { bookingServiceFor } from "./customer/rhythm";
import { customerSupabase } from "./customer/supabase";
import { isAdminPreview } from "./admin/preview";
import { isSupabaseConfigured, supabaseRpc } from "./supabase-server";

/**
 * Smart upsell data (docs/technical/sql/website_upsell.sql), read on the server. Store-wide pairs
 * change slowly, so they are cached for 6 hours per server; a customer's own items are read per request.
 * Ops service names ("Wash + Iron") become booking-form slugs ("wash-and-iron").
 */

type AffinityRow = { item: string; service: string; also_item: string; also_service: string; share: number | string };
type UsualRow = { item: string; service: string; orders: number };

const slug = (ops: string) => bookingServiceFor([ops]);
const PAIRS_TTL_MS = 6 * 3_600_000;
let pairsCache: { at: number; value: UpsellHints["pairs"] } | null = null;

export async function getItemPairs(): Promise<UpsellHints["pairs"]> {
  if (!isSupabaseConfigured()) return [];
  if (pairsCache && Date.now() - pairsCache.at < PAIRS_TTL_MS) return pairsCache.value;
  try {
    const rows = await supabaseRpc<AffinityRow[]>("website_item_affinity", {});
    const value = (Array.isArray(rows) ? rows : []).flatMap((r) => {
      const service = slug(r.service);
      const alsoService = slug(r.also_service);
      const share = Number(r.share);
      return service && alsoService && typeof r.item === "string" && typeof r.also_item === "string" && Number.isFinite(share)
        ? [{ item: r.item, service, alsoItem: r.also_item, alsoService, share }]
        : [];
    });
    pairsCache = { at: Date.now(), value };
    return value;
  } catch (error) {
    console.error("item_affinity_failed", error instanceof Error ? error.message.slice(0, 120) : "unknown");
    return pairsCache?.value ?? [];
  }
}

/** The signed-in, linked customer's regular items; empty for everyone else. */
export const getUsualItems = cache(async (): Promise<UpsellHints["usual"]> => {
  const supabase = await customerSupabase();
  if (!supabase) return [];
  const { data, error } = await supabase.rpc("portal_usual_items");
  if (error) {
    if (error.code !== "PGRST202") console.error("portal_usual_items_failed", error.code);
    return [];
  }
  return usualToSlugs(data);
});

export function usualToSlugs(data: unknown): UpsellHints["usual"] {
  return (Array.isArray(data) ? (data as UsualRow[]) : []).flatMap((r) => {
    const service = typeof r?.service === "string" ? slug(r.service) : null;
    return service && typeof r.item === "string" ? [{ item: r.item, service }] : [];
  });
}

/** Staff card: each phone's regular items (website_usual_items), Ops names kept for reading. */
export async function getUsualItemsByPhone(phones: string[]): Promise<Record<string, UsualRow[]>> {
  if (isAdminPreview()) {
    // Local preview only: the regular in the preview board.
    const regular: UsualRow[] = [{ item: "Shirt", service: "Ironing", orders: 6 }, { item: "Pant", service: "Ironing", orders: 5 }, { item: "Bed Sheet (Medium)", service: "Wash + Iron", orders: 2 }];
    return Object.fromEntries(phones.filter((p) => p === "01811505050").map((p) => [p, regular]));
  }
  if (!isSupabaseConfigured() || !phones.length) return {};
  try {
    const r = await supabaseRpc<Record<string, UsualRow[]>>("website_usual_items", { p_phones: phones.slice(0, 200) });
    return r && typeof r === "object" ? r : {};
  } catch (error) {
    console.error("usual_items_failed", error instanceof Error ? error.message.slice(0, 120) : "unknown");
    return {};
  }
}
