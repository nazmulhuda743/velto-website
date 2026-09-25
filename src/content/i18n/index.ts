import type { Locale } from "@/lib/i18n/config";
import { bn } from "./bn";
import { en, type Dictionary } from "./en";

export type { Dictionary };

/** UI text for a language. Both files are small, so this is synchronous and safe in Client Components. */
export const dictionary = (locale: Locale): Dictionary => (locale === "bn" ? bn : en);
