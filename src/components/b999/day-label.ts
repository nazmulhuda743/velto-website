import type { B999Text } from "@/content/i18n/b999";
import { localDigits, type Locale } from "@/lib/i18n/config";

/** "Tomorrow, Fri 9 Oct" / "আগামীকাল, শুক্র ৯ অক্টোবর": shared by the form (client) and the page (server). */
export function dayLabel(iso: string, t: B999Text, locale: Locale, tomorrow: string | null) {
  const d = new Date(`${iso}T00:00:00Z`);
  const text = `${t.weekdays[d.getUTCDay()]} ${localDigits(d.getUTCDate(), locale)} ${t.months[d.getUTCMonth()]}`;
  return iso === tomorrow ? `${t.tomorrow}, ${text}` : text;
}
