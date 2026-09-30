"use server";

import { redirect } from "next/navigation";
import { logActivity } from "@/lib/admin/activity";
import { closeJob, contactJob, getStaff, linkOrder, notifyAssignee, pickJob, planJob, type DispatchResult } from "@/lib/admin/dispatch";
import { addDays, dayName, dhakaToday, isSlot, slotLabel, type SlotId } from "@/lib/admin/dispatch-logic";
import { canEditCapacity } from "@/lib/admin/permissions";
import { requireSection } from "@/lib/admin/session";
import { getJob, getRiders, getWindowStops, isDay as isDate, orderLinkedElsewhere, saveRider, setDayOff, TODAY_ERRORS, type TodayError } from "@/lib/admin/today";
import { riderChoices, type TodayTab } from "@/lib/admin/today-logic";

/**
 * Today (/admin/today): confirm a call, record no answer, give a job a rider and window, mark it
 * picked up or delivered, choose which Ops order a pickup became, and the riders' settings. Each
 * one checks the section, validates the form, writes through the database function that keeps the
 * Ops task in step, is recorded in Activity (names and order numbers only), and goes back to the
 * page with `?done=` or `?error=`. Pressing a button twice changes nothing the second time.
 */

const text = (form: FormData, key: string, max: number) => String(form.get(key) ?? "").trim().slice(0, max);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ORDER = /^VELR?-\d{3,6}$/;
const TABS: readonly TodayTab[] = ["call", "assign", "deliver", "route"];
/** A day that can still be planned: today up to 30 days ahead (Dhaka). */
const plannable = (v: string) => isDate(v) && v >= dhakaToday() && v <= addDays(dhakaToday(), 30);

/**
 * Back to the page. Riders & windows settings come back to their own page (`return`); everything
 * else to Today, on the tab the form came from (or `fallback`) and the day being viewed (`view`).
 * On an error the job stays Next up (`job`), plus any `extra` the page needs to ask again.
 */
function back(form: FormData, fallback: TodayTab, result: { done: string } | { error: TodayError; extra?: Record<string, string> }): never {
  const ret = text(form, "return", 300);
  const q = new URLSearchParams();
  let path = "/admin/today";
  if (ret.startsWith("/admin/riders")) {
    path = "/admin/riders";
  } else {
    const tab = text(form, "tab", 10) as TodayTab;
    q.set("tab", TABS.includes(tab) ? tab : fallback);
    const view = text(form, "view", 10);
    if (isDate(view)) q.set("date", view);
  }
  if ("done" in result) {
    q.set("done", result.done);
  } else {
    const job = text(form, "job", 40);
    if (UUID.test(job) && path === "/admin/today") q.set("job", job);
    q.set("error", result.error);
    for (const [k, v] of Object.entries(result.extra ?? {})) q.set(k, v);
  }
  redirect(`${path}?${q}`);
}

const errorOf = (r: DispatchResult & { ok: false }): TodayError => (r.error in TODAY_ERRORS ? (r.error as TodayError) : "unavailable");
const finish = (form: FormData, tab: TodayTab, r: DispatchResult, done: string) => back(form, tab, r.ok ? { done } : { error: errorOf(r) });
const when = (day: string, slot: string) => `${dayName(day)} ${slotLabel(slot).toLowerCase()}`;

/** Called and agreed a day and window: the pickup moves to Assign (or stays with its rider). */
export async function confirmAction(form: FormData) {
  const admin = await requireSection("dispatch");
  const job = text(form, "job", 40);
  const day = text(form, "date", 10);
  const slot = text(form, "slot", 12);
  const label = text(form, "label", 120) || "a pickup";
  if (!UUID.test(job)) back(form, "call", { error: "not_found" });
  if (!isDate(day) || !isSlot(slot)) back(form, "call", { error: "invalid" });
  if (!plannable(day)) back(form, "call", { error: "past" });

  const now = await getJob(job);
  if (now === null) back(form, "call", { error: "not_found" });
  // Already confirmed for this window (a second press): nothing to do.
  if (now && now.confirmed_at && now.slot_date === day && now.slot === slot && (now.stage === "confirmed" || now.stage === "scheduled")) back(form, "call", { done: "confirmed" });

  const r = await contactJob(job, "confirmed", day, slot, admin.name);
  if (r.ok) await logActivity(admin, { section: "dispatch", action: "request_confirmed", target: job, summary: `Confirmed ${label}: ${when(day, slot)}` });
  finish(form, "call", r, "confirmed");
}

