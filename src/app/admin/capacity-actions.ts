"use server";

import { redirect } from "next/navigation";
import { logActivity } from "@/lib/admin/activity";
import { canEditCapacity } from "@/lib/admin/permissions";
import { requireSection } from "@/lib/admin/session";
import { isGarmentService } from "@/lib/booking-items";
import { getBoard, getPickupAvailability, setConfig, setDefaults, setSlot, setZones, staffBookPickup } from "@/lib/capacity";
import { addDaysIso, isWindowId, OVERRIDE_REASONS, opsPickupLabel, parseSectors, shortDate, windowHours, WINDOW_IDS } from "@/lib/capacity-logic";
import { validateBookingSubmission } from "@/lib/integrations/ops/validation";
import { dhakaToday } from "@/lib/admin/dispatch-logic";

/**
 * Capacity. Everyone with the section sees the board and books a customer from WhatsApp or the
 * phone within capacity; Owners and Managers change numbers, block windows, edit zones and the
 * website switch, and may book over a full window with a reason. Activity records names only.
 */

const text = (form: FormData, key: string, max: number) => String(form.get(key) ?? "").trim().slice(0, max);
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const KINDS = ["pickup", "delivery"] as const;
const ZONE_ID = /^[a-z0-9-]{1,24}$/;

const MESSAGES: Record<string, string> = {
  role: "Only an Owner or Manager can change capacity.",
  invalid: "Check the numbers and try again.",
  slot_full: "That window has just filled. Choose another window, or an Owner or Manager can book over capacity with a reason.",
  slot_closed: "That window is blocked or closed. Choose another window.",
  slot_past: "That window has already passed or is too close to its end. Choose a later one.",
  no_zone: "That sector isn't in any zone. Add it to a zone below first.",
  window: "Choose a day and a window for the pickup.",
  customer: "Check the customer's name (2+ letters), phone number and address.",
  override_role: "Only an Owner or Manager can book over capacity.",
  zones: "Every zone needs a name, and a sector can be in only one active zone.",
  unavailable: "Velto Ops couldn't be reached. Nothing was changed; try again.",
};

function back(form: FormData, extra: Record<string, string>, hash = ""): never {
  const keep = new URLSearchParams(text(form, "keep", 300));
  for (const k of ["saved", "error", "ref"]) keep.delete(k);
  for (const [k, v] of Object.entries(extra)) keep.set(k, v);
  redirect(`/admin/capacity?${keep}${hash}`);
}

function fail(form: FormData, code: string, hash = ""): never {
  back(form, { error: MESSAGES[code] ?? MESSAGES.unavailable }, hash);
}

/** One window on one day: a capacity for that day (blank = the zone's default) and/or blocked. */
export async function setSlotAction(form: FormData) {
  const admin = await requireSection("capacity");
  if (!canEditCapacity(admin.role)) fail(form, "role");
  const date = text(form, "date", 10);
  const kind = text(form, "kind", 10);
  const zone = text(form, "zone", 24);
  const window = text(form, "window", 12);
  const raw = text(form, "capacity", 3);
  const blocked = form.get("blocked") === "on";
  const note = text(form, "note", 200);
  const capacity = raw === "" ? null : Number(raw);
  const today = dhakaToday();
  if (
    !DATE.test(date) || date < today || date > addDaysIso(today, 60) ||
    !KINDS.includes(kind as (typeof KINDS)[number]) || !ZONE_ID.test(zone) || !isWindowId(window) ||
    (capacity !== null && (!Number.isInteger(capacity) || capacity < 0 || capacity > 99))
  )
    fail(form, "invalid");
  const r = await setSlot(date, kind, zone, window, capacity, blocked, note, admin.name);
  if (!r.ok) fail(form, r.error === "unavailable" ? "unavailable" : "invalid");
  await logActivity(admin, {
    section: "capacity",
    action: blocked ? "slot_blocked" : "slot_set",
    target: `${date} ${kind} ${zone} ${window}`,
    summary: `${kind === "pickup" ? "Pickups" : "Deliveries"} ${shortDate(date)} ${window}, ${zone}: ${blocked ? `blocked${note ? ` (${note})` : ""}` : capacity === null ? "back to the default" : `capacity ${capacity}`}`,
  });
  back(form, { saved: "slot" }, `#${kind}-${window}`);
}

