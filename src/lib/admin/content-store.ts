import "server-only";

import { randomUUID } from "node:crypto";
import { revalidatePath, updateTag } from "next/cache";
import { logServerEvent } from "../observability/log";
import { SITE_CONTENT_TAG } from "../site-content";
import { supabaseFetch, supabaseOrigin } from "../supabase-server";

export type ContentKey = "settings" | "seo" | "images" | "reviews";

/** Upsert one content document, then refresh every public page. */
export async function saveContent(key: ContentKey, value: unknown, updatedBy: string) {
  const res = await supabaseFetch("/rest/v1/website_content?on_conflict=key", {
    method: "POST",
    headers: { "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify({ key, value, updated_at: new Date().toISOString(), updated_by: updatedBy.slice(0, 120) }),
    cache: "no-store",
  });
  if (!res.ok) {
    logServerEvent("admin_content_save_failure", "error", { contentKey: key, status: res.status });
    throw new Error(`Saving ${key} failed with HTTP ${res.status}`);
  }
  updateTag(SITE_CONTENT_TAG);
  revalidatePath("/", "layout");
}

const BUCKET = "website-media";
const MAX_BYTES = 8 * 1024 * 1024;
const TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
};

/** Upload an admin image to public Storage and return its URL. */
export async function uploadImage(file: File, folder: string): Promise<string> {
  const ext = TYPES[file.type];
  if (!ext) throw new Error("Use a JPG, PNG, WebP or AVIF image.");
  if (file.size === 0 || file.size > MAX_BYTES) throw new Error("Images must be smaller than 8 MB.");
  const safeFolder = folder.replace(/[^a-z0-9-]/gi, "-").toLowerCase().slice(0, 40) || "misc";
  const path = `${safeFolder}/${new Date().toISOString().slice(0, 10)}-${randomUUID().slice(0, 8)}.${ext}`;
  const res = await supabaseFetch(`/storage/v1/object/${BUCKET}/${path}`, {
    method: "POST",
    headers: { "Content-Type": file.type, "Cache-Control": "31536000" },
    body: Buffer.from(await file.arrayBuffer()),
    cache: "no-store",
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) {
    logServerEvent("storage_upload_failure", "error", { bucket: BUCKET, status: res.status });
    throw new Error(`Upload failed with HTTP ${res.status}`);
  }
  return `${supabaseOrigin()}/storage/v1/object/public/${BUCKET}/${path}`;
}
