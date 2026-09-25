import "server-only";

import type { Locale } from "@/lib/i18n/config";
import { pagesBn } from "./bn";
import { pagesEn, type PageText } from "./en";

export type { PageText };

/** Internal-page text for a language (Server Components only). */
export const pageText = (locale: Locale): PageText => (locale === "bn" ? pagesBn : pagesEn);
