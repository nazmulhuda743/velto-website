/**
 * INTEGRATION POINT — owned by Codex (booking and quote gateways).
 *
 * The UI calls these functions only. They are deliberately NOT connected:
 * they send nothing and always report `not_connected`, so the UI can never
 * show a false success. Codex replaces the bodies with calls to the
 * website-owned routes that use `BookingSubmission` / `QuoteSubmission`
 * validation, attribution and idempotency (docs/technical/INTEGRATIONS.md on
 * codex/velto-technical-foundation).
 */

export type BookingFormData = {
  name: string;
  phone: string;
  area: string;
  address: string;
  preferredPickup?: string;
  service?: string;
  notes?: string;
};

export type QuoteFormData = {
  name: string;
  phone: string;
  area: string;
  service: "curtain-cleaning" | "carpet-cleaning" | "blanket-comforter-cleaning";
  approximateDetails?: string;
  notes?: string;
  /** Selected files stay in the browser. The controlled upload flow is not built yet. */
  photos: File[];
};

export type SubmitResult =
  /** `reference` is issued by Velto Ops; the UI never invents one. */
  | { ok: true; reference?: string }
  | { ok: false; code: "not_connected" | "invalid_request" | "unavailable" | "duplicate_submission" };

export async function submitBooking(data: BookingFormData): Promise<SubmitResult> {
  void data;
  return { ok: false, code: "not_connected" };
}

export async function submitQuote(data: QuoteFormData): Promise<SubmitResult> {
  void data;
  return { ok: false, code: "not_connected" };
}
