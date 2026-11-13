/*
 * Booking lines and prices shared by the booking form, its per-service item panels (ServiceItems)
 * and the order summary.
 */

import { localDigits, type Locale } from "@/lib/i18n/config";
import { formatAmount } from "@/lib/format-price";
import { GARMENT_SERVICES, isItemService, MAX_ITEM_QUANTITY, type ItemService } from "@/lib/booking-items";

/** A price-list entry as /api/prices and the book page send it (amounts from Velto Ops). */
export type PriceItem = {
  slug: string;
  name: string;
  services: { slug: string; amountMinor: number | null; unitLabel: string | null }[];
};

/**
 * One line in the booking: item + service + quantity. `prices` holds the item's unit price per
 * service from the price list (null: priced at pickup), so changing the service keeps a price.
 */
export type ItemLine = {
  id: string;
  item: string;
  service: ItemService | "";
  quantity: number;
  options: ItemService[];
  prices: Partial<Record<ItemService, number | null>>;
};

/** Unit price for the estimate: per-unit prices (per sq ft) need a measurement, so they count as unpriced. */
export const unitPrice = (s: PriceItem["services"][number]) => (s.amountMinor !== null && !s.unitLabel ? s.amountMinor : null);

export const lineUnit = (l: ItemLine) => (l.service ? (l.prices[l.service] ?? null) : null);

export const money = (minor: number, locale: Locale) => localDigits(formatAmount(minor), locale);

let lineCounter = 0;
export function newLine(item: string, options: ItemService[], service: ItemService | "", prices: ItemLine["prices"] = {}, quantity = 1): ItemLine {
  lineCounter += 1;
  return { id: `line-${lineCounter}`, item, service, quantity, options, prices };
}

/**
 * A line for an item the customer has sent before ("Book the same again"): today's prices when the
 * item is on the price list, otherwise priced at pickup like any typed item.
 */
export function repeatLine(item: string, service: ItemService | "", quantity: number, listed?: PriceItem): ItemLine {
  const options = listed ? listed.services.map((s) => s.slug).filter(isItemService) : [...GARMENT_SERVICES];
  const prices = listed ? Object.fromEntries(listed.services.filter((s) => isItemService(s.slug)).map((s) => [s.slug, unitPrice(s)])) : {};
  const svc = service && (options.includes(service) || !listed) ? service : "";
  return newLine(item, svc && !options.includes(svc) ? [...options, svc] : options, svc, prices, Math.min(MAX_ITEM_QUANTITY, Math.max(1, quantity)));
}
