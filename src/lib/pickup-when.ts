/**
 * Pickup day and part of the day, shared by the booking form and one-tap repeat so Velto Ops
 * always receives the same wording ("Tomorrow Fri 25 Sep, Afternoon"). Runtime-neutral.
 */
import { fill, type Locale } from "./i18n/config";

/**
 * Preferred part of the day. No clock times: the Velto team calls to confirm the exact time.
 * `en` is what Velto Ops receives; the customer sees their language. `end` (Dhaka hour) only
 * rules out a part of today that has already passed.
 */
export const SLOTS = [
  { id: "morning", en: "Morning", end: 12 },
  { id: "afternoon", en: "Afternoon", end: 17 },
  { id: "evening", en: "Evening", end: 21 },
] as const;

export type SlotId = (typeof SLOTS)[number]["id"];

/** A part of the day can still be chosen for today until an hour before it ends (Dhaka time). */
export const slotOpenToday = (end: number, now = new Date()) => (now.getUTCHours() + 6) % 24 < end - 1;

export const isoDate = (offsetDays = 0, from?: string) => {
  const d = from ? new Date(`${from}T00:00:00`) : new Date();
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/** Words for dates: English for Ops, or the page language for the customer. */
export type DateWords = {
  today: string;
  tomorrow: string;
  weekdays: readonly string[];
  months: readonly string[];
  dayMonth: string;
  locale: Locale;
};

/** What Velto Ops receives, whatever the page language. */
export const OPS_WORDS: DateWords = {
  today: "Today",
  tomorrow: "Tomorrow",
  weekdays: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
  months: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
  dayMonth: "{weekday} {day} {month}",
  locale: "en",
};

export const niceDate = (iso: string, w: DateWords) => {
  const d = new Date(`${iso}T00:00:00`);
  return fill(w.dayMonth, { weekday: w.weekdays[d.getDay()], day: d.getDate(), month: w.months[d.getMonth()] }, w.locale);
};

/** "Tomorrow Fri 25 Sep, Afternoon" (Ops) or the same in the page language with `slotLabel`. */
export function pickupWhen(iso: string, slot: string, w: DateWords = OPS_WORDS, slotLabel?: string) {
  const prefix = iso === isoDate(0) ? w.today : iso === isoDate(1) ? w.tomorrow : "";
  const day = iso ? `${prefix} ${niceDate(iso, w)}`.trim() : "";
  const part = slotLabel ?? SLOTS.find((x) => x.id === slot)?.en;
  return [day, part].filter(Boolean).join(", ");
}
