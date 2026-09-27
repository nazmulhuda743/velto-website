/**
 * Customer photos on a booking (optional). Pure helpers shared by the browser, the API routes
 * and the tests: no server imports, so they compile inside the foundation test build.
 *
 * A photo is stored privately under an unguessable id (128 random bits). The Ops task gets a
 * link per photo, /go/photo/<id>, which redirects to a short-lived signed Storage URL.
 */
export const MAX_BOOKING_PHOTOS = 3;
/** Vercel rejects request bodies over 4.5 MB; photos are shrunk in the browser well below this. */
export const MAX_PHOTO_BYTES = 4 * 1024 * 1024;
export const BOOKING_PHOTO_BUCKET = "booking-photos";

const PHOTO_ID = /^[a-f0-9]{32}$/;

export const isPhotoId = (value: unknown): value is string => typeof value === "string" && PHOTO_ID.test(value);

/** Photo ids sent with a booking: undefined when none, null when unusable. */
export function readPhotoIds(value: unknown): string[] | null | undefined {
  if (value === undefined || value === null) return undefined;
  if (!Array.isArray(value) || value.length > MAX_BOOKING_PHOTOS || !value.every(isPhotoId)) return null;
  const ids = [...new Set(value as string[])];
  return ids.length ? ids : undefined;
}

export const photoLink = (siteUrl: string, id: string) => `${siteUrl.replace(/\/+$/, "")}/go/photo/${id}`;

export type PhotoType = "image/jpeg" | "image/png" | "image/webp";

/** The real image type from the file's first bytes (the browser's type only reflects the name). */
export function sniffPhotoType(head: Uint8Array): PhotoType | null {
  const ascii = (from: number, to: number) => String.fromCharCode(...head.subarray(from, to));
  if (head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) return "image/jpeg";
  if (ascii(0, 8) === "\x89PNG\r\n\x1a\n") return "image/png";
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "image/webp";
  return null;
}
