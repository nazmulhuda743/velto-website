import "server-only";

import { formatDay, formatTime, taka } from "@/content/order-status";
import { formText } from "@/content/i18n/forms";
import { fill, keepBanglaSuffixes, localDigits, type Locale } from "@/lib/i18n/config";
import { accountBn } from "./bn";
import { accountEn, type AccountText } from "./en";

export type { AccountText };

const accountBnDisplay = keepBanglaSuffixes(accountBn);

/** Account and sign-in text for a language (Server Components and server actions only). */
export const accountText = (locale: Locale): AccountText => (locale === "bn" ? accountBnDisplay : accountEn);

const WEEKDAY_INDEX: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

/**
 * Order statuses, dates, times and amounts in the page language. English is exactly
 * content/order-status.ts; Bangla uses the same Dhaka calendar day with Bangla names and digits.
 */
export function orderFormat(locale: Locale) {
  const t = accountText(locale);
  const f = formText(locale);
  const stages = f.track.stages;

  const day = (value: string | null | undefined, withYear = false) => {
    if (locale === "en" || !value) return formatDay(value, withYear);
    const d = new Date(value.length === 10 ? `${value}T00:00:00+06:00` : value);
    const parts = Object.fromEntries(
      new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Dhaka", weekday: "short", day: "numeric", month: "numeric", year: "numeric" })
        .formatToParts(d)
        .map((p) => [p.type, p.value]),
    );
    const text = fill(
      f.common.dayMonth,
      { weekday: f.common.weekdays[WEEKDAY_INDEX[parts.weekday] ?? 0], day: parts.day, month: f.common.months[Number(parts.month) - 1] },
      locale,
    );
    return withYear ? `${text} ${localDigits(parts.year, locale)}` : text;
  };

  return {
    statusTitle: (status: string) => (status === "Cancelled" ? t.status.cancelled : (stages[status]?.title ?? t.status.fallback)),
    stage: (status: string) => stages[status],
    day,
    time: (value: string | null | undefined) => {
      const text = formatTime(value);
      return text === null ? null : localDigits(text, locale);
    },
    taka: (n: number | null | undefined) => {
      const text = taka(n);
      return text === null ? null : localDigits(text, locale);
    },
  };
}
