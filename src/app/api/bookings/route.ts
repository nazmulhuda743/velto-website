import { NextResponse, type NextRequest } from "next/server";
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
import { logServerEvent } from "@/lib/observability/log";
import { readBoundedJson } from "@/lib/security/json-request";

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
  const parsed = validateBookingSubmission(input.data);
  const context = validateSubmissionContext({ idempotencyKey: input.idempotencyKey, requestId });
  if (!parsed.ok || !context.ok) {
    const issues = [...(parsed.ok ? [] : parsed.issues), ...(context.ok ? [] : context.issues)];
    return fail("invalid_request", requestId, false, 400, issues);
  }

  const gateway = getOpsGateway();
  if (!gateway) return fail("booking_unavailable", requestId, true, 501);

  try {
    const result = await gateway.createBooking(parsed.value, context.value);
    logServerEvent("booking_submission_success", "info", { operation: "booking", requestId });
    return NextResponse.json(
      { ok: true as const, reference: result.reference, requestId },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    logServerEvent("booking_submission_failure", "error", integrationLogContext(error, "booking", requestId));
    const safe = toSafeIntegrationError(error, requestId, "booking_unavailable");
    const status =
      error instanceof IntegrationError && error.code === "duplicate_submission"
        ? 409
        : error instanceof IntegrationError && error.code === "request_timeout"
          ? 504
          : 502;
    return NextResponse.json(safe, { status, headers: { "Cache-Control": "no-store" } });
  }
}
