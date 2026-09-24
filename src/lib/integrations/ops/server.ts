import "server-only";

import type { VeltoOpsGateway } from "./contracts";
import { createSupabaseOpsGateway } from "./supabase-rpc";

let gateway: VeltoOpsGateway | undefined;

/**
 * Website booking/quote writes are off unless VELTO_OPS_WRITES_ENABLED is
 * exactly "true". Only switch it on when VELTO_SUPABASE_URL points at the
 * production Ops project — requests sent to staging are never seen by staff.
 *
 * While this returns null, /api/bookings and /api/quotes answer 501 and the
 * forms tell customers online booking isn't switched on yet.
 */
export function getOpsGateway(): VeltoOpsGateway | null {
  if (process.env.VELTO_OPS_WRITES_ENABLED !== "true") return null;
  const url = process.env.VELTO_SUPABASE_URL;
  const secretKey = process.env.VELTO_SUPABASE_SECRET_KEY;
  if (!url || !secretKey) return null;

  gateway ??= createSupabaseOpsGateway({ url, secretKey });
  return gateway;
}
