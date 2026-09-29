/**
 * Pickup day and window as Velto Ops reads them, shared by one-tap repeat with the booking form's
 * wording ("Tomorrow Wed 30 Sep, Afternoon 12–4 PM (window booked)"). Runtime-neutral.
 */
import { windowHours, type WindowId } from "./capacity-logic";
import { fill, type Locale } from "./i18n/config";

/** Today in Dhaka (YYYY-MM-DD): pickup days are Dhaka days. */
export const dhakaToday = (now = new Date()) => new Date(now.getTime() + 6 * 3_600_000).toISOString().slice(0, 10);

export const addDays = (iso: string, n: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

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

/** "Wed 30 Sep" for a YYYY-MM-DD, whatever the device's time zone. */
export const niceDate = (iso: string, w: DateWords) => {
  const d = new Date(`${iso}T00:00:00Z`);
  return fill(w.dayMonth, { weekday: w.weekdays[d.getUTCDay()], day: d.getUTCDate(), month: w.months[d.getUTCMonth()] }, w.locale);
};

/** "Today" / "Tomorrow" / "Thu 1 Oct" in the given words. */
export const dayLabel = (iso: string, w: DateWords, today = dhakaToday()) =>
  iso === today ? w.today : iso === addDays(today, 1) ? w.tomorrow : niceDate(iso, w);

const OPS_WINDOWS: Record<WindowId, string> = { morning: "Morning", afternoon: "Afternoon", evening: "Evening", night: "Night" };

/** The Ops preferredPickup string, exactly as the booking form writes it. */
export function opsPickupWhen(date: string, w: { id: WindowId; starts: string; ends: string }, booked: boolean, today = dhakaToday()) {
  const prefix = date === today ? OPS_WORDS.today : date === addDays(today, 1) ? OPS_WORDS.tomorrow : "";
  return `${`${prefix} ${niceDate(date, OPS_WORDS)}`.trim()}, ${OPS_WINDOWS[w.id]} ${windowHours(w.starts, w.ends)}${booked ? " (window booked)" : ""}`;
}
