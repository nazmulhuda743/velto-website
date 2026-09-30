import { todayBn } from "./bn";
import { todayEn, type TodayText } from "./en";

export type { TodayText };

/** Cookie that remembers the staff member's language on the Today page. */
export const TODAY_LANG_COOKIE = "velto_admin_lang";

/** Text for the Today page in a language. No server-only code, so pages and client components can both use it. */
export const todayText = (lang: "en" | "bn"): TodayText => (lang === "bn" ? todayBn : todayEn);
