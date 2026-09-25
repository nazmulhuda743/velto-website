import "server-only";

import { randomUUID } from "node:crypto";
import { revalidatePath, updateTag } from "next/cache";
import { SITE_CONTENT_TAG } from "../site-content";
import { supabaseFetch, supabaseOrigin } from "../supabase-server";
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_LABEL } from "./upload-limits";

export type ContentKey = "settings" | "seo" | "images" | "reviews";

/** Upsert one content document, then refresh every public page. */
export async function saveContent(key: ContentKey, value: unknown, updatedBy: string) {
  const res = await supabaseFetch("/rest/v1/website_content?on_conflict=key", {
    method: "POST",
    headers: { "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify({ key, value, updated_at: new Date().toISOString(), updated_by: updatedBy.slice(0, 120) }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Saving ${key} failed with HTTP ${res.status}`);
  updateTag(SITE_CONTENT_TAG);
  revalidatePath("/", "layout");
}

const BUCKET = "website-media";
const TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
};

/** The real image type from the file's first bytes; the browser's type only reflects the file name. */
function sniffImageType(head: Buffer): string | null {
  const ascii = (from: number, to: number) => head.subarray(from, to).toString("latin1");
  if (head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) return "image/jpeg";
  if (ascii(0, 8) === "\x89PNG\r\n\x1a\n") return "image/png";
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "image/webp";
  if (ascii(4, 8) === "ftyp" && ["avif", "avis"].includes(ascii(8, 12))) return "image/avif";
  return null;
}

/** Upload an admin image to public Storage and return its URL. */
export async function uploadImage(file: File, folder: string): Promise<string> {
  if (file.size === 0 || file.size > MAX_UPLOAD_BYTES) throw new Error(`Images must be smaller than ${MAX_UPLOAD_LABEL}.`);
  const bytes = Buffer.from(await file.arrayBuffer());
  const type = sniffImageType(bytes);
  const ext = type && TYPES[type];
  if (!type || !ext) throw new Error("Use a JPG, PNG, WebP or AVIF image.");
  const safeFolder = folder.replace(/[^a-z0-9-]/gi, "-").toLowerCase().slice(0, 40) || "misc";
  const path = `${safeFolder}/${new Date().toISOString().slice(0, 10)}-${randomUUID().slice(0, 8)}.${ext}`;
  const res = await supabaseFetch(`/storage/v1/object/${BUCKET}/${path}`, {
    method: "POST",
    headers: { "Content-Type": type, "Cache-Control": "31536000" },
    body: bytes,
    cache: "no-store",
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`Upload failed with HTTP ${res.status}`);
  return `${supabaseOrigin()}/storage/v1/object/public/${BUCKET}/${path}`;
}
