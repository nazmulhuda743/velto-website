import { after, NextResponse, type NextRequest } from "next/server";
import { logServerEvent } from "@/lib/analytics/store";
import { bookingEstimateText } from "@/lib/booking-estimate";
import { cleanBookingItems } from "@/lib/booking-items";
import {
  IntegrationError,
  integrationLogContext,
  toSafeIntegrationError,
  type SafeErrorCode,
} from "@/lib/integrations/errors";
import { getOpsGateway } from "@/lib/integrations/ops/server";
import {
  validateBookingSubmission,
  validateSubmissionContext,
  type ValidationIssue,
} from "@/lib/integrations/ops/validation";
import { readBoundedJson } from "@/lib/security/json-request";

/**
 * Website-owned booking endpoint (spec §8). Wire format:
 *   POST { data: BookingSubmission-shaped fields + attribution, idempotencyKey }
 *   → 200 { ok: true, reference, requestId }
 *   → 400 invalid_request (+ field issues), 501 while no Ops gateway is
 *     configured, 409/502/504 mapped from gateway errors. Customer responses
 *     never carry upstream messages (Codex error contract).
 */
const fail = (
  code: SafeErrorCode,
  requestId: string,
  retryable: boolean,
  status: number,
  issues?: ValidationIssue[],
) =>
  NextResponse.json(
    { ok: false as const, error: { code, requestId, retryable }, ...(issues ? { issues } : {}) },
    { status, headers: { "Cache-Control": "no-store" } },
  );

export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID();

  const body = await readBoundedJson(request);
  if (!body.ok) return fail("invalid_request", requestId, false, body.status);

  const input = (body.value ?? {}) as Record<string, unknown>;
  // The estimate comes from the Ops price list on the server, never from the browser.
  const data = input.data && typeof input.data === "object" ? (input.data as Record<string, unknown>) : {};
  const items = cleanBookingItems(data.items);
  const estimate = items?.length ? await bookingEstimateText(items).catch(() => undefined) : undefined;
  const parsed = validateBookingSubmission(input.data, { estimate });
  const context = validateSubmissionContext({ idempotencyKey: input.idempotencyKey, requestId });
  if (!parsed.ok || !context.ok) {
    const issues = [...(parsed.ok ? [] : parsed.issues), ...(context.ok ? [] : context.issues)];
    return fail("invalid_request", requestId, false, 400, issues);
  }

  const gateway = getOpsGateway();
  if (!gateway) return fail("booking_unavailable", requestId, true, 501);

  try {
    const result = await gateway.createBooking(parsed.value, context.value);
    return NextResponse.json(
      { ok: true as const, reference: result.reference, requestId },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("booking_failed", integrationLogContext(error, "booking", requestId));
    const safe = toSafeIntegrationError(error, requestId, "booking_unavailable");
    if (!(error instanceof IntegrationError && error.code === "duplicate_submission")) {
      after(() => logServerEvent("booking_error", "/api/bookings", safe.error.code));
    }
    const status =
      error instanceof IntegrationError && error.code === "duplicate_submission"
        ? 409
        : error instanceof IntegrationError && error.code === "request_timeout"
          ? 504
          : 502;
    return NextResponse.json(safe, { status, headers: { "Cache-Control": "no-store" } });
  }
}
