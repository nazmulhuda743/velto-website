"use server";

import { redirect } from "next/navigation";
import { logActivity } from "@/lib/admin/activity";
import { saveContent } from "@/lib/admin/content-store";
import { requireSection } from "@/lib/admin/session";
import { logServerEvent } from "@/lib/analytics/store";
import { parseRhythm, templateProblem, type RhythmSettings } from "@/lib/rhythm";
import { refreshRhythm } from "@/lib/rhythm-server";
import { getSiteContent } from "@/lib/site-content";

const PAGE = "/admin/retention/reminders";
const back = (params: Record<string, string>): never => redirect(`${PAGE}?${new URLSearchParams(params)}#${params.playbook ?? ""}`);
const text = (form: FormData, key: string, max: number) => String(form.get(key) ?? "").trim().slice(0, max);

/** Save one playbook: switched on or off, its limit and (for SMS) its message text. */
export async function saveRhythmAction(form: FormData) {
  const admin = await requireSection("retention");
  const playbook = text(form, "playbook", 20);
  // Messaging customers is a business decision: only an Owner or a Manager changes a playbook.
  if (admin.role !== "owner" && admin.role !== "manager") back({ error: "Only an Owner or a Manager can change reminders.", playbook });
  const { rhythm } = await getSiteContent();
  const next: RhythmSettings = structuredClone(rhythm);
  if (playbook === "regular_due") {
    const textBn = text(form, "textBn", 400);
    const textEn = text(form, "textEn", 400);
    const problem = templateProblem(textBn) ?? templateProblem(textEn);
    if (problem) back({ error: problem, playbook });
    next.regularDue = {
      enabled: form.get("enabled") === "on",
      maxPerRun: Number(text(form, "max", 3)) || rhythm.regularDue.maxPerRun,
      lang: form.get("lang") === "en" ? "en" : "bn",
      textBn,
      textEn,
    };
  } else if (playbook === "slipping") {
    next.slipping = { enabled: form.get("enabled") === "on", maxPerDay: Number(text(form, "max", 3)) || rhythm.slipping.maxPerDay };
  } else {
    back({ error: "Unknown playbook." });
  }
  next.updatedAt = new Date().toISOString();
  const clean = parseRhythm(next);
  try {
    await saveContent("rhythm", clean, admin.name);
  } catch (e) {
    await logServerEvent("content_save_error", PAGE);
    back({ error: (e instanceof Error ? e.message : "Something went wrong.").slice(0, 160), playbook });
  }
  const before = playbook === "regular_due" ? rhythm.regularDue : rhythm.slipping;
  const after = playbook === "regular_due" ? clean.regularDue : clean.slipping;
  await logActivity(admin, {
    section: "retention",
    action: "rhythm_playbook_saved",
    target: playbook,
    summary: `Reminders “${playbook === "regular_due" ? "Regular, due now" : "Slipping regulars"}” ${after.enabled ? (before.enabled ? "updated" : "switched on") : before.enabled ? "switched off" : "saved (off)"}`,
    detail: { before, after },
  });
  back({ saved: playbook, playbook });
}

/** Rebuild everyone's group now (the daily runs do this too). */
export async function refreshRhythmAction() {
  await requireSection("retention");
  try {
    await refreshRhythm();
  } catch {
    back({ error: "The groups could not be rebuilt right now." });
  }
  back({ saved: "refresh" });
}
