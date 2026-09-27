import { NextResponse, type NextRequest } from "next/server";
import { MAX_PHOTO_BYTES, sniffPhotoType } from "@/lib/booking-photos";
import { storeBookingPhoto } from "@/lib/booking-photos-store";
import { getOpsGateway } from "@/lib/integrations/ops/server";
import { otpAllowed } from "@/lib/sms/limits";
import { isSupabaseConfigured } from "@/lib/supabase-server";

/**
 * One optional photo for a booking: POST multipart/form-data { photo } → { ok: true, id }.
 * The browser shrinks photos before sending. The real type is read from the file's bytes
 * (JPG, PNG or WebP only), uploads are limited per IP, and the file goes to private Storage.
 * The booking then carries the id; staff open the photo from the Ops task (/go/photo/[id]).
 */
export const dynamic = "force-dynamic";

const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
const fail = (code: string, status: number) => json({ ok: false, error: { code } }, status);
const hostOf = (origin: string) => {
  try {
    return new URL(origin).host;
  } catch {
    return null;
  }
};

export async function POST(request: NextRequest) {
  if (!getOpsGateway() || !isSupabaseConfigured()) return fail("not_connected", 501);

  // Browsers always send Origin on a cross-site POST; only this site's pages may upload.
  const origin = request.headers.get("origin");
  if (origin && hostOf(origin) !== request.headers.get("host")) return fail("forbidden", 403);
  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > MAX_PHOTO_BYTES + 64 * 1024) return fail("too_large", 413);
  if (!request.headers.get("content-type")?.startsWith("multipart/form-data")) return fail("invalid_request", 415);

  let file: FormDataEntryValue | null = null;
  try {
    file = (await request.formData()).get("photo");
  } catch {
    return fail("invalid_request", 400);
  }
  if (!(file instanceof File) || file.size === 0) return fail("invalid_request", 400);
  if (file.size > MAX_PHOTO_BYTES) return fail("too_large", 413);

  const bytes = new Uint8Array(await file.arrayBuffer());
  const type = sniffPhotoType(bytes.subarray(0, 16));
  if (!type) return fail("invalid_type", 415);

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!(await otpAllowed("photo", ip))) return fail("rate_limited", 429);

  try {
    return json({ ok: true, id: await storeBookingPhoto(bytes, type) });
  } catch (error) {
    console.error("booking_photo_failed", error instanceof Error ? error.message : "unknown");
    return fail("unavailable", 502);
  }
}
