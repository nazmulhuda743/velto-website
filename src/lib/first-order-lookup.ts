import "server-only";

import { bdPhone } from "./booking-recovery";
import type { FirstOrder } from "./first-order-offer";
import { supabaseFetch } from "./supabase-server";

/**
 * Whether a booking is this number's first on the website (the first-order 10%): no earlier
 * website booking task in Ops for the number, stored as tasks.source_ref = 01XXXXXXXXX by
 * website_create_request. Read with the service key on the server only; "unknown" when the number
 * or the lookup fails, so the booking still goes through and staff are asked to check.
 */
export async function firstWebsiteBooking(phone: string, fetcher: typeof supabaseFetch = supabaseFetch): Promise<FirstOrder> {
  const key = bdPhone(phone);
  if (!key) return "unknown";
  try {
    const q = new URLSearchParams({ select: "id", source: "eq.website_booking", source_ref: `eq.${key}`, limit: "1" });
    const res = await fetcher(`/rest/v1/tasks?${q}`, { cache: "no-store" });
    if (!res.ok) return "unknown";
    const rows: unknown = await res.json();
    if (!Array.isArray(rows)) return "unknown";
    return rows.length ? "repeat" : "first";
  } catch {
    return "unknown";
  }
}
