"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { logActivity } from "@/lib/admin/activity";
import { saveContent } from "@/lib/admin/content-store";
import { markFeedbackHandled } from "@/lib/admin/customer-extras";
import { canEditLoyalty } from "@/lib/admin/permissions";
import { requireSection } from "@/lib/admin/session";
import { logServerEvent } from "@/lib/analytics/store";
import { loyaltyProblem, parseLoyalty, type LoyaltySettings } from "@/lib/customer/loyalty";
import { getSiteContent } from "@/lib/site-content";

const text = (form: FormData, key: string, max: number) => String(form.get(key) ?? "").trim().slice(0, max);
const back = (path: string, params: Record<string, string>): never => redirect(`${path}?${new URLSearchParams(params)}`);

/* ---------- customer feedback ---------- */

/** Staff mark an unhappy rating as dealt with (after calling the customer). */
export async function handleFeedbackAction(form: FormData) {
  const admin = await requireSection("feedback");
  const id = text(form, "id", 40);
  const order = text(form, "orderNumber", 20).replace(/[^A-Z0-9-]/gi, "");
  if (!/^[0-9a-f-]{36}$/i.test(id)) back("/admin/feedback", { error: "Unknown feedback." });
  const ok = await markFeedbackHandled(id, admin.name).catch(() => false);
  if (!ok) back("/admin/feedback", { error: "Couldn't mark it handled (someone may have done it already). Refresh and check." });
  await logActivity(admin, { section: "feedback", action: "feedback_handled", target: order || id, summary: `Marked the feedback on ${order || "an order"} as handled` });
  revalidatePath("/admin", "layout");
  back("/admin/feedback", { saved: "1" });
}

/* ---------- loyalty ---------- */

/** Tier names, thresholds, benefits and the milestone reward. Owners only: it is a promise to customers. */
export async function saveLoyaltyAction(form: FormData) {
  const admin = await requireSection("loyalty");
  if (!canEditLoyalty(admin.role)) back("/admin/loyalty", { error: "Only an Owner can change loyalty tiers and rewards." });
  const { loyalty: before } = await getSiteContent();
  const count = Math.min(6, Math.max(2, Number(text(form, "tierCount", 2)) || before.tiers.length));
  const tiers = Array.from({ length: count }, (_, i) => ({
    name: text(form, `name${i}`, 30),
    nameBn: text(form, `nameBn${i}`, 30),
    min: i === 0 ? 1 : Number(text(form, `min${i}`, 4)),
    perks: text(form, `perks${i}`, 300),
    perksBn: text(form, `perksBn${i}`, 300),
  })).filter((t, i) => i < 2 || t.name);
  const draft: LoyaltySettings = {
    enabled: form.get("enabled") === "on",
    windowMonths: Number(text(form, "windowMonths", 2)),
    tiers,
    milestone: { every: Number(text(form, "every", 2) || 0), reward: text(form, "reward", 200), rewardBn: text(form, "rewardBn", 200) },
  };
  if (!Number.isInteger(draft.windowMonths) || draft.windowMonths < 1 || draft.windowMonths > 36) back("/admin/loyalty", { error: "Count orders over 1 to 36 months." });
  if (tiers.some((t, i) => i > 0 && (!Number.isInteger(t.min) || t.min < 2 || t.min > 500))) back("/admin/loyalty", { error: "Each tier after the first needs a whole number of orders, 2 to 500." });
  if (!Number.isInteger(draft.milestone.every) || draft.milestone.every < 0 || draft.milestone.every > 50) back("/admin/loyalty", { error: "The milestone must be every 0 to 50 orders (0 = none)." });
  const problem = loyaltyProblem(draft);
  if (problem) back("/admin/loyalty", { error: problem });
  const next = { ...parseLoyalty({ ...draft }), updatedAt: new Date().toISOString() };
  try {
    await saveContent("loyalty", next, admin.name);
  } catch {
    await logServerEvent("content_save_error", "/admin/loyalty");
    back("/admin/loyalty", { error: "Couldn't save. Please try again." });
  }
  const ladder = next.tiers.map((t) => `${t.name} ${t.min}+`).join(" / ");
  await logActivity(admin, {
    section: "loyalty",
    action: "loyalty_saved",
    summary: `Loyalty ${next.enabled ? "on" : "off"}: ${ladder} in ${next.windowMonths} months${next.milestone.every && next.milestone.reward ? `; reward every ${next.milestone.every} orders` : ""}`,
    detail: { before, after: next },
  });
  back("/admin/loyalty", { saved: "1" });
}
