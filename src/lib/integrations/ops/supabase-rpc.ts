import "server-only";

import { IntegrationError } from "../errors";
import { normalizeProjectUrl } from "../pricing/supabase-rest";
import type {
  BookingSubmission,
  QuoteSubmission,
  SubmissionContext,
  VeltoOpsGateway,
} from "./contracts";

const REQUEST_TIMEOUT_MS = 8_000;
const REFERENCE_PATTERN = /^WEB-[A-Z0-9]{8}$/;

export type SupabaseOpsConfig = {
  url: string;
  secretKey: string;
  fetch?: typeof globalThis.fetch;
};

/**
 * Writes website requests into the existing Velto Ops task list through the
 * `website_create_request` database function (service role only). Bookings
 * become open pickup tasks and quotes become call tasks; Ops dedupes on the
 * idempotency key, so a retried submission returns the original reference.
 */
export function createSupabaseOpsGateway(config: SupabaseOpsConfig): VeltoOpsGateway {
  const origin = normalizeProjectUrl(config.url);
  const request = config.fetch ?? globalThis.fetch;

  async function submit(
    kind: "booking" | "quote",
    payload: BookingSubmission | QuoteSubmission,
    context: SubmissionContext,
  ) {
    const unavailable = kind === "booking" ? "booking_unavailable" : "quote_unavailable";

    // A booked window goes through website_book_pickup: the window is reserved and the task
    // created in one transaction, or neither happens.
    const { slot, ...fields } = payload as BookingSubmission & { slot?: { date: string; window: string } };
    const booked = kind === "booking" && slot;
    let response: Response;
    try {
      response = await request(new URL(booked ? "/rest/v1/rpc/website_book_pickup" : "/rest/v1/rpc/website_create_request", origin), {
        method: "POST",
        headers: {
          apikey: config.secretKey,
          Authorization: `Bearer ${config.secretKey}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(
          booked
            ? { p_dedupe_key: context.idempotencyKey, p_payload: fields, p_slot: { date: slot.date, window: slot.window, source: "website" } }
            : { p_kind: kind, p_dedupe_key: context.idempotencyKey, p_payload: fields },
        ),
        cache: "no-store",
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (error) {
      const timedOut = error instanceof Error && error.name === "TimeoutError";
      throw new IntegrationError(
        timedOut ? "request_timeout" : unavailable,
        true,
        "Ops request failed",
        { cause: error },
      );
    }

    if (!response.ok) {
      throw new IntegrationError(unavailable, true, `Ops returned HTTP ${response.status}`);
    }

    let result: unknown;
    try {
      result = await response.json();
    } catch (error) {
      throw new IntegrationError(unavailable, true, "Ops returned invalid JSON", { cause: error });
    }

    const data = (result ?? {}) as { ok?: unknown; reference?: unknown; error?: unknown };
    if (data.ok === true && typeof data.reference === "string" && REFERENCE_PATTERN.test(data.reference)) {
      return { reference: data.reference };
    }
    if (data.error === "invalid") {
      throw new IntegrationError("invalid_request", false, "Ops rejected the request");
    }
    if (typeof data.error === "string" && (data.error.startsWith("slot_") || data.error === "no_zone")) {
      throw new IntegrationError("slot_unavailable", false, `Ops refused the window: ${data.error}`);
    }
    if (data.error === "rate_limited") {
      throw new IntegrationError("duplicate_submission", false, "Ops rate limited the phone number");
    }
    throw new IntegrationError(unavailable, true, "Ops returned an unexpected result");
  }

  return {
    createBooking: (input, context) => submit("booking", input, context),
    createQuote: (input, context) => submit("quote", input, context),
  };
}
