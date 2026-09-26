import { keepBanglaSuffixes, type Locale } from "@/lib/i18n/config";
import { withOverrides } from "@/lib/i18n/copy-overrides";
import { bn } from "./bn";
import { en, type Dictionary } from "./en";

export type { Dictionary };

/** UI text for a language. Both files are small, so this is synchronous and safe in Client Components. */
const bnDisplay = keepBanglaSuffixes(bn);
export const dictionary = (locale: Locale): Dictionary =>
  locale === "bn" ? withOverrides("site", "bn", bnDisplay, keepBanglaSuffixes) : withOverrides("site", "en", en);
