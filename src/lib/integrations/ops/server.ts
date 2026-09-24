import "server-only";

import type { VeltoOpsGateway } from "./contracts";

/**
 * INTEGRATION POINT (Codex): return the live VeltoOpsGateway once the Velto
 * Ops command/API, idempotency behavior, rate limiting and photo-upload flow
 * are confirmed (docs/technical/INTEGRATIONS.md, "Booking and quote writes").
 *
 * While this returns null, /api/bookings and /api/quotes answer 501 and the
 * forms keep telling customers that online booking isn't switched on yet —
 * no submission is ever silently dropped or faked.
 */
export function getOpsGateway(): VeltoOpsGateway | null {
  return null;
}
