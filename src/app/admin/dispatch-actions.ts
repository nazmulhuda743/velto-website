"use server";

import { redirect } from "next/navigation";
import { logActivity } from "@/lib/admin/activity";
import { closeJob, combineJobs, getStaff, mergeJobs, notifyAssignee, planJob, splitJob, type DispatchResult } from "@/lib/admin/dispatch";
import { addDays, CANCEL_REASONS, DELIVERY_CLOSE_REASONS, dayName, dhakaToday, isSlot, slotLabel } from "@/lib/admin/dispatch-logic";
import { requireSection } from "@/lib/admin/session";
import { canEditCapacity } from "@/lib/admin/permissions";
import { OVERRIDE_REASONS } from "@/lib/capacity-logic";

/**
 * Pickup & delivery. Everyone with the section (Owner, Manager, Customer support) can plan,
 * close, merge and combine. Every change is written with the database function that also
 * updates the Velto Ops task, and recorded in Activity (names and order numbers only).
 */

const text = (form: FormData, key: string, max: number) => String(form.get(key) ?? "").trim().slice(0, max);
const UUID = /^[0-9a-f-]{36}$/i;

const MESSAGES: Record<string, string> = {
  not_found: "That stop no longer exists. The board has been refreshed.",
  closed: "That stop was already finished, cancelled or merged.",
  invalid: "Check the day and slot and try again.",
  assignee: "That person isn't active in Velto Ops any more.",
  past: "That day has already passed. Choose today or later.",
  reason: "Give a reason for cancelling.",
  slot_full: "That window is full for this zone (Capacity). Choose another window, or an Owner or Manager can book over capacity with a reason.",
  slot_closed: "That window is blocked or closed for this zone (Capacity). Choose another window.",
  slot_past: "That window has already passed.",
  override_role: "Only an Owner or Manager can book over capacity.",
  unavailable: "Velto Ops couldn't be reached. Nothing was changed; try again.",
};

