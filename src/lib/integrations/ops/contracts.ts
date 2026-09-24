import type { Attribution } from "../../attribution";

const SERVICES = [
  "dry-cleaning",
  "wash-and-iron",
  "ironing",
  "curtain-cleaning",
  "carpet-cleaning",
  "blanket-comforter-cleaning",
  "express",
] as const;

export type ServiceSlug = (typeof SERVICES)[number];

export type BookingSubmission = {
  name: string;
  phone: string;
  area: string;
  address: string;
  preferredPickup?: string;
  service?: ServiceSlug;
  notes?: string;
  attribution: Attribution;
};

export type QuoteSubmission = {
  name: string;
  phone: string;
  area: string;
  service: Extract<
    ServiceSlug,
    | "curtain-cleaning"
    | "carpet-cleaning"
    | "blanket-comforter-cleaning"
  >;
  approximateDetails?: string;
  notes?: string;
  /** References to uploads accepted by a separate controlled upload flow. */
  photoReferences: string[];
  attribution: Attribution;
};

export type SubmissionContext = {
  /** Opaque request token used by the eventual Ops endpoint for deduplication. */
  idempotencyKey: string;
  requestId: string;
};

export interface VeltoOpsGateway {
  createBooking(
    input: BookingSubmission,
    context: SubmissionContext,
  ): Promise<{ reference: string }>;
  createQuote(
    input: QuoteSubmission,
    context: SubmissionContext,
  ): Promise<{ reference: string }>;
}

export function isServiceSlug(value: string): value is ServiceSlug {
  return (SERVICES as readonly string[]).includes(value);
}
