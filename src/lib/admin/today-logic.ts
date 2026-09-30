/**
 * The "Today" screen's decisions: which tab a job belongs to, who to call first, how loaded each
 * rider is, and how full each window of the day is. Pure, like dispatch-logic.ts, so it is
 * unit-tested on its own; the loader and the page only call it.
 */
import { DEFAULT_CAPACITY, SLOTS, stopCount, type DispatchJob, type SlotId } from "./dispatch-logic";
import { callTimer, type CustomerContext } from "./request-flow";

/** The four tabs: call new requests, assign confirmed ones, arrange deliveries, run the routes. */
export type TodayTab = "call" | "assign" | "deliver" | "route";

export type Rider = { id: string; name: string; stopsPerWindow: number; off: boolean };
/** A rider with their load in one window; `best` is the one to pick (most room, not off, not full). */
export type RiderChoice = Rider & { load: number; full: boolean; best: boolean };

/** Stops a rider can do in one window (the default when none is set). */
const capacityOf = (r: Rider) => r.stopsPerWindow || DEFAULT_CAPACITY;

/**
 * The tab a job is waiting in. "done" is finished work, null is not for this screen (cancelled,
 * merged, or a quote request, which has no pickup to plan).
 */
export function tabFor(job: DispatchJob): TodayTab | "done" | null {
  if (job.source === "website_quote") return null;
  switch (job.stage) {
    case "cancelled":
    case "merged":
      return null;
    case "picked":
    case "done":
      return "done";
    case "scheduled":
      return "route";
    case "new":
      return job.kind === "delivery" ? "deliver" : "call";
    default:
      // confirmed, or assigned with only a person or only a slot: still needs a person and a slot.
      return job.kind === "delivery" ? "deliver" : "assign";
  }
}

/** New requests still to call: late ones first, then the one that has waited longest. */
export function callQueue(jobs: DispatchJob[], now = Date.now()): DispatchJob[] {
  return jobs
    .filter((j) => tabFor(j) === "call")
    .sort((a, b) => {
      const late = Number(callTimer(b, now)?.tone === "late") - Number(callTimer(a, now)?.tone === "late");
      return late || Date.parse(a.created_at) - Date.parse(b.created_at);
    });
}

/** Stops a rider has in one window: only scheduled jobs, a combined trip counts once. */
export function riderLoad(jobs: DispatchJob[], riderId: string, date: string, slot: SlotId): number {
  return stopCount(jobs.filter((j) => j.stage === "scheduled" && j.assignee_id === riderId && j.slot_date === date && j.slot === slot));
}

/** Riders for one window, best first: people who are off last, full after free, then lightest load, then name. */
export function riderChoices(riders: Rider[], jobs: DispatchJob[], date: string, slot: SlotId): RiderChoice[] {
  const choices = riders
    .map((r) => {
      const load = riderLoad(jobs, r.id, date, slot);
      return { ...r, load, full: load >= capacityOf(r), best: false };
    })
    .sort((a, b) => Number(a.off) - Number(b.off) || Number(a.full) - Number(b.full) || a.load - b.load || a.name.localeCompare(b.name));
  if (choices[0] && !choices[0].off && !choices[0].full) choices[0].best = true;
  return choices;
}

/** One day as three windows: stops planned against the room of everyone who is working. */
export function dayStrip(riders: Rider[], jobs: DispatchJob[], date: string): { slot: SlotId; planned: number; capacity: number }[] {
  const capacity = riders.filter((r) => !r.off).reduce((sum, r) => sum + capacityOf(r), 0);
  return SLOTS.map((s) => ({
    slot: s.id,
    planned: riders.reduce((sum, r) => sum + riderLoad(jobs, r.id, date, s.id), 0),
    capacity,
  }));
}

/** The window it is now in Dhaka (UTC+6): 9–12, 12–16, 16–20, otherwise none. */
export function nowWindow(now = new Date()): SlotId | null {
  const hour = new Date(now.getTime() + 6 * 3_600_000).getUTCHours();
  if (hour >= 9 && hour < 12) return "morning";
  if (hour >= 12 && hour < 16) return "afternoon";
  if (hour >= 16 && hour < 20) return "evening";
  return null;
}

/** The customer changed their time and nobody has acted since (drives the "Changed time" badge). */
export const changedTime = (job: DispatchJob) => job.history[job.history.length - 1]?.action === "customer changed time";

/** An Ops order that could be the one made from a picked-up request. */
export type OrderCandidate = { orderNumber: string; createdAt: string };

const DAY_MS = 86_400_000;
const ORDER_NUMBER = /^VELR?-\d{3,6}$/;

/**
 * "Which order?": the same phone's Ops orders that could belong to a picked pickup with no order
 * yet: created from a day before the pickup (but not before the request itself) to two days after,
 * not cancelled, and not already linked to another pickup (`taken`), for pickups of the last 7 days. Oldest first. The same rule
 * as website_dispatch_autolink() (website_today.sql), which links on its own when there is one.
 */
export function linkCandidates(job: DispatchJob, recent: CustomerContext["recent"] | undefined, taken: ReadonlySet<string>, now = Date.now()): OrderCandidate[] {
  if (job.kind !== "pickup" || job.stage !== "picked" || job.order_number || !job.picked_at || !recent) return [];
  const picked = Date.parse(job.picked_at);
  // Picked up over a week ago: no longer matched (autolink stops looking then too).
  if (!(picked > now - 7 * DAY_MS)) return [];
  const from = Math.max(picked - DAY_MS, Date.parse(job.created_at));
  const to = picked + 2 * DAY_MS;
  return recent
    .filter((o) => {
      const at = Date.parse(o.createdAt);
      return ORDER_NUMBER.test(o.orderNumber) && o.status !== "Cancelled" && !taken.has(o.orderNumber) && at >= from && at <= to;
    })
    .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt))
    .map((o) => ({ orderNumber: o.orderNumber, createdAt: o.createdAt }));
}