/** Called, nobody answered: counts an attempt (never cancels by itself). */
export async function noAnswerAction(form: FormData) {
  const admin = await requireSection("dispatch");
  const job = text(form, "job", 40);
  const label = text(form, "label", 120) || "a pickup";
  if (!UUID.test(job)) back(form, "call", { error: "not_found" });

  const now = await getJob(job);
  if (now === null) back(form, "call", { error: "not_found" });
  // The same attempt pressed twice within a minute counts once.
  const last = now?.history[now.history.length - 1];
  if (now && last?.action === "no answer" && now.last_contact_at && Date.now() - Date.parse(now.last_contact_at) < 60_000) back(form, "call", { done: "no_answer" });

  const r = await contactJob(job, "no_answer", null, null, admin.name);
  if (r.ok) await logActivity(admin, { section: "dispatch", action: "request_no_answer", target: job, summary: `Called ${label}: no answer` });
  finish(form, "call", r, "no_answer");
}

/**
 * A rider and a window for a pickup or a delivery. A rider who is full in that window needs
 * `force=1` (the page asks once: "Bappy is full in the morning. Assign anyway?"); a rider who is
 * off that day can't be given stops. The re-ask goes back as `rider`, `adate` and `slot`; `date` stays the day being viewed.
 */
export async function assignAction(form: FormData) {
  const admin = await requireSection("dispatch");
  const job = text(form, "job", 40);
  const riderId = text(form, "rider", 40);
  const day = text(form, "date", 10);
  const slot = text(form, "slot", 12);
  const force = form.get("force") === "1";
  const label = text(form, "label", 120) || "a stop";
  if (!UUID.test(job)) back(form, "assign", { error: "not_found" });
  if (!UUID.test(riderId)) back(form, "assign", { error: "assignee" });
  if (!isDate(day) || !isSlot(slot)) back(form, "assign", { error: "invalid" });
  if (!plannable(day)) back(form, "assign", { error: "past" });
  const window = slot as SlotId;

  const now = await getJob(job);
  if (now === null) back(form, "assign", { error: "not_found" });
  const tab: TodayTab = now?.kind === "delivery" ? "deliver" : "assign";
  // Already this rider's stop in this window (a second press): nothing to do.
  if (now && now.stage === "scheduled" && now.assignee_id === riderId && now.slot_date === day && now.slot === window) back(form, tab, { done: "assigned" });

  const riders = await getRiders(day);
  const stops = await getWindowStops(day, window);
  // The job itself doesn't count against the rider (moving a stop within their own window).
  const choice = riderChoices(riders, (stops ?? []).filter((j) => j.id !== job), day, window).find((r) => r.id === riderId);
  if (!choice) back(form, tab, { error: "assignee" });
  if (choice.off) back(form, tab, { error: "off" });
  if (choice.full && !force) back(form, tab, { error: "full", extra: { rider: riderId, adate: day, slot: window } });

  const r = await planJob(job, { id: choice.id, name: choice.name, role: "rider" }, day, window, admin.name);
  if (r.ok) {
    await logActivity(admin, {
      section: "dispatch",
      action: choice.full ? "stop_planned_rider_full" : "stop_planned",
      target: job,
      summary: `Planned ${label}: ${choice.name}, ${when(day, window)}${choice.full ? ` (rider already full: ${choice.load}/${choice.stopsPerWindow})` : ""}`,
    });
    await notifyAssignee(choice.id, "🛵 New stop for you", `${label} · ${when(day, window)}`);
  }
  finish(form, tab, r, "assigned");
}

