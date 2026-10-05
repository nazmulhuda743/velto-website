/**
 * The installed app's rules (design: docs/design/velto-app-screens.dc.html, "Handoff notes"):
 * which card Home shows, the default rebook slot, the honest "Usually back by" date, the line
 * under Ready, the tracker, mixed-service labels and when to offer the weekly pickup.
 *
 * Pure (no imports), so every rule is unit-tested without a server (tests/app-logic.test.cjs).
 * Nothing here invents a fact: every time comes from Ops data, and a missing value means the
 * screen shows nothing for it.
 */

const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;
/** Asia/Dhaka is UTC+6 all year (no daylight saving). */
const DHAKA_OFFSET_MS = 6 * HOUR_MS;

/** Dhaka calendar day (YYYY-MM-DD) for a timestamp. */
export function dhakaDate(value: string | Date): string {
  const d = typeof value === "string" ? new Date(value) : value;
  return new Date(d.getTime() + DHAKA_OFFSET_MS).toISOString().slice(0, 10);
}

const dayNumber = (iso: string) => Math.floor(Date.parse(`${iso.slice(0, 10)}T00:00:00Z`) / DAY_MS);
const addDays = (iso: string, n: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10);

// ---------- Home ----------

export type AppOrder = {
  orderNumber: string;
  status: string;
  orderDate: string;
  deliveredAt: string | null;
  services: string[];
};

export type HomeState = "in_progress" | "regular" | "lapsed" | "first";

/** An order Ops is still working on (not delivered, not cancelled). */
export const inProgress = (o: Pick<AppOrder, "status">) => o.status !== "Delivered" && o.status !== "Cancelled";

/** Days within which a last order still counts as "Same as last time" (after that: "Welcome back"). */
export const REGULAR_DAYS = 60;

/**
 * Home's one state card, in the design's order: an order in progress wins; else the last order
 * within 60 days ("Same as last time"); else an older last order ("Welcome back"); else first-time.
 * Cancelled orders don't count as a last order.
 */
export function homeState(orders: AppOrder[], now: Date = new Date()): HomeState {
  if (orders.some(inProgress)) return "in_progress";
  const last = lastOrder(orders);
  if (!last) return "first";
  const days = dayNumber(dhakaDate(now)) - dayNumber(last.orderDate);
  return days <= REGULAR_DAYS ? "regular" : "lapsed";
}

/** The newest non-cancelled order. */
export function lastOrder<T extends AppOrder>(orders: T[]): T | null {
  const kept = orders.filter((o) => o.status !== "Cancelled");
  kept.sort((a, b) => b.orderDate.localeCompare(a.orderDate));
  return kept[0] ?? null;
}

/** Orders that reached the customer. */
export const completedCount = (orders: Pick<AppOrder, "status">[]) => orders.filter((o) => o.status === "Delivered").length;

/** "Make this weekly?" on Home: two or more completed orders and no weekly pickup yet. */
export const showWeeklyOnHome = (completed: number, hasRoutine: boolean) => completed >= 2 && !hasRoutine;

/** The first-order 10% line: only for a customer with no orders at all. */
export const showFirstOrderLine = (orderCount: number) => orderCount === 0;

// ---------- Pickup days and the default rebook slot ----------

export type SlotWindow = { id: string; starts: string; ends: string; left: number; status: string };
export type SlotDay = { date: string; windows: SlotWindow[] };

const open = (w: SlotWindow) => (w.status === "open" || w.status === "few") && w.left > 0;

/**
 * The day picker: the next 7 days with capacity, starting tomorrow (never today). Full or
 * closed windows are left out, not shown as unavailable; a day with none left is left out.
 */
export function pickupDays(days: SlotDay[], today: string, max = 7): SlotDay[] {
  return days
    .filter((d) => d.date > today)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((d) => ({ date: d.date, windows: d.windows.filter(open) }))
    .filter((d) => d.windows.length > 0)
    .slice(0, max);
}

/**
 * The slot a rebook starts on: the first day with capacity (tomorrow when it has any), in the
 * same window as the last order when that window is open that day, else the day's first open
 * window. Null when nothing is open (the customer then picks, or books on WhatsApp).
 */
export function defaultSlot(days: SlotDay[], today: string, lastWindow: string | null): { date: string; window: string } | null {
  const first = pickupDays(days, today, 1)[0];
  if (!first) return null;
  const same = lastWindow ? first.windows.find((w) => w.id === lastWindow) : undefined;
  return { date: first.date, window: (same ?? first.windows[0]).id };
}

/** True when the day is the one after today ("Tomorrow" label). */
export const isTomorrow = (date: string, today: string) => date === addDays(today, 1);

// ---------- Expected return ----------

/** Delivery windows, Dhaka time (as on the booking form and in dispatch). */
export const DELIVERY_WINDOWS = [
  { id: "morning", starts: 9, ends: 12 },
  { id: "afternoon", starts: 12, ends: 16 },
  { id: "evening", starts: 16, ends: 20 },
] as const;

/** Hours from collection: ironing alone is back in 48 h; washing and dry cleaning in 72 h. */
export function turnaroundHours(services: string[]): number {
  const known = services.map((s) => s.trim()).filter(Boolean);
  if (known.length === 0) return 72;
  return known.every((s) => /^ironing$/i.test(s)) ? 48 : 72;
}

