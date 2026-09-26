"use client";

import { createContext, useContext } from "react";
import { DEFAULT_LOCALE, localizeHref, type Locale } from "@/lib/i18n/config";
import { setCopyLocale, type CopyMap } from "@/lib/i18n/copy-overrides";

const LocaleContext = createContext<Locale>(DEFAULT_LOCALE);

/** Makes the page language available to Client Components (set once in app/[lang]/layout). */
export function LocaleProvider({ locale, copy, children }: { locale: Locale; copy?: CopyMap; children: React.ReactNode }) {
  // Seed the admin's text edits for this language before any child reads text, in both the
  // server render and the browser. Only this language is replaced, so a concurrent render in the
  // other language keeps its own edits.
  setCopyLocale(locale, copy);
  return <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>;
}

export const useLocale = () => useContext(LocaleContext);

/** localizeHref for the current page's language, in Client Components. */
export function useLocalHref() {
  const locale = useLocale();
  return (href: string) => localizeHref(href, locale);
}
