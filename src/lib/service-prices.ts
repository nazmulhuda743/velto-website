import "server-only";

import { integrationLogContext } from "./integrations/errors";
import { getPricingSource, isPricingConfigured } from "./integrations/pricing/server";
import type { PublicPriceItem } from "./integrations/pricing/types";

/** Service pages refresh their price tables from the public view at most this often. */
export const SERVICE_PRICE_REVALIDATE_SECONDS = 300;

export type ServicePrices =
  | { state: "live"; items: PublicPriceItem[] }
  | { state: "unavailable" };

/**
 * Featured prices for a service page, read from the same public-safe pricing
 * view as /api/prices. Pages name the items; the amounts only ever come from
 * Velto Ops. Any failure degrades to "unavailable" and never exposes details.
 */
export async function getServicePrices(names: string[]): Promise<ServicePrices> {
  if (!isPricingConfigured()) return { state: "unavailable" };
  try {
    const items = await getPricingSource().getItems({
      names,
      revalidateSeconds: SERVICE_PRICE_REVALIDATE_SECONDS,
    });
    return items.length ? { state: "live", items } : { state: "unavailable" };
  } catch (error) {
    console.error("service_prices_failed", integrationLogContext(error, "pricing", "service-page"));
    return { state: "unavailable" };
  }
}
