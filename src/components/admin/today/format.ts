/**
 * Small display helpers for the Today page, shared by its server and client parts. Pure: the
 * words come from the page's dictionary (src/content/i18n/admin-today), so each language keeps
 * its own digits and word order. Names, phones, areas and VEL numbers stay as entered.
 */
import type { TodayText } from "@/content/i18n/admin-today";
import { addDays, type SlotId } from "@/lib/admin/dispatch-logic";

export type TodayLang = "en" | "bn";

/** "Thursday 1 October" / "বৃহস্পতিবার ১ অক্টোবর". */
export function dateLine(iso: string, t: TodayText) {
  const d = new Date(`${iso}T00:00:00Z`);
  return `${t.weekdays[d.getUTCDay()]} ${t.num(d.getUTCDate())} ${t.months[d.getUTCMonth()]}`;
}

/** A day next to a time: "" for `base` itself, "Tomorrow", otherwise "3 October". */
export function dayWord(iso: string | null | undefined, base: string, t: TodayText) {
  if (!iso || iso === base) return "";
  if (iso === addDays(base, 1)) return t.tomorrow;
  const d = new Date(`${iso}T00:00:00Z`);
  return `${t.num(d.getUTCDate())} ${t.months[d.getUTCMonth()]}`;
}

/** "Sector 7" in the page language when the area names a Uttara sector, otherwise the area as entered. */
export function place(area: string | null | undefined, t: TodayText) {
  const a = (area ?? "").trim();
  // "Uttara Sector 7", or just "7" (routine requests store the sector number alone).
  const m = a.match(/sector\s*(\d{1,2})\b/i) ?? a.match(/^(\d{1,2})$/);
  return m && Number(m[1]) >= 1 && Number(m[1]) <= 18 ? t.sector(Number(m[1])) : a;
}

/** How long someone has waited: "42 min", "3 h", "2 days". */
export function waitText(minutes: number, t: TodayText) {
  if (minutes < 60) return t.waitingMin(minutes);
  if (minutes < 48 * 60) return t.waitingHours(Math.floor(minutes / 60));
  return t.waitingDays(Math.floor(minutes / (24 * 60)));
}

/** Clock time in Dhaka, "9:40" / "৯:৪০" (12-hour, the way staff say it). */
export function clock(iso: string, t: TodayText) {
  const d = new Date(Date.parse(iso) + 6 * 3_600_000);
  const h = d.getUTCHours() % 12 || 12;
  const m = d.getUTCMinutes();
  return `${t.num(h)}:${t.num(Math.floor(m / 10))}${t.num(m % 10)}`;
}

/** "9:40" when it was today (Dhaka), otherwise "28 September" (in the page's digits). */
export function whenText(iso: string, today: string, t: TodayText) {
  const day = new Date(Date.parse(iso) + 6 * 3_600_000).toISOString().slice(0, 10);
  if (day === today) return clock(iso, t);
  const d = new Date(`${day}T00:00:00Z`);
  return `${t.num(d.getUTCDate())} ${t.months[d.getUTCMonth()]}`;
}

/** One or two letters for an avatar. */
export function initials(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  return (words[0]?.[0] ?? "?").toUpperCase();
}

/** "Morning 9–12" plus the day when it isn't `base`: "Tomorrow · Morning 9–12". */
export function windowText(slot: SlotId, date: string | null | undefined, base: string, t: TodayText) {
  const day = dayWord(date, base, t);
  return day ? `${day} · ${t.windows[slot]}` : t.windows[slot];
}
