import "server-only";

import { keepBanglaSuffixes, type Locale } from "@/lib/i18n/config";
import { pagesBn } from "./bn";
import { pagesEn, type PageText } from "./en";

export type { PageText };

/** Internal-page text for a language (Server Components only). */
const pagesBnDisplay = keepBanglaSuffixes(pagesBn);
export const pageText = (locale: Locale): PageText => (locale === "bn" ? pagesBnDisplay : pagesEn);
