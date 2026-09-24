export const SAFE_ERROR_CODES = [
  "invalid_request",
  "pricing_unavailable",
  "booking_unavailable",
  "quote_unavailable",
  "request_timeout",
  "duplicate_submission",
  "internal_error",
] as const;

export type SafeErrorCode = (typeof SAFE_ERROR_CODES)[number];

export type SafeIntegrationError = {
  ok: false;
  error: {
    code: SafeErrorCode;
    requestId: string;
    retryable: boolean;
  };
};

export class IntegrationError extends Error {
  readonly code: SafeErrorCode;
  readonly retryable: boolean;

  constructor(
    code: SafeErrorCode,
    retryable: boolean,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "IntegrationError";
    this.code = code;
    this.retryable = retryable;
  }
}

export function toSafeIntegrationError(
  error: unknown,
  requestId: string,
  fallback: Extract<
    SafeErrorCode,
    "pricing_unavailable" | "booking_unavailable" | "quote_unavailable"
  >,
): SafeIntegrationError {
  const known = error instanceof IntegrationError ? error : undefined;
  return {
    ok: false,
    error: {
      code: known?.code ?? fallback,
      requestId,
      retryable: known?.retryable ?? true,
    },
  };
}

/** Whitelisted fields suitable for structured server logs; never includes secrets or payloads. */
export function integrationLogContext(
  error: unknown,
  operation: "pricing" | "booking" | "quote",
  requestId: string,
) {
  return {
    operation,
    requestId,
    errorName: error instanceof Error ? error.name : "UnknownError",
    errorCode:
      error instanceof IntegrationError ? error.code : "unclassified_error",
  } as const;
}