/** The usual number per window and zone (used on every day without its own number). */
export async function saveDefaultsAction(form: FormData) {
  const admin = await requireSection("capacity");
  if (!canEditCapacity(admin.role)) fail(form, "role");
  const rows: { kind: string; zone: string; window: string; capacity: number }[] = [];
  for (const [key, value] of form.entries()) {
    const m = /^d:(pickup|delivery):([a-z0-9-]{1,24}):(morning|afternoon|evening|night)$/.exec(key);
    if (!m) continue;
    const n = Number(String(value).trim());
    if (!Number.isInteger(n) || n < 0 || n > 99) fail(form, "invalid", "#settings");
    rows.push({ kind: m[1], zone: m[2], window: m[3], capacity: n });
  }
  if (!rows.length) fail(form, "invalid", "#settings");
  const r = await setDefaults(rows);
  if (!r.ok) fail(form, r.error === "unavailable" ? "unavailable" : "invalid", "#settings");
  await logActivity(admin, { section: "capacity", action: "defaults_saved", summary: `Saved the usual capacity (${rows.length} numbers)` });
  back(form, { saved: "defaults" }, "#settings");
}

/** Zones: which sectors share riders. A sector may be in one active zone only. */
export async function saveZonesAction(form: FormData) {
  const admin = await requireSection("capacity");
  if (!canEditCapacity(admin.role)) fail(form, "role");
  const ids = form.getAll("zoneId").map((v) => String(v).trim());
  const rows = ids.map((id, i) => ({
    id,
    name: String(form.getAll("zoneName")[i] ?? "").trim().slice(0, 60),
    sectors: parseSectors(String(form.getAll("zoneSectors")[i] ?? "")),
    active: form.get(`zoneActive:${id}`) === "on",
  }));
  const newName = text(form, "newName", 60);
  if (newName) {
    const slug = newName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 20) || "zone";
    let id = slug;
    for (let n = 2; ids.includes(id); n++) id = `${slug}-${n}`;
    rows.push({ id, name: newName, sectors: parseSectors(text(form, "newSectors", 60)), active: true });
  }
  const seen = new Set<number>();
  for (const z of rows) {
    if (!ZONE_ID.test(z.id) || !z.name) fail(form, "zones", "#settings");
    if (!z.active || z.id === "other") continue;
    for (const s of z.sectors) {
      if (seen.has(s)) fail(form, "zones", "#settings");
      seen.add(s);
    }
  }
  const r = await setZones(rows);
  if (!r.ok) fail(form, r.error === "unavailable" ? "unavailable" : "zones", "#settings");
  await logActivity(admin, { section: "capacity", action: "zones_saved", summary: `Saved zones: ${rows.filter((z) => z.active).map((z) => z.name).join(", ")}` });
  back(form, { saved: "zones" }, "#settings");
}

