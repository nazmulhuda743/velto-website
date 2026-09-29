"use server";

import { redirect } from "next/navigation";
import { logActivity } from "@/lib/admin/activity";
import { activateRoutine, declineRoutine } from "@/lib/admin/routines";
import { requireSection } from "@/lib/admin/session";

/**
 * Routine pickup requests on /admin/requests: activate one (it becomes a Velto Ops weekly pickup;
 * Ops' daily job then makes the tasks) after confirming with the customer on WhatsApp, or decline it
 * with a reason the customer sees on their account.
 */

const text = (form: FormData, key: string, max: number) => String(form.get(key) ?? "").trim().slice(0, max);
const UUID = /^[0-9a-f-]{36}$/i;

const MESSAGES: Record<string, string> = {
  not_found: "That routine request no longer exists.",
  closed: "That routine request has already been handled.",
  invalid: "Check the price per run (taka, 0–100000).",
  reason: "Write a short reason: the customer sees it on their account.",
  unavailable: "Velto Ops couldn't be reached. Nothing was changed; try again.",
};

function back(extra: Record<string, string>): never {
  redirect(`/admin/requests?${new URLSearchParams(extra)}#routines`);
}

export async function activateRoutineAction(form: FormData) {
  const admin = await requireSection("requests");
  const id = text(form, "id", 40);
  const rawPrice = text(form, "price", 10);
  const price = rawPrice === "" ? null : /^\d{1,6}$/.test(rawPrice) && Number(rawPrice) <= 100000 ? Number(rawPrice) : NaN;
  if (!UUID.test(id)) back({ routine_error: MESSAGES.not_found });
  if (Number.isNaN(price)) back({ routine_error: MESSAGES.invalid });
  const r = await activateRoutine(id, price, admin.name);
  if (!r.ok) back({ routine_error: MESSAGES[r.error] ?? MESSAGES.unavailable });
  await logActivity(admin, { section: "requests", action: "routine_activated", target: id, summary: `Activated a routine pickup for ${text(form, "label", 120) || "a customer"}` });
  back({ routine_saved: "activated" });
}

export async function declineRoutineAction(form: FormData) {
  const admin = await requireSection("requests");
  const id = text(form, "id", 40);
  const reason = text(form, "reason", 300);
  if (!UUID.test(id)) back({ routine_error: MESSAGES.not_found });
  if (!reason) back({ routine_error: MESSAGES.reason });
  const r = await declineRoutine(id, reason, admin.name);
  if (!r.ok) back({ routine_error: MESSAGES[r.error] ?? MESSAGES.unavailable });
  await logActivity(admin, { section: "requests", action: "routine_declined", target: id, summary: `Declined a routine pickup for ${text(form, "label", 120) || "a customer"}` });
  back({ routine_saved: "declined" });
}
