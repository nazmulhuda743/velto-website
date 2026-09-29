"use server";

import { redirect } from "next/navigation";
import { logActivity } from "@/lib/admin/activity";
import { closeCallback } from "@/lib/admin/callbacks";
import { requireSection } from "@/lib/admin/session";
import { CALLBACK_OUTCOMES } from "@/lib/booking-recovery";

/** Close a "Get a call back" request on /admin/requests with what happened. */
const text = (form: FormData, key: string, max: number) => String(form.get(key) ?? "").trim().slice(0, max);
const UUID = /^[0-9a-f-]{36}$/i;

const MESSAGES: Record<string, string> = {
  not_found: "That call-back request no longer exists.",
  closed: "That call-back request has already been handled.",
  invalid: "Choose what happened on the call.",
  unavailable: "The database couldn't be reached. Nothing was changed; try again.",
};

const back = (extra: Record<string, string>): never => redirect(`/admin/requests?${new URLSearchParams(extra)}#callbacks`);

export async function closeCallbackAction(form: FormData) {
  const admin = await requireSection("requests");
  const id = text(form, "id", 40);
  const outcome = text(form, "outcome", 20);
  const note = text(form, "note", 300);
  if (!UUID.test(id)) back({ callback_error: MESSAGES.not_found });
  if (!CALLBACK_OUTCOMES.some((o) => o.id === outcome)) back({ callback_error: MESSAGES.invalid });
  const r = await closeCallback(id, outcome, note, admin.name);
  if (!r.ok) back({ callback_error: MESSAGES[r.error] ?? MESSAGES.unavailable });
  const label = CALLBACK_OUTCOMES.find((o) => o.id === outcome)?.label ?? outcome;
  await logActivity(admin, { section: "requests", action: "callback_closed", target: id, summary: `Call-back for ${text(form, "label", 120) || "a visitor"}: ${label}` });
  back({ callback_saved: "1" });
}
