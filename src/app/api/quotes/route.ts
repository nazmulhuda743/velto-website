import { after, NextResponse, type NextRequest } from "next/server";
import { logServerEvent } from "@/lib/analytics/store";
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
import { readBoundedJson } from "@/lib/security/json-request";
import { SITE_URL } from "@/lib/site-url";
import { notifyNewRequest } from "@/lib/admin/dispatch";
import { newRequestPush } from "@/lib/admin/request-flow";

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
    { status, headers: { "Cache-Control": "no-store" } },
  );

export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID();

  const body = await readBoundedJson(request);
  if (!body.ok) return fail("invalid_request", requestId, false, body.status);

  const input = (body.value ?? {}) as Record<string, unknown>;
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
    // Tell the managers now, after the response is sent (best effort).
    after(() => notifyNewRequest(newRequestPush("quote", { name: parsed.value.name, area: parsed.value.area, service: parsed.value.service }, SITE_URL)));
    return NextResponse.json(
      { ok: true as const, reference: result.reference, requestId },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("quote_failed", integrationLogContext(error, "quote", requestId));
    const safe = toSafeIntegrationError(error, requestId, "quote_unavailable");
    if (!(error instanceof IntegrationError && error.code === "duplicate_submission")) {
      after(() => logServerEvent("quote_error", "/api/quotes", safe.error.code));
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
