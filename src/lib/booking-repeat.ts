import "server-only";

import type { RepeatItem } from "@/components/forms/BookingForm";
import { cleanItemName, MAX_BOOKING_ITEMS, type ItemService } from "./booking-items";
import { getPortalOrder } from "./customer/portal";
import { bookingServiceFor } from "./customer/rhythm";
import { getServicePrices } from "./service-prices";

/** Names the price list can be asked about (its own plain format). */
const PRICE_LIST_NAME = /^[A-Za-z0-9 ().,/&+'-]{1,64}$/;

/**
 * "Book the same again": the lines of one of the signed-in customer's own orders, ready for the
 * booking form, with today's price-list entry for each item. The order is read through the portal
 * (so only the customer's own, linked orders come back). Anything unusable is skipped, never
 * guessed: the form still carries the "same as order VEL-…" note for Ops.
 */
export async function repeatItemsFor(orderNumber: string): Promise<RepeatItem[]> {
  const order = await getPortalOrder(orderNumber);
  if (!order || order === "error" || !Array.isArray(order.lines)) return [];

  // Same item and service twice in Ops: one line with the total quantity.
  const merged = new Map<string, { item: string; service: ItemService | ""; quantity: number }>();
  for (const line of order.lines) {
    const item = cleanItemName(line.item);
    const quantity = Number.isInteger(line.quantity) && line.quantity > 0 ? line.quantity : 1;
    if (!item) continue;
    const service = (bookingServiceFor([line.service ?? ""]) ?? "") as ItemService | "";
    const key = `${item}|${service}`;
    const seen = merged.get(key);
    if (seen) seen.quantity += quantity;
    else merged.set(key, { item, service, quantity });
  }
  const lines = [...merged.values()].slice(0, MAX_BOOKING_ITEMS);
  if (!lines.length) return [];

  const names = [...new Set(lines.map((l) => l.item))].filter((n) => PRICE_LIST_NAME.test(n));
  const prices = names.length ? await getServicePrices(names) : ({ state: "unavailable" } as const);
  const listed = new Map(prices.state === "live" ? prices.items.map((p) => [p.name, p]) : []);
  return lines.map((l) => ({ ...l, listed: listed.get(l.item) }));
}
