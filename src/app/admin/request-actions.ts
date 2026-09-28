"use server";

import { redirect } from "next/navigation";
import { logActivity } from "@/lib/admin/activity";
import { contactJob, linkOrder, noteJob, pickJob, type DispatchResult } from "@/lib/admin/dispatch";
import { addDays, dayName, dhakaToday, isSlot, slotLabel } from "@/lib/admin/dispatch-logic";
import { requireSection } from "@/lib/admin/session";

/**
 * Booking requests, one card each (/admin/requests): the call outcome, notes, "picked up" and
 * the Ops order link. Planning a person and cancelling reuse the Pickup & delivery actions.
 * Every change goes through a database function that keeps the Ops task in step, and is
 * recorded in Activity (names and order numbers only).
 */

const text = (form: FormData, key: string, max: number) => String(form.get(key) ?? "").trim().slice(0, max);
const UUID = /^[0-9a-f-]{36}$/i;
const ORDER = /^VELR?-\d{3,6}$/;

const MESSAGES: Record<string, string> = {
  not_found: "That request no longer exists. The list has been refreshed.",
  closed: "That request has already moved on (picked up, cancelled or merged).",
  invalid: "Check the day and time of day and try again.",
  past: "That day has already passed. Choose today or later.",
  order: "There is no order with that number in Velto Ops yet. Check the number, or link it later.",
  order_format: "Order numbers look like VEL-01952.",
  note: "Write a note first.",
  unavailable: "Velto Ops couldn't be reached. Nothing was changed; try again.",
};

/** Back to the list, with the card open and a message. */
function back(form: FormData, job: string, extra: Record<string, string>): never {
  const ret = text(form, "return", 300);
  const url = new URL(ret.startsWith("/admin/requests") ? ret : "/admin/requests", "http://local");
  for (const k of ["saved", "error", "open"]) url.searchParams.delete(k);
  if (UUID.test(job)) url.searchParams.set("open", job);
  for (const [k, v] of Object.entries(extra)) url.searchParams.set(k, v);
  redirect(`${url.pathname}?${url.searchParams}#r-${job}`);
}

const finish = (form: FormData, job: string, r: DispatchResult, saved: string) => back(form, job, r.ok ? { saved } : { error: MESSAGES[r.error] ?? MESSAGES.unavailable });

export async function contactAction(form: FormData) {
  const admin = await requireSection("requests");
  const job = text(form, "job", 40);
  const outcome = text(form, "outcome", 12);
  const label = text(form, "label", 120) || "a request";
  if (!UUID.test(job) || (outcome !== "confirmed" && outcome !== "no_answer")) back(form, job, { error: MESSAGES.invalid });

  const day = text(form, "day", 10);
  const slot = text(form, "slot", 12);
  const today = dhakaToday();
  if (outcome === "confirmed" && (!/^\d{4}-\d{2}-\d{2}$/.test(day) || day < today || day > addDays(today, 30) || !isSlot(slot))) {
    back(form, job, { error: MESSAGES.invalid });
  }
  const r = await contactJob(job, outcome as "confirmed" | "no_answer", outcome === "confirmed" ? day : null, outcome === "confirmed" && isSlot(slot) ? slot : null, admin.name);
  if (r.ok) {
    await logActivity(admin, {
      section: "requests",
      action: outcome === "confirmed" ? "request_confirmed" : "request_no_answer",
      target: job,
      summary: outcome === "confirmed" ? `Confirmed ${label}: ${dayName(day)} ${slotLabel(slot).toLowerCase()}` : `Called ${label}: no answer`,
    });
  }
  finish(form, job, r, outcome === "confirmed" ? "confirmed" : "no_answer");
}

export async function noteAction(form: FormData) {
  const admin = await requireSection("requests");
  const job = text(form, "job", 40);
  const note = text(form, "note", 300);
  if (!UUID.test(job)) back(form, job, { error: MESSAGES.not_found });
  if (!note) back(form, job, { error: MESSAGES.note });
  const r = await noteJob(job, "note", note, admin.name);
  if (r.ok) await logActivity(admin, { section: "requests", action: "request_note", target: job, summary: `Added a note to ${text(form, "label", 120) || "a request"}` });
  finish(form, job, r, "note");
}

export async function pickAction(form: FormData) {
  const admin = await requireSection("requests");
  const job = text(form, "job", 40);
  const order = text(form, "order", 20).toUpperCase();
  const label = text(form, "label", 120) || "a request";
  if (!UUID.test(job)) back(form, job, { error: MESSAGES.not_found });
  if (order && !ORDER.test(order)) back(form, job, { error: MESSAGES.order_format });
  const r = await pickJob(job, order || null, admin.name);
  if (r.ok) await logActivity(admin, { section: "requests", action: "request_picked", target: job, summary: `Picked up ${label}${order ? ` (${order})` : ""}` });
  finish(form, job, r, "picked");
}

export async function linkOrderAction(form: FormData) {
  const admin = await requireSection("requests");
  const job = text(form, "job", 40);
  const clear = form.get("clear") === "1";
  const order = clear ? "" : text(form, "order", 20).toUpperCase();
  const label = text(form, "label", 120) || "a request";
  if (!UUID.test(job)) back(form, job, { error: MESSAGES.not_found });
  if (!clear && !ORDER.test(order)) back(form, job, { error: MESSAGES.order_format });
  const r = await linkOrder(job, order || null, admin.name);
  if (r.ok) {
    await logActivity(admin, { section: "requests", action: clear ? "request_order_unlinked" : "request_order_linked", target: job, summary: clear ? `Unlinked the order from ${label}` : `Linked ${order} to ${label}` });
  }
  finish(form, job, r, clear ? "unlinked" : "linked");
}

const WHATSAPP_KINDS: Record<string, string> = { confirm: "Confirmation", picked: "Picked-up message", ready: "Ready message" };

/** Records that staff opened a WhatsApp message for this request (the card's timeline shows it). */
export async function logWhatsAppAction(job: string, kind: string, lang: string): Promise<void> {
  const admin = await requireSection("requests");
  if (!UUID.test(job) || !WHATSAPP_KINDS[kind]) return;
  await noteJob(job, "whatsapp", `${WHATSAPP_KINDS[kind]} (${lang === "en" ? "English" : "Bangla"})`, admin.name);
}