/** The website switch, how far ahead customers can book, the cutoff, and the windows' hours. */
export async function saveConfigAction(form: FormData) {
  const admin = await requireSection("capacity");
  if (!canEditCapacity(admin.role)) fail(form, "role");
  const enabled = form.get("enabled") === "on";
  const days = Number(text(form, "daysAhead", 2));
  const cutoff = Number(text(form, "cutoff", 4));
  const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
  const windows = WINDOW_IDS.map((id) => ({
    id,
    starts: text(form, `starts:${id}`, 5),
    ends: text(form, `ends:${id}`, 5),
    active: form.get(`active:${id}`) === "on",
  }));
  if (
    !Number.isInteger(days) || days < 1 || days > 14 ||
    !Number.isInteger(cutoff) || cutoff < 0 || cutoff > 600 ||
    windows.some((w) => !HHMM.test(w.starts) || !HHMM.test(w.ends) || w.ends <= w.starts)
  )
    fail(form, "invalid", "#settings");
  const r = await setConfig(enabled, days, cutoff, windows, admin.name);
  if (!r.ok) fail(form, r.error === "unavailable" ? "unavailable" : "invalid", "#settings");
  await logActivity(admin, {
    section: "capacity",
    action: "config_saved",
    summary: `Website booking by window ${enabled ? "on" : "off"}; ${days} days ahead; cutoff ${cutoff} min; windows ${windows.filter((w) => w.active).map((w) => `${w.id} ${windowHours(w.starts, w.ends)}`).join(", ")}`,
  });
  back(form, { saved: "config" }, "#settings");
}

/**
 * A customer asked on WhatsApp or by phone: staff book the pickup through the same capacity
 * as the website, so both can never promise the same place twice.
 */
export async function staffBookAction(form: FormData) {
  const admin = await requireSection("capacity");
  const sector = Number(text(form, "sector", 2));
  const channel = text(form, "channel", 12) === "phone" ? "phone" : "WhatsApp";
  const picked = text(form, "override", 120);
  const override = picked === "other" ? text(form, "overrideOther", 200) : OVERRIDE_REASONS.includes(picked) ? picked : "";
  // Over capacity, a manager names the (full) day and window directly; otherwise the picker's choice.
  const overWindow = override && text(form, "overDate", 10) && text(form, "overWindow", 12);
  const date = overWindow ? text(form, "overDate", 10) : text(form, "date", 10);
  const window = overWindow ? text(form, "overWindow", 12) : text(form, "window", 12);
  if (!Number.isInteger(sector) || sector < 1 || sector > 18) fail(form, "no_zone", "#book");
  if (!DATE.test(date) || !isWindowId(window)) fail(form, "window", "#book");
  if (override && !canEditCapacity(admin.role)) fail(form, "override_role", "#book");

  // The window's hours for the Ops task label, from the same availability the picker showed.
  const availability = await getPickupAvailability(sector);
  const w = availability?.days.find((d) => d.date === date)?.windows.find((x) => x.id === window);
  const hours = w ?? (await getBoard(date).then((b) => (b.state === "ok" ? b.data.windows.find((x) => x.id === window) : undefined)));
  if (!hours) fail(form, "window", "#book");

  const staffNote = text(form, "notes", 600);
  const checked = validateBookingSubmission({
    name: text(form, "name", 100),
    phone: text(form, "phone", 32),
    area: `Uttara Sector ${sector}`,
    address: text(form, "address", 500),
    preferredPickup: opsPickupLabel(date, { id: window as (typeof WINDOW_IDS)[number], starts: hours!.starts, ends: hours!.ends }, true),
    services: form.getAll("services").map(String).filter(isGarmentService),
    notes: [`Booked by staff (${admin.name}) from ${channel}.`, staffNote].filter(Boolean).join(" "),
    attribution: { consent: "none" },
  });
  if (!checked.ok) fail(form, "customer", "#book");
  const { slot: _slot, ...payload } = checked.value;
  void _slot;

  const r = await staffBookPickup(payload, { date, window, ...(override ? { override } : {}) }, admin.name);
  if (!r.ok) fail(form, r.error, "#book");
  await logActivity(admin, {
    section: "capacity",
    action: r.over ? "pickup_booked_over_capacity" : "pickup_booked",
    target: r.reference ?? null,
    summary: `Booked a pickup for ${payload.name} (${channel}): Sector ${sector}, ${shortDate(date)} ${window}${r.over ? ` (over capacity: ${override})` : ""}`,
  });
  back(form, { saved: "booked", ref: r.reference ?? "", day: date }, "#book");
}
