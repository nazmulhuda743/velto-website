import { legacyOpsAttribution, readSubmissionAttribution } from "../../attribution";
import type {
  BookingSubmission,
  QuoteSubmission,
  ServiceSlug,
  SubmissionContext,
} from "./contracts";
import { isServiceSlug } from "./contracts";

export type ValidationIssue = {
  field: string;
  code: "required" | "invalid" | "too_long";
};

export type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; issues: ValidationIssue[] };

const HOUSEHOLD_SERVICES = new Set<ServiceSlug>([
  "curtain-cleaning",
  "carpet-cleaning",
  "blanket-comforter-cleaning",
]);
const PHONE_PATTERN = /^\+?[0-9][0-9 ()-]{6,30}$/;
const TOKEN_PATTERN = /^[A-Za-z0-9._:-]{16,128}$/;

function record(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function text(
  input: Record<string, unknown>,
  field: string,
  issues: ValidationIssue[],
  options: { required?: boolean; min?: number; max: number },
) {
  const value = input[field];
  if (value === undefined || value === null || value === "") {
    if (options.required) issues.push({ field, code: "required" });
    return undefined;
  }
  if (typeof value !== "string") {
    issues.push({ field, code: "invalid" });
    return undefined;
  }
  const normalized = value.trim();
  if ((options.required && !normalized) || normalized.length < (options.min ?? 0)) {
    issues.push({ field, code: options.required ? "required" : "invalid" });
    return undefined;
  }
  if (normalized.length > options.max) {
    issues.push({ field, code: "too_long" });
    return undefined;
  }
  if (/[\u0000-\u001f\u007f]/.test(normalized)) {
    issues.push({ field, code: "invalid" });
    return undefined;
  }
  return normalized;
}

/**
 * Canonical submission contract: allowlist + consent gates (src/lib/attribution.ts).
 * Until the Revenue Attribution SQL is live in the Ops database, the legacy
 * intake would print every key into the task text, so the session id and raw
 * click ids are stripped first (legacyOpsAttribution).
 */
function attribution(value: unknown) {
  const clean = readSubmissionAttribution(record(value));
  return attributionSqlLive() ? clean : legacyOpsAttribution(clean);
}

/** Server env flag, read without Node typings so this module stays runtime-neutral. */
const attributionSqlLive = () =>
  (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env
    ?.VELTO_ATTRIBUTION_SQL_LIVE === "true";

export function validateBookingSubmission(
  value: unknown,
): ValidationResult<BookingSubmission> {
  const input = record(value);
  if (!input) return { ok: false, issues: [{ field: "request", code: "invalid" }] };

  const issues: ValidationIssue[] = [];
  const name = text(input, "name", issues, { required: true, min: 2, max: 100 });
  const phone = text(input, "phone", issues, { required: true, max: 32 });
  const area = text(input, "area", issues, { required: true, min: 2, max: 120 });
  const address = text(input, "address", issues, { required: true, min: 5, max: 500 });
  const preferredPickup = text(input, "preferredPickup", issues, { max: 120 });
  const notes = text(input, "notes", issues, { max: 1_000 });
  const rawService = input.service;
  const service =
    typeof rawService === "string" && isServiceSlug(rawService)
      ? rawService
      : undefined;

  if (phone && !PHONE_PATTERN.test(phone)) issues.push({ field: "phone", code: "invalid" });
  if (rawService !== undefined && !service) issues.push({ field: "service", code: "invalid" });
  if (issues.length || !name || !phone || !area || !address) return { ok: false, issues };

  return {
    ok: true,
    value: {
      name,
      phone,
      area,
      address,
      ...(preferredPickup ? { preferredPickup } : {}),
      ...(service ? { service } : {}),
      ...(notes ? { notes } : {}),
      attribution: attribution(input.attribution),
    },
  };
}

export function validateQuoteSubmission(
  value: unknown,
): ValidationResult<QuoteSubmission> {
  const input = record(value);
  if (!input) return { ok: false, issues: [{ field: "request", code: "invalid" }] };

  const issues: ValidationIssue[] = [];
  const name = text(input, "name", issues, { required: true, min: 2, max: 100 });
  const phone = text(input, "phone", issues, { required: true, max: 32 });
  const area = text(input, "area", issues, { required: true, min: 2, max: 120 });
  const approximateDetails = text(input, "approximateDetails", issues, { max: 1_000 });
  const notes = text(input, "notes", issues, { max: 1_000 });
  const rawService = input.service;
  const service =
    typeof rawService === "string" &&
    isServiceSlug(rawService) &&
    HOUSEHOLD_SERVICES.has(rawService)
      ? (rawService as QuoteSubmission["service"])
      : undefined;

  if (phone && !PHONE_PATTERN.test(phone)) issues.push({ field: "phone", code: "invalid" });
  if (!service) issues.push({ field: "service", code: rawService ? "invalid" : "required" });

  const rawPhotos = input.photoReferences ?? [];
  const photoReferences = Array.isArray(rawPhotos)
    ? rawPhotos.filter(
        (item): item is string =>
          typeof item === "string" &&
          item.length > 0 &&
          item.length <= 256 &&
          TOKEN_PATTERN.test(item),
      )
    : [];
  if (!Array.isArray(rawPhotos) || photoReferences.length !== rawPhotos.length || photoReferences.length > 5) {
    issues.push({ field: "photoReferences", code: "invalid" });
  }

  if (issues.length || !name || !phone || !area || !service) return { ok: false, issues };

  return {
    ok: true,
    value: {
      name,
      phone,
      area,
      service,
      ...(approximateDetails ? { approximateDetails } : {}),
      ...(notes ? { notes } : {}),
      photoReferences,
      attribution: attribution(input.attribution),
    },
  };
}

export function validateSubmissionContext(
  value: unknown,
): ValidationResult<SubmissionContext> {
  const input = record(value);
  if (!input) return { ok: false, issues: [{ field: "context", code: "invalid" }] };
  const issues: ValidationIssue[] = [];
  const idempotencyKey = text(input, "idempotencyKey", issues, { required: true, max: 128 });
  const requestId = text(input, "requestId", issues, { required: true, max: 128 });
  if (idempotencyKey && !TOKEN_PATTERN.test(idempotencyKey)) {
    issues.push({ field: "idempotencyKey", code: "invalid" });
  }
  if (requestId && !TOKEN_PATTERN.test(requestId)) {
    issues.push({ field: "requestId", code: "invalid" });
  }
  if (issues.length || !idempotencyKey || !requestId) return { ok: false, issues };
  return { ok: true, value: { idempotencyKey, requestId } };
}
