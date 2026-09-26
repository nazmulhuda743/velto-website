"use server";

import { redirect } from "next/navigation";
import { logActivity } from "@/lib/admin/activity";
import { saveContent } from "@/lib/admin/content-store";
import { COPY_AREAS, copyBase, copyEntries } from "@/lib/admin/copy-catalog";
import { requireSection } from "@/lib/admin/session";
import { copyProblem, type CopyNamespace } from "@/lib/i18n/copy-overrides";
import { getSiteContent } from "@/lib/site-content";

const text = (form: FormData, key: string, max: number) => String(form.get(key) ?? "").slice(0, max);

/** Save or reset one piece of website text (Text & copy). The original stays in the code. */
export async function saveCopyAction(form: FormData) {
  const admin = await requireSection("copy");
  const ns = text(form, "ns", 20) as CopyNamespace;
  const lang = text(form, "lang", 2) === "bn" ? "bn" : "en";
  const path = text(form, "path", 200);
  const group = text(form, "group", 80);
  const q = text(form, "q", 60);
  const params = new URLSearchParams({ ns, lang, ...(group ? { group } : {}), ...(q ? { q } : {}) });
  const back = (extra: Record<string, string>): never => redirect(`/admin/copy?${params}&${new URLSearchParams(extra)}#t-${encodeURIComponent(path)}`);

  if (!COPY_AREAS.some((a) => a.ns === ns)) redirect("/admin/copy?error=Unknown+area");
  const entry = copyEntries(ns, lang).find((e) => e.path === path);
  if (!entry || !copyBase(ns, lang)) back({ error: "That text can't be edited here.", at: path });
  const original = entry!.original;
  const reset = form.get("op") === "reset";
  const value = text(form, "text", 4000).replace(/\r\n/g, "\n").trim();

  const { copy } = await getSiteContent();
  const key = `${ns}.${path}`;
  const before = copy[lang][key] ?? original;
  if (reset || value === original) {
    delete copy[lang][key];
  } else {
    const problem = copyProblem(original, value);
    if (problem) back({ error: problem, at: path });
    copy[lang][key] = value;
  }
  try {
    await saveContent("copy", copy, admin.name);
  } catch {
    back({ error: "Couldn't save the text. Try again.", at: path });
  }
  const now = copy[lang][key] ?? original;
  await logActivity(admin, {
    section: "copy",
    action: reset || value === original ? "copy_reset" : "copy_saved",
    target: `${lang}:${key}`,
    summary: `${reset || value === original ? "Restored the original" : "Edited the"} ${lang === "bn" ? "Bangla" : "English"} text “${entry!.label}” (${COPY_AREAS.find((a) => a.ns === ns)!.title})`,
    detail: { before: before.slice(0, 600), after: now.slice(0, 600) },
  });
  back({ saved: path });
}
