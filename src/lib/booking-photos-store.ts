import "server-only";

import { randomBytes } from "node:crypto";
import { BOOKING_PHOTO_BUCKET, isPhotoId, type PhotoType } from "./booking-photos";
import { supabaseFetch, supabaseOrigin } from "./supabase-server";

/**
 * Private Storage for booking photos (bucket `booking-photos`, not public). Objects are named by
 * a random 128-bit id and read only through short-lived signed URLs (see /go/photo/[id]).
 */
export async function storeBookingPhoto(bytes: Uint8Array, type: PhotoType): Promise<string> {
  const id = randomBytes(16).toString("hex");
  const res = await supabaseFetch(`/storage/v1/object/${BOOKING_PHOTO_BUCKET}/${id}`, {
    method: "POST",
    headers: { "Content-Type": type, "x-upsert": "false" },
    body: Buffer.from(bytes),
    cache: "no-store",
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`booking photo upload failed with HTTP ${res.status}`);
  return id;
}

/** A signed URL valid for `seconds`, or null when the photo doesn't exist. */
export async function signedBookingPhotoUrl(id: string, seconds = 600): Promise<string | null> {
  if (!isPhotoId(id)) return null;
  const res = await supabaseFetch(`/storage/v1/object/sign/${BOOKING_PHOTO_BUCKET}/${id}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ expiresIn: seconds }),
    cache: "no-store",
  });
  if (!res.ok) return null;
  const body = (await res.json().catch(() => null)) as { signedURL?: unknown } | null;
  return typeof body?.signedURL === "string" && body.signedURL.startsWith("/") ? `${supabaseOrigin()}/storage/v1${body.signedURL}` : null;
}