function back(form: FormData, extra: Record<string, string>): never {
  // Used from a Bookings card: go back there, with the card open.
  const ret = text(form, "return", 300);
  if (ret.startsWith("/admin/requests")) {
    const url = new URL(ret, "http://local");
    // A delivery planned from a booking's card reopens that card (the pickup), not the delivery.
    const job = text(form, "card", 40) || text(form, "job", 40);
    for (const k of ["saved", "error", "open"]) url.searchParams.delete(k);
    if (/^[0-9a-f-]{36}$/i.test(job)) url.searchParams.set("open", job);
    for (const [k, v] of Object.entries(extra)) url.searchParams.set(k, v);
    redirect(`${url.pathname}?${url.searchParams}${/^[0-9a-f-]{36}$/i.test(job) ? `#r-${job}` : ""}`);
  }
  const keep = new URLSearchParams(text(form, "keep", 300));
  for (const k of ["saved", "error", "job"]) keep.delete(k);
  for (const [k, v] of Object.entries(extra)) keep.set(k, v);
  redirect(`/admin/dispatch?${keep}`);
}

const done = (form: FormData, r: DispatchResult, saved: string) => back(form, r.ok ? { saved } : { error: MESSAGES[r.error] ?? MESSAGES.unavailable });

export async function planAction(form: FormData) {
  const admin = await requireSection("dispatch");
  const job = text(form, "job", 40);
  const personId = text(form, "person", 40);
  const day = text(form, "day", 10);
  const slot = text(form, "slot", 12);
  const label = text(form, "label", 120);
  const pickedReason = text(form, "override", 120);
  const override = pickedReason === "other" ? text(form, "overrideOther", 200) : OVERRIDE_REASONS.includes(pickedReason) ? pickedReason : "";
  if (!UUID.test(job)) back(form, { error: MESSAGES.not_found });
  if (override && !canEditCapacity(admin.role)) back(form, { error: MESSAGES.override_role });

  const staff = await getStaff();
  const person = personId ? staff.find((p) => p.id === personId) : null;
  if (personId && !person) back(form, { error: MESSAGES.assignee });
  const today = dhakaToday();
  const validDay = /^\d{4}-\d{2}-\d{2}$/.test(day) && day >= today && day <= addDays(today, 30);
  if ((day || slot) && (!validDay || !isSlot(slot))) back(form, { error: MESSAGES.invalid });

  const r = await planJob(job, person ?? null, day || null, isSlot(slot) ? slot : null, admin.name, override || undefined);
  if (r.ok) {
    const when = day && isSlot(slot) ? `${dayName(day)} ${slotLabel(slot).toLowerCase()}` : "no slot yet";
    await logActivity(admin, {
      section: "dispatch",
      action: override ? "stop_planned_over_capacity" : "stop_planned",
      target: job,
      summary: `Planned ${label || "a stop"}: ${person?.name ?? "nobody"}, ${when}${override ? ` (over capacity: ${override})` : ""}`,
    });
    if (person) await notifyAssignee(person.id, "🛵 New stop for you", `${label || "A stop"} · ${when}`);
  }
  done(form, r, "planned");
}

export async function closeAction(form: FormData) {
  const admin = await requireSection("dispatch");
  const job = text(form, "job", 40);
  const outcome = text(form, "outcome", 12);
  const label = text(form, "label", 120);
  const picked = text(form, "reason", 120);
  const other = text(form, "other", 200);
  const reason = picked === "other" ? other : CANCEL_REASONS.includes(picked) || DELIVERY_CLOSE_REASONS.includes(picked) ? picked : other;
  if (!UUID.test(job) || (outcome !== "done" && outcome !== "cancelled")) back(form, { error: MESSAGES.invalid });
  if (outcome === "cancelled" && !reason) back(form, { error: MESSAGES.reason });

  const r = await closeJob(job, outcome as "done" | "cancelled", outcome === "cancelled" ? reason : null, admin.name);
  if (r.ok) {
    await logActivity(admin, {
      section: "dispatch",
      action: outcome === "done" ? "stop_done" : "stop_cancelled",
      target: job,
      summary: outcome === "done" ? `Marked ${label || "a stop"} done` : `${label.startsWith("Delivery") ? "Took off the board" : "Cancelled"} ${label || "a stop"}: ${reason}`,
    });
  }
  done(form, r, outcome);
}

export async function mergeAction(form: FormData) {
  const admin = await requireSection("dispatch");
  const keep = text(form, "keep_job", 40);
  const remove = text(form, "remove_job", 40);
  const label = text(form, "label", 120);
  if (!UUID.test(keep) || !UUID.test(remove)) back(form, { error: MESSAGES.invalid });
  const r = await mergeJobs(keep, remove, admin.name);
  if (r.ok) await logActivity(admin, { section: "dispatch", action: "stops_merged", target: keep, summary: `Merged a duplicate request from ${label || "a customer"}` });
  done(form, r, "merged");
}

export async function combineAction(form: FormData) {
  const admin = await requireSection("dispatch");
  const lead = text(form, "lead_job", 40);
  const other = text(form, "other_job", 40);
  const label = text(form, "label", 120);
  if (!UUID.test(lead) || !UUID.test(other)) back(form, { error: MESSAGES.invalid });
  const r = await combineJobs(lead, other, admin.name);
  if (r.ok) await logActivity(admin, { section: "dispatch", action: "stops_combined", target: lead, summary: `Combined two stops for ${label || "a customer"} into one trip` });
  done(form, r, "combined");
}

export async function splitAction(form: FormData) {
  const admin = await requireSection("dispatch");
  const job = text(form, "job", 40);
  const label = text(form, "label", 120);
  if (!UUID.test(job)) back(form, { error: MESSAGES.invalid });
  const r = await splitJob(job, admin.name);
  if (r.ok) await logActivity(admin, { section: "dispatch", action: "stop_split", target: job, summary: `Took ${label || "a stop"} out of its combined trip` });
  done(form, r, "split");
}
