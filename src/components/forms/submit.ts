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
  /** Services chosen at the top of the form (Dry Cleaning, Wash & Iron, Ironing). */
  services?: string[];
  /** When the customer wants the order back (YYYY-MM-DD); the server words it for Ops. */
  deliveryBy?: string;
  /** Ids of photos already uploaded through /api/bookings/photos (the server links them in the notes). */
  photos?: string[];
  notes?: string;
  /** The pickup window chosen from live capacity (reserved when the booking is confirmed). */
  slot?: { date: string; window: string };
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
  | { ok: false; code: "not_connected" | "invalid_request" | "unavailable" | "duplicate_submission" | "slot_unavailable" | "sign_in_required" };

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
    if (body?.error?.code === "slot_unavailable") return { ok: false, code: "slot_unavailable" };
    if (body?.error?.code === "sign_in_required") return { ok: false, code: "sign_in_required" };
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

export type PhotoUploadResult = { ok: true; id: string } | { ok: false; code: "invalid_type" | "too_large" | "rate_limited" | "unavailable" };

/**
 * Sends one booking photo (already shrunk in the browser) to private storage and returns its
 * id, which the booking then carries. Nothing about the photo is tracked.
 */
export async function uploadBookingPhoto(photo: Blob): Promise<PhotoUploadResult> {
  const form = new FormData();
  form.append("photo", photo, "photo");
  try {
    const res = await fetch("/api/bookings/photos", { method: "POST", body: form });
    const body = (await res.json().catch(() => null)) as { ok?: boolean; id?: unknown; error?: { code?: string } } | null;
    if (res.ok && body?.ok && typeof body.id === "string") return { ok: true, id: body.id };
    const code = body?.error?.code;
    return { ok: false, code: code === "invalid_type" || code === "too_large" || code === "rate_limited" ? code : "unavailable" };
  } catch {
    return { ok: false, code: "unavailable" };
  }
}

export type CallbackFormData = { name: string; phone: string; area?: string; what?: string; services?: string; preferred?: string };
export type CallbackResult = { ok: true } | { ok: false; code: "not_connected" | "invalid_request" | "rate_limited" | "unavailable" };

/** "Get a call back" from the booking form: sent only when the visitor taps the button. */
export async function submitCallback(data: CallbackFormData): Promise<CallbackResult> {
  try {
    const res = await fetch("/api/callback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data: { ...data, attribution: submissionAttribution() }, idempotencyKey: idempotencyKeyFor(`callback:${JSON.stringify(data)}`) }),
    });
    if (res.ok) return { ok: true };
    if (res.status === 501) return { ok: false, code: "not_connected" };
    if (res.status === 429) return { ok: false, code: "rate_limited" };
    if (res.status === 400) return { ok: false, code: "invalid_request" };
    return { ok: false, code: "unavailable" };
  } catch {
    return { ok: false, code: "unavailable" };
  }
}
