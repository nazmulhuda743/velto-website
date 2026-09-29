import "server-only";

import { isFirstOrder, phoneKey } from "../first-order-offer";
import { isSupabaseConfigured, supabaseRpc } from "../supabase-server";

/**
 * Whether this phone number has no Velto orders yet (the first-order offer). null when it can't
 * be told: no usable number, no database, or the lookup failed. Then no offer is noted, so an
 * outage never hands out discounts.
 */
export async function firstOrderFor(phone: string | null | undefined): Promise<boolean | null> {
  const key = phoneKey(phone);
  if (!key || !isSupabaseConfigured()) return null;
  try {
    const counts = await supabaseRpc<Record<string, { total: number }>>("website_customer_order_counts", { p_phones: [key], p_months: 12 });
    return isFirstOrder(counts && typeof counts === "object" ? counts : null, key);
  } catch {
    return null;
  }
}
