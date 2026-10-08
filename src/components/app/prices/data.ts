import "server-only";

import type { PriceRow } from "@/components/app/book/AppBookingFlow";
import { formText } from "@/content/i18n/forms";
import { GARMENT_SERVICES, isGarmentService, type GarmentService } from "@/lib/booking-items";
import type { Locale } from "@/lib/i18n/config";
import { getServicePrices } from "@/lib/service-prices";
import type { PricesText } from "./PricesPanel";

/** The everyday items, exactly as the Ops price list names them. */
export const POPULAR_ITEMS = ["Shirt", "Pant", "T-Shirt", "Panjabi", "Kamiz", "Salwar", "Sari (Cotton)", "Jeans", "Blazer", "Bed Sheet (Medium)", "Blanket (Single)", "Suit (2 pc)"];

/** Prices of the popular items, per garment service (empty when the price list can't be read). */
export async function popularPrices(extra: string[] = []): Promise<PriceRow[]> {
  const priced = await getServicePrices([...new Set([...POPULAR_ITEMS, ...extra])].slice(0, 40));
  if (priced.state !== "live") return [];
  return priced.items.map((p) => ({
    name: p.name,
    prices: Object.fromEntries(p.services.filter((s) => isGarmentService(s.slug) && s.amountMinor !== null).map((s) => [s.slug, s.amountMinor as number])),
  }));
}

/** The prices panel's words in the page language. */
export function pricesText(locale: Locale): PricesText {
  const f = formText(locale);
  return {
    pricesSub: f.common.app.pricesSub,
    pricesFoot: f.common.app.pricesFoot,
    searchPlaceholder: f.common.app.searchPlaceholder,
    serviceNames: Object.fromEntries(GARMENT_SERVICES.map((s) => [s, f.booking.services[s]])) as Record<GarmentService, string>,
  };
}
