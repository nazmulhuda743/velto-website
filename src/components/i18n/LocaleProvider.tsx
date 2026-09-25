"use client";

import { createContext, useContext } from "react";
import { DEFAULT_LOCALE, localizeHref, type Locale } from "@/lib/i18n/config";

const LocaleContext = createContext<Locale>(DEFAULT_LOCALE);

/** Makes the page language available to Client Components (set once in app/[lang]/layout). */
export function LocaleProvider({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  return <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>;
}

export const useLocale = () => useContext(LocaleContext);

/** localizeHref for the current page's language, in Client Components. */
export function useLocalHref() {
  const locale = useLocale();
  return (href: string) => localizeHref(href, locale);
}
