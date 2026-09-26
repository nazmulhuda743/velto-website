"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { previewSpendCsv, spendKey, validateSpend, type CsvPreview, type SpendInput } from "@/lib/admin/revenue";
import { deleteSpend, insertSpend, listSpend, reviewLink, runMatching, updateSpend } from "@/lib/admin/revenue-data";
import { logActivity } from "@/lib/admin/activity";
import { requireSection } from "@/lib/admin/session";

const SPEND_PATH = "/admin/revenue/spend";
const back = (path: string, params: Record<string, string>): never => redirect(`${path}?${new URLSearchParams(params)}`);
const field = (form: FormData, key: string) => String(form.get(key) ?? "");

/* ---------- spend: manual entry ---------- */

export async function saveSpendAction(form: FormData) {
  const admin = await requireSection("revenue");
  const id = field(form, "id");
  const v = validateSpend(Object.fromEntries([...form.entries()].map(([k, val]) => [k, typeof val === "string" ? val : ""])));
  if (!v.ok) back(SPEND_PATH, { error: v.error, ...(id ? { edit: id } : {}) });
  const value = (v as { ok: true; value: SpendInput }).value;
  const result = id ? await updateSpend(id, value, admin.name) : await insertSpend([value], admin.name, "manual");
  if (!result.ok) back(SPEND_PATH, { error: result.error, ...(id ? { edit: id } : {}) });
  revalidatePath("/admin/revenue");
  await logActivity(admin, {
    section: "revenue",
    action: id ? "spend_updated" : "spend_added",
    target: id || null,
    summary: `${id ? "Edited" : "Added"} ad spend for ${value.spend_date}`,
    detail: { ...value },
  });
  back(SPEND_PATH, { saved: id ? "updated" : "added", from: value.spend_date.slice(0, 7) + "-01" });
}

export async function deleteSpendAction(form: FormData) {
  const admin = await requireSection("revenue");
  if (field(form, "confirm") !== "yes") back(SPEND_PATH, { error: "Deletion was not confirmed." });
  const result = await deleteSpend(field(form, "id"), admin.name);
  if (!result.ok) back(SPEND_PATH, { error: result.error });
  revalidatePath("/admin/revenue");
  await logActivity(admin, { section: "revenue", action: "spend_deleted", target: field(form, "id"), summary: "Deleted an ad spend entry" });
  back(SPEND_PATH, { saved: "deleted" });
}

/* ---------- spend: CSV import (preview → confirm) ---------- */

export type CsvState =
  | { stage: "idle" }
  | { stage: "preview"; preview: CsvPreview; payload: string; fileName: string }
  | { stage: "done"; imported: number }
  | { stage: "error"; error: string };

const MAX_CSV_BYTES = 512 * 1024;

async function existingKeysFor(rows: SpendInput[]) {
  if (!rows.length) return new Set<string>();
  const dates = rows.map((r) => r.spend_date).sort();
  const existing = await listSpend(dates[0], dates[dates.length - 1]);
  return new Set(existing.map((s) => spendKey(s)));
}

export async function csvSpendAction(_: CsvState, form: FormData): Promise<CsvState> {
  const admin = await requireSection("revenue");
  const mode = field(form, "mode");

  if (mode === "confirm") {
    // Re-validate everything from the preview payload; nothing from the client is trusted.
    let raw: unknown;
    try {
      raw = JSON.parse(field(form, "payload"));
    } catch {
      return { stage: "error", error: "The preview expired. Upload the file again." };
    }
    if (!Array.isArray(raw) || raw.length > 1000) return { stage: "error", error: "The preview expired. Upload the file again." };
    const rows: SpendInput[] = [];
    for (const item of raw) {
      const v = validateSpend(item && typeof item === "object" ? (item as Record<string, unknown>) : {});
      if (!v.ok) return { stage: "error", error: `A row no longer validates: ${v.error}` };
      rows.push(v.value);
    }
    const existing = await existingKeysFor(rows);
    const seen = new Set<string>();
    const fresh = rows.filter((r) => {
      const k = spendKey(r);
      if (existing.has(k) || seen.has(k)) return false;
      seen.add(k);
      return true;
    });
    const result = await insertSpend(fresh, admin.name, "csv", randomUUID());
    if (!result.ok) return { stage: "error", error: result.error };
    revalidatePath("/admin/revenue");
    await logActivity(admin, { section: "revenue", action: "spend_imported", summary: `Imported ${fresh.length} ad spend rows from CSV` });
    return { stage: "done", imported: fresh.length };
  }

  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) return { stage: "error", error: "Choose a CSV file." };
  if (file.size > MAX_CSV_BYTES) return { stage: "error", error: "CSV files must be smaller than 512 KB." };
  if (!/\.csv$/i.test(file.name)) return { stage: "error", error: "Upload a .csv file." };
  const text = await file.text();
  const first = previewSpendCsv(text, new Set());
  if (first.headerError) return { stage: "error", error: first.headerError };
  const existing = await existingKeysFor(first.rows.flatMap((r) => (r.value ? [r.value] : [])));
  const preview = previewSpendCsv(text, existing);
  return { stage: "preview", preview, payload: JSON.stringify(preview.valid.map((v) => ({ ...v, date: v.spend_date }))), fileName: file.name.slice(0, 80) };
}

/* ---------- review queue ---------- */

export async function reviewLinkAction(form: FormData) {
  const admin = await requireSection("revenue");
  const action = field(form, "action");
  if (action !== "confirm" && action !== "reject" && action !== "reverse") back("/admin/revenue/review", { error: "Unknown action." });
  const result = await reviewLink(field(form, "link_id"), action as "confirm", admin.name, field(form, "note").trim());
  if (!result.ok) back("/admin/revenue/review", { error: result.error });
  revalidatePath("/admin/revenue");
  await logActivity(admin, { section: "revenue", action: `attribution_${action}`, target: field(form, "link_id"), summary: `${{ confirm: "Confirmed", reject: "Rejected", reverse: "Reversed" }[action]} a lead-to-order match` });
  back("/admin/revenue/review", { saved: action });
}

export async function runMatchingAction() {
  const admin = await requireSection("revenue");
  const result = await runMatching();
  if (!result.ok) back("/admin/revenue", { error: result.error });
  const s = (result as { ok: true; summary: { linked: number; updated: number; superseded: number } }).summary;
  revalidatePath("/admin/revenue");
  await logActivity(admin, { section: "revenue", action: "matching_run", summary: `Ran lead matching: ${s.linked} linked, ${s.updated} updated` });
  back("/admin/revenue", { matched: `${s.linked}.${s.updated}.${s.superseded}` });
}
