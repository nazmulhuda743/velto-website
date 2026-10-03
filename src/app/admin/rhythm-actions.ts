"use server";

import { redirect } from "next/navigation";
import { logActivity } from "@/lib/admin/activity";
import { saveContent } from "@/lib/admin/content-store";
import { requireSection } from "@/lib/admin/session";
import { logServerEvent } from "@/lib/analytics/store";
import { parseRhythm, PLAYBOOK_ID, renderMessage, rhythmLink, SMS_PLAYBOOKS, templateProblem, type RhythmSettings, type SmsPlaybookKey } from "@/lib/rhythm";
import { normaliseBdPhone } from "@/lib/customer/validation";
import { SITE_URL } from "@/lib/site-url";
import { sendSms, smsConfigured } from "@/lib/sms/send";
import { refreshRhythm } from "@/lib/rhythm-server";
import { getSiteContent } from "@/lib/site-content";

const PAGE = "/admin/retention/reminders";
const back = (params: Record<string, string>): never => redirect(`${PAGE}?${new URLSearchParams(params)}#${params.playbook ?? ""}`);
const text = (form: FormData, key: string, max: number) => String(form.get(key) ?? "").trim().slice(0, max);

const NAMES: Record<string, string> = { regular_due: "Regular, due now", onetimer: "First-timer", seasonal: "Season", slipping: "Slipping regulars" };

/** Save one playbook: switched on or off, its limit and (for SMS) its message text. */
export async function saveRhythmAction(form: FormData) {
  const admin = await requireSection("retention");
  const playbook = text(form, "playbook", 20);
  // Messaging customers is a business decision: only an Owner or a Manager changes a playbook.
  if (admin.role !== "owner" && admin.role !== "manager") back({ error: "Only an Owner or a Manager can change reminders.", playbook });
  const { rhythm } = await getSiteContent();
  const next: RhythmSettings = structuredClone(rhythm);
  const key = SMS_PLAYBOOKS.find((k) => PLAYBOOK_ID[k] === playbook);
  if (key) {
    const textBn = text(form, "textBn", 400);
    const textEn = text(form, "textEn", 400);
    // First-timer: also the text for customers whose first order was dry cleaning only.
    const dcTextBn = key === "onetimer" ? text(form, "dcTextBn", 400) : "";
    const dcTextEn = key === "onetimer" ? text(form, "dcTextEn", 400) : "";
    const problem = templateProblem(textBn) ?? templateProblem(textEn) ?? (key === "onetimer" ? (templateProblem(dcTextBn) ?? templateProblem(dcTextEn)) : null);
    if (problem) back({ error: problem, playbook });
    next[key] = {
      enabled: form.get("enabled") === "on",
      maxPerRun: Number(text(form, "max", 3)) || rhythm[key].maxPerRun,
      lang: form.get("lang") === "en" ? "en" : "bn",
      textBn,
      textEn,
      ...(key === "onetimer" ? { dcTextBn, dcTextEn } : {}),
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
  const before = key ? rhythm[key] : rhythm.slipping;
  const after = key ? clean[key] : clean.slipping;
  await logActivity(admin, {
    section: "retention",
    action: "rhythm_playbook_saved",
    target: playbook,
    summary: `Reminders “${NAMES[playbook] ?? playbook}” ${after.enabled ? (before.enabled ? "updated" : "switched on") : before.enabled ? "switched off" : "saved (off)"}`,
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

/**
 * Send this playbook's SMS, as a customer would get it, to a number the Owner or Manager types
 * (their own). The link opens the example page (/r/preview0), which can't book.
 */
export async function testRhythmSmsAction(form: FormData) {
  const admin = await requireSection("retention");
  const playbook = text(form, "playbook", 20);
  if (admin.role !== "owner" && admin.role !== "manager") back({ error: "Only an Owner or a Manager can send a test.", playbook });
  const key: SmsPlaybookKey | undefined = SMS_PLAYBOOKS.find((k) => PLAYBOOK_ID[k] === playbook);
  const phone = normaliseBdPhone(text(form, "phone", 20));
  if (!key) back({ error: "Unknown playbook." });
  if (!phone) back({ error: "Type a Bangladeshi mobile number, like 01712345678.", playbook });
  if (!smsConfigured()) back({ error: "SMS isn't set up on this website.", playbook });
  const { rhythm } = await getSiteContent();
  const p = rhythm[key as SmsPlaybookKey];
  const firstName = admin.name.trim().split(/\s+/)[0] || null;
  const message = renderMessage(p.lang === "bn" ? p.textBn : p.textEn, { firstName, service: "Ironing", link: rhythmLink(SITE_URL, "preview0", p.lang) }, p.lang);
  const r = await sendSms(phone as string, message);
  await logActivity(admin, { section: "retention", action: "rhythm_test_sms", target: playbook, summary: `Test reminder SMS (${NAMES[playbook] ?? playbook}) ${r.ok ? "sent" : "failed"}` });
  back(r.ok ? { saved: `test_${playbook}`, playbook } : { error: "The SMS didn't go through. Check the GreenWeb balance and try again.", playbook });
}
