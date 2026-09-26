import { legacyOpsAttribution, readSubmissionAttribution } from "../../attribution";
import {
  cleanBookingItems,
  composeBookingNotes,
  isGarmentService,
  MAX_BOOKING_NOTES,
  sharedItemService,
  type GarmentService,
} from "../../booking-items";
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
  options: { required?: boolean; min?: number; max: number; multiline?: boolean },
) {
  const raw = input[field];
  // Textareas: line breaks become " / ". The Ops task text is one line per field, so a
  // customer's line break must not start a new line there (or look like another field).
  const value =
    options.multiline && typeof raw === "string"
      ? raw
          .trim()
          .replace(/(?:[ \t]*(?:\r\n|[\r\n\u2028\u2029]))+[ \t]*/g, " / ")
          .replace(/\t/g, " ")
      : raw;
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

const DAY_MS = 86_400_000;
/** Today's date in Dhaka as YYYY-MM-DD. */
const dhakaToday = (now: Date) => new Date(now.getTime() + 6 * 3_600_000).toISOString().slice(0, 10);

/**
 * "When do you want it back?": an ISO date from today (Dhaka) up to 180 days ahead, worded for
 * Ops staff ("Fri 3 Oct"). `null` means the value is unusable; undefined means none was given.
 */
export function readBackBy(value: unknown, now = new Date()): string | null | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) return null;
  const today = new Date(`${dhakaToday(now)}T00:00:00Z`).getTime();
  if (date.getTime() < today || date.getTime() > today + 180 * DAY_MS) return null;
  return `${WEEKDAYS[date.getUTCDay()]} ${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]}`;
}

// Fixed words (not Intl, whose short month names differ between runtimes: "Sep" / "Sept").
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** The services chosen at the top of /book: Dry Cleaning, Wash & Iron and/or Ironing. */
function readServices(value: unknown): GarmentService[] | null {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 3 || !value.every(isGarmentService)) return null;
  return [...new Set(value)];
}

export function validateBookingSubmission(
  value: unknown,
  /** Server-computed website estimate (from the Ops price list), added to the notes when it fits. */
  options: { estimate?: string; now?: Date } = {},
): ValidationResult<BookingSubmission> {
  const input = record(value);
  if (!input) return { ok: false, issues: [{ field: "request", code: "invalid" }] };

  const issues: ValidationIssue[] = [];
  const name = text(input, "name", issues, { required: true, min: 2, max: 100 });
  const phone = text(input, "phone", issues, { required: true, max: 32 });
  const area = text(input, "area", issues, { required: true, min: 2, max: 120 });
  const address = text(input, "address", issues, { required: true, min: 5, max: 500 });
  const preferredPickup = text(input, "preferredPickup", issues, { max: 120 });
  const note = text(input, "notes", issues, { max: MAX_BOOKING_NOTES, multiline: true });
  const rawService = input.service;
  const chosenService =
    typeof rawService === "string" && isServiceSlug(rawService)
      ? rawService
      : undefined;
  // Itemised lines, chosen services, the estimate and the wanted-back date ride in the notes
  // (the Ops intake has no columns for them).
  const items = cleanBookingItems(input.items);
  const services = readServices(input.services);
  const backBy = readBackBy(input.deliveryBy, options.now);
  const extras = {
    services: !items?.length && services && services.length > 1 ? services : undefined,
    backBy: backBy ?? undefined,
  };
  const withEstimate = items ? composeBookingNotes(items, note, { ...extras, estimate: options.estimate }) : note;
  // The estimate is a courtesy for staff: drop it rather than reject a booking whose notes are full.
  const notes =
    withEstimate && withEstimate.length > MAX_BOOKING_NOTES && items ? composeBookingNotes(items, note, extras) : withEstimate;
  const service =
    chosenService ?? (items ? sharedItemService(items) : undefined) ?? (services?.length === 1 ? services[0] : undefined);

  if (phone && !PHONE_PATTERN.test(phone)) issues.push({ field: "phone", code: "invalid" });
  if (rawService !== undefined && !chosenService) issues.push({ field: "service", code: "invalid" });
  if (!services) issues.push({ field: "services", code: "invalid" });
  if (backBy === null) issues.push({ field: "deliveryBy", code: "invalid" });
  if (!items) issues.push({ field: "items", code: "invalid" });
  else if (notes && notes.length > MAX_BOOKING_NOTES) issues.push({ field: "notes", code: "too_long" });
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
  const approximateDetails = text(input, "approximateDetails", issues, { max: 1_000, multiline: true });
  const notes = text(input, "notes", issues, { max: 1_000, multiline: true });
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