/** Picked up (a pickup) or Delivered (a delivery), from the Route tab. */
export async function markDoneAction(form: FormData) {
  const admin = await requireSection("dispatch");
  const job = text(form, "job", 40);
  const label = text(form, "label", 120) || "a stop";
  if (!UUID.test(job)) back(form, "route", { error: "not_found" });

  const now = await getJob(job);
  if (now === null) back(form, "route", { error: "not_found" });
  const kind = now?.kind ?? (text(form, "kind", 10) === "delivery" ? "delivery" : "pickup");
  const done = kind === "delivery" ? "delivered" : "picked";
  // Already marked (a second press, or the rider ticked it in Ops): nothing to do.
  if (now && (now.stage === "done" || (kind === "pickup" && now.stage === "picked"))) back(form, "route", { done });

  const r = kind === "delivery" ? await closeJob(job, "done", null, admin.name) : await pickJob(job, null, admin.name);
  if (r.ok) await logActivity(admin, { section: "dispatch", action: kind === "delivery" ? "stop_done" : "request_picked", target: job, summary: `Marked ${label} as ${kind === "delivery" ? "delivered" : "picked up"}` });
  finish(form, "route", r, done);
}

/** "Which order?": links the Ops order a picked-up request became. */
export async function pickOrderAction(form: FormData) {
  const admin = await requireSection("dispatch");
  const job = text(form, "job", 40);
  const order = text(form, "order", 20).toUpperCase();
  const label = text(form, "label", 120) || "a pickup";
  if (!UUID.test(job)) back(form, "route", { error: "not_found" });
  if (!ORDER.test(order)) back(form, "route", { error: "order_format" });

  const now = await getJob(job);
  if (now === null) back(form, "route", { error: "not_found" });
  if (now && now.order_number === order) back(form, "route", { done: "linked" });
  // Never replace a linked order silently (unlinking is on Bookings), nor take one another pickup has.
  if (now?.order_number) back(form, "route", { error: "closed" });
  if (await orderLinkedElsewhere(order, job)) back(form, "route", { error: "order_taken" });

  const r = await linkOrder(job, order, admin.name);
  if (r.ok) await logActivity(admin, { section: "dispatch", action: "request_order_linked", target: job, summary: `Linked ${order} to ${label}` });
  finish(form, "route", r, "linked");
}

/** An active Ops staff member, for the settings below (never a free-typed id). */
async function staffMember(form: FormData) {
  const id = text(form, "profile", 40);
  if (!UUID.test(id)) back(form, "route", { error: "assignee" });
  const person = (await getStaff()).find((p) => p.id === id);
  if (!person) back(form, "route", { error: "assignee" });
  return person;
}

/** "Can do pickups & deliveries" and stops per window (1–30). Owner or Manager. */
export async function riderSettingsAction(form: FormData) {
  const admin = await requireSection("dispatch");
  if (!canEditCapacity(admin.role)) back(form, "route", { error: "role" });
  const canRide = form.get("can_ride") === "1";
  const raw = text(form, "stops", 3);
  const stops = Number(raw);
  if (!/^\d{1,2}$/.test(raw) || stops < 1 || stops > 30) back(form, "route", { error: "invalid" });
  const person = await staffMember(form);

  const r = await saveRider(person.id, canRide, stops, admin.name);
  if (r.ok) {
    await logActivity(admin, {
      section: "dispatch",
      action: "rider_settings_saved",
      target: person.id,
      summary: `${person.name}: ${canRide ? "does" : "doesn't do"} pickups & deliveries, ${stops} stops per window`,
      detail: { canRide, stops },
    });
  }
  finish(form, "route", r, "rider_saved");
}

/** Off (or back on) for a day: today up to 30 days ahead. Owner or Manager. */
export async function dayOffAction(form: FormData) {
  const admin = await requireSection("dispatch");
  if (!canEditCapacity(admin.role)) back(form, "route", { error: "role" });
  const day = text(form, "day", 10);
  const off = form.get("off") === "1";
  if (!isDate(day)) back(form, "route", { error: "invalid" });
  if (!plannable(day)) back(form, "route", { error: "past" });
  const person = await staffMember(form);

  const r = await setDayOff(person.id, day, off);
  if (r.ok) {
    await logActivity(admin, { section: "dispatch", action: off ? "rider_day_off" : "rider_day_on", target: person.id, summary: `${person.name} is ${off ? "off" : "working"} on ${dayName(day)}`, detail: { day } });
  }
  finish(form, "route", r, off ? "day_off" : "day_on");
}
