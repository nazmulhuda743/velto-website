import "server-only";

import { legacyOpsAttribution, readSubmissionAttribution } from "../attribution";
import { bdPhone } from "../booking-recovery";
import { getServicePrices } from "../service-prices";
import { isSupabaseConfigured, supabaseRpc } from "../supabase-server";
import { B999, dhakaToday, isSector, listPricesMatch, offeredDays, openDays } from "./b999";

/**
 * Server side of the B999 blanket package (docs/technical/B999.md). The browser sends only name,
 * phone, sector, address, pickup date and attribution; package, quantity, price, service and the
 * staff note are fixed here and in website_b999_book. No first-order offer or coupon is ever
 * looked up for this booking.
 */

/** Same switch as every website booking (lib/integrations/ops/server.ts). */
export const b999WritesEnabled = () => process.env.VELTO_OPS_WRITES_ENABLED === "true" && isSupabaseConfigured();

/** The live price list must still say ৳400 / ৳450 (washed); otherwise the package is not offered. */
export async function b999PricesOk(): Promise<boolean> {
  const list = await getServicePrices([B999.regularItem, B999.heavyItem]);
  if (list.state !== "live") return false;
  const taka = (name: string) => {
    const minor = list.items.find((i) => i.name === name)?.services.find((s) => s.name === B999.priceListService)?.amountMinor;
    return typeof minor === "number" ? minor / 100 : null;
  };
  return listPricesMatch(taka(B999.regularItem), taka(B999.heavyItem));
}

/** Offered pickup days that still have space (today in Dhaka + the rules file). */
export async function b999OpenDays(now = new Date()): Promise<string[]> {
  const days = offeredDays(dhakaToday(now));
  const booked = await supabaseRpc<Record<string, number>>("website_b999_days", { p_days: days });
  return openDays(dhakaToday(now), booked ?? {});
}

export type B999Field = "name" | "phone" | "sector" | "address" | "date";
export type B999Input = { name: string; phone: string; sector: number; address: string; pickupDate: string };

const oneLine = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim().slice(0, max) : "");

/** What the booking accepts. Anything else in the request (price, quantity, coupon…) is ignored. */
export function readB999Input(o: Record<string, unknown>): { ok: true; value: B999Input } | { ok: false; field: B999Field } | { ok: false; outside: true } {
  const name = oneLine(o.name, 100);
  if (name.length < 2) return { ok: false, field: "name" };
  const phone = typeof o.phone === "string" ? bdPhone(o.phone) : null;
  if (!phone) return { ok: false, field: "phone" };
  if (o.sector === "outside") return { ok: false, outside: true };
  if (!isSector(o.sector)) return { ok: false, field: "sector" };
  const address = typeof o.address === "string" ? o.address.replace(/[\u0000-\u0009\u000b-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 500) : "";
  if (address.length < 5) return { ok: false, field: "address" };
  const pickupDate = typeof o.pickupDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(o.pickupDate) ? o.pickupDate : "";
  if (!pickupDate) return { ok: false, field: "date" };
  return { ok: true, value: { name, phone, sector: Number(o.sector), address, pickupDate } };
}

export type B999Result =
  | { ok: true; reference: string; pickupDate: string; duplicate: boolean }
  | { ok: false; error: "day_full" | "outside_area" | "rate_limited" | "invalid"; field?: B999Field };

export async function bookB999(dedupeKey: string, input: B999Input, attributionRaw: unknown, now = new Date()): Promise<B999Result> {
  const days = offeredDays(dhakaToday(now));
  const clean = readSubmissionAttribution(attributionRaw && typeof attributionRaw === "object" ? (attributionRaw as Record<string, unknown>) : {});
  const attribution = process.env.VELTO_ATTRIBUTION_SQL_LIVE === "true" ? clean : legacyOpsAttribution(clean);
  const r = await supabaseRpc<{ ok: boolean; reference?: string; pickupDate?: string; duplicate?: boolean; error?: string; field?: string }>("website_b999_book", {
    p_dedupe_key: dedupeKey,
    p_payload: { ...input, attribution },
    p_cap: B999.dailyCap,
    p_days: days,
  });
  if (r?.ok && r.reference) return { ok: true, reference: r.reference, pickupDate: r.pickupDate ?? input.pickupDate, duplicate: Boolean(r.duplicate) };
  const error = r?.error === "day_full" || r?.error === "outside_area" || r?.error === "rate_limited" ? r.error : "invalid";
  const field = (["name", "phone", "sector", "address", "date"] as const).find((f) => f === r?.field);
  return { ok: false, error, ...(field ? { field } : {}) };
}