/**
 * "Usually back by": the Collected time plus the turnaround (the longest service on a mixed
 * order), moved to the next delivery window. Null once delivered or cancelled, and null when Ops
 * has no Collected time: then nothing is shown rather than a guess.
 */
export function expectedReturn(
  collectedAt: string | null,
  services: string[],
  status: string,
): { date: string; window: string } | null {
  if (!collectedAt || status === "Delivered" || status === "Cancelled") return null;
  const start = Date.parse(collectedAt);
  if (!Number.isFinite(start)) return null;
  const due = start + turnaroundHours(services) * HOUR_MS;
  const local = new Date(due + DHAKA_OFFSET_MS);
  let date = local.toISOString().slice(0, 10);
  const hour = local.getUTCHours() + local.getUTCMinutes() / 60;
  // The window the time falls in, or the next one to start; after the last, the next morning.
  let window = DELIVERY_WINDOWS.find((w) => hour < w.ends)?.id as string | undefined;
  if (!window) {
    date = addDays(date, 1);
    window = DELIVERY_WINDOWS[0].id;
  }
  return { date, window };
}

// ---------- Order detail ----------

export type TimelineEvent = { status: string; at: string };
export type DeliveryPlan = { kind: "pickup" | "delivery"; orderNumber: string | null; slotDate: string; slot: string };

/** The five steps every order shows, with the Ops statuses behind them. */
export const STEPS = [
  { key: "booked", status: "New" },
  { key: "collected", status: "Picked" },
  { key: "cleaning", status: "In Velto Facility" },
  { key: "ready", status: "Ready" },
  { key: "delivered", status: "Delivered" },
] as const;
export type StepKey = (typeof STEPS)[number]["key"];

/** Index of the current step (0–4); an unknown status stays on Booked, the only honest floor. */
export function stepIndex(status: string): number {
  const i = STEPS.findIndex((s) => s.status === status);
  return i === -1 ? 0 : i;
}

/** When Ops recorded the order reaching a status (the latest such change), or null. */
export function reachedAt(timeline: TimelineEvent[], status: string): string | null {
  const hits = timeline.filter((e) => e.status === status && Number.isFinite(Date.parse(e.at)));
  if (hits.length === 0) return null;
  return hits.reduce((a, b) => (Date.parse(b.at) > Date.parse(a.at) ? b : a)).at;
}

export type TrackerStep = { key: StepKey; state: "done" | "current" | "upcoming"; at: string | null };

/**
 * The tracker: five steps, done up to the current one. A time appears only where Ops recorded
 * one; upcoming steps never carry a time.
 */
export function trackerSteps(status: string, timeline: TimelineEvent[]): TrackerStep[] {
  const current = stepIndex(status);
  const delivered = status === "Delivered";
  return STEPS.map((s, i) => {
    const state = i < current || (delivered && i === current) ? "done" : i === current ? "current" : "upcoming";
    return { key: s.key, state, at: state === "upcoming" ? null : reachedAt(timeline, s.status) };
  });
}

export type ReadyLine = { kind: "notPlanned" } | { kind: "today"; window: string };

/**
 * The line under Ready, from dispatch data only: no delivery planned → "Delivery not planned
 * yet"; planned for today → "Delivery today, {window}". A plan for another day shows no line,
 * and "the rider is on the way" is never claimed (Ops records no departure).
 */
export function readyLine(plans: DeliveryPlan[], orderNumber: string, today: string): ReadyLine | null {
  const mine = plans.filter((p) => p.kind === "delivery" && p.orderNumber === orderNumber && p.slotDate >= today);
  if (mine.length === 0) return { kind: "notPlanned" };
  const now = mine.find((p) => p.slotDate === today);
  return now ? { kind: "today", window: now.slot } : null;
}

/** Distinct services in the order they first appear: "Dry Cleaning + Wash & Iron". */
export function serviceList(lines: { service: string }[], services: string[]): string[] {
  const seen: string[] = [];
  for (const s of [...lines.map((l) => l.service), ...(lines.length ? [] : services)]) {
    const v = s?.trim();
    if (v && !seen.includes(v)) seen.push(v);
  }
  return seen;
}

/** More than one service on the order: each item row shows its own service. */
export const isMixed = (lines: { service: string }[], services: string[]) => serviceList(lines, services).length > 1;

/** Dhaka clock for a timestamp: 12-hour parts plus the 24-hour hour (Bangla names the part of day from it). */
export function dhakaClock(value: string): { hour12: number; minute: string; pm: boolean; hour: number } | null {
  const t = Date.parse(value);
  if (!Number.isFinite(t)) return null;
  const local = new Date(t + DHAKA_OFFSET_MS);
  const hour = local.getUTCHours();
  return { hour12: hour % 12 === 0 ? 12 : hour % 12, minute: String(local.getUTCMinutes()).padStart(2, "0"), pm: hour >= 12, hour };
}

/** Days after delivery during which "How did we do?" is asked (the record can still be edited for 14 days). */
export const FEEDBACK_DAYS = 14;

/** Ask "How did we do?": delivered within the last FEEDBACK_DAYS and not answered yet. */
export const askFeedback = (deliveredAt: string | null, answered: boolean, now: Date = new Date()) =>
  !answered && !!deliveredAt && Number.isFinite(Date.parse(deliveredAt)) && Date.parse(deliveredAt) >= now.getTime() - FEEDBACK_DAYS * 86_400_000;
