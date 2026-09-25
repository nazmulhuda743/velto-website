/**
 * Submission adapter for the booking and quote forms. Posts to the
 * website-owned endpoints (/api/bookings, /api/quotes), which validate with
 * the Codex Ops contracts and forward to the Velto Ops gateway once one is
 * configured (src/lib/integrations/ops/server.ts). Until then the endpoints
 * answer 501 and the UI keeps its honest "isn't switched on yet" state — no
 * fake success is ever shown.
 */
import { track } from "@/components/layout/Analytics";
import { submissionAttribution } from "@/lib/attribution-client";

export type BookingFormData = {
  name: string;
  phone: string;
  area: string;
  address: string;
  preferredPickup?: string;
  service?: string;
  /** Optional item lines; the server validates them and writes them into the Ops notes. */
  items?: { item: string; service?: string; quantity: number }[];
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

/**
 * One idempotency key per distinct payload, reused across retries of the same
 * submission so Velto Ops can deduplicate (Codex SubmissionContext contract).
 */
const idempotencyKeys = new Map<string, string>();
function idempotencyKeyFor(fingerprint: string) {
  let key = idempotencyKeys.get(fingerprint);
  if (!key) {
    key = crypto.randomUUID();
    idempotencyKeys.set(fingerprint, key);
  }
  return key;
}

async function post(path: string, data: Record<string, unknown>): Promise<SubmitResult> {
  const payload = { ...data, attribution: submissionAttribution() };
  try {
    const res = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data: payload, idempotencyKey: idempotencyKeyFor(JSON.stringify(data)) }),
    });
    if (res.status === 501) return { ok: false, code: "not_connected" };
    const body = (await res.json().catch(() => null)) as
      | { ok?: boolean; reference?: unknown; error?: { code?: string } }
      | null;
    if (res.ok && body?.ok) {
      return { ok: true, reference: typeof body.reference === "string" ? body.reference : undefined };
    }
    if (body?.error?.code === "invalid_request") return { ok: false, code: "invalid_request" };
    if (body?.error?.code === "duplicate_submission") return { ok: false, code: "duplicate_submission" };
    return { ok: false, code: "unavailable" };
  } catch {
    return { ok: false, code: "unavailable" };
  }
}

export async function submitBooking(data: BookingFormData): Promise<SubmitResult> {
  const result = await post("/api/bookings", { ...data });
  if (!result.ok) {
    track("booking_error", {
      section: "booking-form",
      service: data.service,
    });
  }
  return result;
}

export async function submitQuote(data: QuoteFormData): Promise<SubmitResult> {
  const { photos, ...fields } = data;
  void photos; // Photos never leave the browser until the controlled upload flow exists.
  return post("/api/quotes", { ...fields, photoReferences: [] });
}
