import { NextResponse, type NextRequest } from "next/server";
import {
  IntegrationError,
  integrationLogContext,
  toSafeIntegrationError,
  type SafeErrorCode,
} from "@/lib/integrations/errors";
import { getOpsGateway } from "@/lib/integrations/ops/server";
import {
  validateQuoteSubmission,
  validateSubmissionContext,
  type ValidationIssue,
} from "@/lib/integrations/ops/validation";

/**
 * Website-owned household quote endpoint (spec §7/§8). Same wire format and
 * error contract as /api/bookings. photoReferences only ever carries opaque
 * references from the future controlled upload flow — never file bodies.
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
    { status },
  );

export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail("invalid_request", requestId, false, 400);
  }
  const input = (body ?? {}) as Record<string, unknown>;

  const parsed = validateQuoteSubmission(input.data);
  const context = validateSubmissionContext({ idempotencyKey: input.idempotencyKey, requestId });
  if (!parsed.ok || !context.ok) {
    const issues = [...(parsed.ok ? [] : parsed.issues), ...(context.ok ? [] : context.issues)];
    return fail("invalid_request", requestId, false, 400, issues);
  }

  const gateway = getOpsGateway();
  if (!gateway) return fail("quote_unavailable", requestId, true, 501);

  try {
    const result = await gateway.createQuote(parsed.value, context.value);
    return NextResponse.json({ ok: true as const, reference: result.reference, requestId });
  } catch (error) {
    console.error("quote_failed", integrationLogContext(error, "quote", requestId));
    const safe = toSafeIntegrationError(error, requestId, "quote_unavailable");
    const status =
      error instanceof IntegrationError && error.code === "duplicate_submission"
        ? 409
        : error instanceof IntegrationError && error.code === "request_timeout"
          ? 504
          : 502;
    return NextResponse.json(safe, { status });
  }
}
