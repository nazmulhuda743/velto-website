import "server-only";

import { estimateBooking, type BookingItem } from "./booking-items";
import { formatAmount } from "./format-price";
import { getSiteContent } from "./site-content";
import { getServicePrices } from "./service-prices";

/** The admin's below-৳499 pickup & delivery charge in minor units, or null when it isn't set. */
export async function getPickupChargeMinor(): Promise<number | null> {
  const taka = (await getSiteContent()).settings.pickupChargeTaka;
  return taka === null ? null : taka * 100;
}

/**
 * The website estimate for the Ops notes, worked out on the server from the same public price
 * list the form shows (never from numbers the browser sends). English, for staff:
 * "৳610 for 7 items; 1 line priced at pickup; pickup & delivery ৳60". Undefined when nothing
 * can be priced (no price list, or no line with a price).
 */
export async function bookingEstimateText(items: BookingItem[]): Promise<string | undefined> {
  if (!items.length) return undefined;
  // Typed names outside the price list's plain format (e.g. Bangla script) can't be on it: skip them, keep the rest.
  const names = [...new Set(items.map((i) => i.item))].filter((n) => /^[A-Za-z0-9 ().,/&+'-]{1,64}$/.test(n));
  if (!names.length) return undefined;
  const prices = await getServicePrices(names);
  if (prices.state !== "live") return undefined;
  const unit = (i: BookingItem) => {
    const entry = prices.items.find((p) => p.name === i.item)?.services.find((s) => s.slug === i.service);
    // Per-unit prices (per sq ft) depend on a measurement, so Velto prices them at pickup.
    return entry && entry.amountMinor !== null && !entry.unitLabel ? entry.amountMinor : null;
  };
  const lines = items.map((i) => ({ quantity: i.quantity, unitMinor: unit(i) }));
  if (lines.every((l) => l.unitMinor === null)) return undefined;
  const e = estimateBooking(lines, await getPickupChargeMinor());
  const count = lines.filter((l) => l.unitMinor !== null).reduce((n, l) => n + l.quantity, 0);
  return [
    `${formatAmount(e.subtotalMinor)} for ${count} item${count === 1 ? "" : "s"}`,
    e.unpricedLines ? `${e.unpricedLines} line${e.unpricedLines === 1 ? "" : "s"} priced at pickup` : "",
    e.free ? "pickup & delivery free" : e.chargeMinor !== null ? `pickup & delivery ${formatAmount(e.chargeMinor)}` : "pickup & delivery charge to confirm",
  ]
    .filter(Boolean)
    .join("; ");
}
