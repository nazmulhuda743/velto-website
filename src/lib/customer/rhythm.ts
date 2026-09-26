/**
 * A customer's laundry rhythm, from their own Velto orders only: where they are on the
 * first → second → regular path, and when their next pickup would naturally fall.
 *
 * Pure (no imports), so it is unit-tested without a server. Nothing here is a promise or
 * an offer: it only turns dates the customer can already see into a helpful next step.
 */

export type RhythmOrder = {
  orderNumber: string;
  status: string;
  orderDate: string;
  deliveredAt: string | null;
  services: string[];
};

export type Stage =
  /** No completed order yet: get the first pickup booked. */
  | "first"
  /** One order: the biggest drop-off in Velto's history, so this stage matters most. */
  | "second"
  /** Two orders: a rhythm is forming. */
  | "third"
  /** Three or more: a regular customer. */
  | "regular";

export type Due = "later" | "soon" | "now" | "overdue";

export type Rhythm = {
  stage: Stage;
  /** Non-cancelled orders, newest first. */
  count: number;
  last: RhythmOrder | null;
  /** Whole days since the last order was delivered (or placed, while it has no delivery time). */
  daysSince: number | null;
  /** daysSince counts from the delivery (true) or, with no delivery time recorded, from the order day. */
  sinceDelivery: boolean;
  /** Median days between this customer's own orders; needs at least two orders. */
  everyDays: number | null;
  /** Dhaka calendar day (YYYY-MM-DD) the next pickup would fall on at their usual pace. */
  nextOn: string | null;
  due: Due | null;
  /** Weekday (0 = Sunday) they order on most, from two or more orders; ties go to the latest. */
  usualWeekday: number | null;
  /** Booking-form service to preselect for "the same again", when one maps. */
  repeatService: string | null;
};

const DAY_MS = 86_400_000;

/** Ops service_category → booking-form service. */
const OPS_TO_BOOKING: Record<string, string> = {
  "Dry Cleaning": "dry-cleaning",
  "Wash + Iron": "wash-and-iron",
  Ironing: "ironing",
};

export const bookingServiceFor = (services: string[]) =>
  services.map((s) => OPS_TO_BOOKING[s.trim()]).find(Boolean) ?? null;

/** Dhaka calendar day for a date or timestamp. */
export function dhakaDay(value: string | Date) {
  const d = typeof value === "string" ? new Date(value.length === 10 ? `${value}T00:00:00+06:00` : value) : value;
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dhaka", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

const dayNumber = (day: string) => Math.round(Date.parse(`${day}T00:00:00Z`) / DAY_MS);
const fromDayNumber = (n: number) => new Date(n * DAY_MS).toISOString().slice(0, 10);

function median(values: number[]) {
  const s = [...values].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

export function laundryRhythm(orders: RhythmOrder[], now: Date = new Date()): Rhythm {
  const kept = orders
    .filter((o) => o.status !== "Cancelled" && /^\d{4}-\d{2}-\d{2}/.test(o.orderDate))
    .sort((a, b) => (a.orderDate < b.orderDate ? 1 : a.orderDate > b.orderDate ? -1 : 0));
  const count = kept.length;
  const stage: Stage = count === 0 ? "first" : count === 1 ? "second" : count === 2 ? "third" : "regular";
  const last = kept[0] ?? null;
  if (!last) return { stage, count, last, daysSince: null, sinceDelivery: false, everyDays: null, nextOn: null, due: null, usualWeekday: null, repeatService: null };

  const today = dayNumber(dhakaDay(now));
  const lastDay = dayNumber(dhakaDay(last.deliveredAt ?? last.orderDate.slice(0, 10)));
  const daysSince = Math.max(0, today - lastDay);

  // Gaps between distinct order days; same-day orders are one visit.
  const days = [...new Set(kept.map((o) => dayNumber(o.orderDate.slice(0, 10))))];
  const gaps = days.slice(0, -1).map((d, i) => d - days[i + 1]).filter((g) => g > 0);
  // Clamp to a sensible household range so one odd gap can't suggest "every 2 days" or "every 5 months".
  const everyDays = gaps.length ? Math.min(45, Math.max(4, Math.round(median(gaps)))) : null;

  let nextOn: string | null = null;
  let due: Due | null = null;
  if (everyDays) {
    const next = dayNumber(last.orderDate.slice(0, 10)) + everyDays;
    nextOn = fromDayNumber(next);
    const left = next - today;
    due = left > 3 ? "later" : left > 0 ? "soon" : left >= -3 ? "now" : "overdue";
  }

  let usualWeekday: number | null = null;
  if (count >= 2) {
    const tally = new Map<number, number>();
    // Newest first, so on a tie the more recent habit wins (Map keeps first-seen order).
    for (const d of days) {
      const w = new Date(d * DAY_MS).getUTCDay();
      tally.set(w, (tally.get(w) ?? 0) + 1);
    }
    let best = 0;
    for (const [w, n] of tally) if (n > best) [usualWeekday, best] = [w, n];
  }

  return {
    stage,
    count,
    last,
    daysSince,
    sinceDelivery: Boolean(last.deliveredAt),
    everyDays,
    nextOn,
    due,
    usualWeekday,
    repeatService: bookingServiceFor(last.services),
  };
}

export const ROUTINE_DAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
export const ROUTINE_EVERY = ["weekly", "fortnightly"] as const;

/** Parses /book?routine=weekly&day=sat from the account's routine form; null when anything is off. */
export function parseRoutine(every: unknown, day: unknown) {
  const e = ROUTINE_EVERY.find((x) => x === every);
  const d = ROUTINE_DAYS.findIndex((x) => x === day);
  return e && d >= 0 ? { every: e, day: d } : null;
}

/** The /book link for "the same again": preselects the service and notes which order it repeats. */
export function repeatHref(r: Pick<Rhythm, "last" | "repeatService">, placement: string) {
  const q = new URLSearchParams({ source: placement });
  if (r.repeatService) q.set("service", r.repeatService);
  if (r.last) q.set("repeat", r.last.orderNumber);
  return `/book?${q.toString()}`;
}
