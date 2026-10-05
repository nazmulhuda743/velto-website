import "server-only";

import { formText } from "@/content/i18n/forms";
import { orderFormat } from "@/content/i18n/account";
import { serviceLabel } from "@/content/order-status";
import { dhakaClock } from "@/lib/customer/app-logic";
import { fill, localDigits, type Locale } from "@/lib/i18n/config";

/** Words, dates, times and amounts for the app's order screens, in the page language. */
export function appOrderFormat(locale: Locale) {
  const t = formText(locale).common.app;
  const base = orderFormat(locale);
  const { taka } = base;
  /** Day without a padded date ("রবি ৫ অক্টোবর", not "০৫"). */
  const day = (value: string | null | undefined) => base.day(value)?.replace(/(^|\s)[0০](?=[0-9০-৯](\s|$))/u, "$1") ?? null;

  const service = (raw: string) => t.services[raw.trim()] ?? serviceLabel(raw);
  /** "Dry Cleaning + Wash & Iron" (mixed orders). */
  const services = (list: string[]) => list.map(service).join(" + ");

  /** "Sun 5 Oct 10:12 AM" ("Wed 7 Oct, 3:40 PM" with comma); Bangla "রবি ৫ অক্টোবর বিকেল ৫:৩০" (part of day from the hour; none in the morning). */
  const stamp = (iso: string | null, comma = false) => {
    if (!iso) return null;
    const c = dhakaClock(iso);
    const d = day(iso);
    if (!c || !d) return d ?? null;
    // English says AM/PM after the time; Bangla names the part of the day before it (none in the morning).
    const part = c.hour < 5 || c.hour >= 20 ? t.clock.night : c.hour >= 18 ? t.clock.evening : c.hour >= 15 ? t.clock.afternoon : c.hour >= 12 ? t.clock.noon : "";
    const suffix = c.pm ? t.clock.pm : t.clock.am;
    const clock = [part, localDigits(`${c.hour12}:${c.minute}`, locale), suffix].filter(Boolean).join(" ");
    return comma ? `${d}, ${clock}` : `${d} ${clock}`;
  };

  const items = (n: number) => fill(n === 1 ? t.itemsOne : t.itemsMany, { n }, locale);
  const money = (n: number) => taka(n) ?? "";

  return { t, day, stamp, service, services, items, money, locale };
}

export type AppOrderFormat = ReturnType<typeof appOrderFormat>;
