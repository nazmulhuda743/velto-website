"use client";

import { createContext, useContext } from "react";
import { usePathname } from "next/navigation";
import { dictionary } from "@/content/i18n";
import { banglaEnabled, LANG_COOKIE, localizeHref, pathWithoutLocale } from "@/lib/i18n/config";
import { useLocale } from "./LocaleProvider";

const ToHomeContext = createContext(false);

/**
 * On a 404 the same path in the other language is a 404 too, so the switch goes to that
 * language's homepage instead. Wraps the site chrome of the not-found page.
 */
export function LanguageSwitchToHome({ children }: { children: React.ReactNode }) {
  return <ToHomeContext.Provider value>{children}</ToHomeContext.Provider>;
}

/**
 * "বাংলা" on English pages, "English" on Bangla pages: the same page in the other
 * language. A full page load (not client navigation) so the document language, fonts
 * and metadata switch cleanly; the choice is remembered in velto_lang for next visits.
 */
export function LanguageSwitcher({ className = "" }: { className?: string }) {
  const locale = useLocale();
  const pathname = usePathname();
  const toHome = useContext(ToHomeContext);
  if (!banglaEnabled()) return null;
  const other = locale === "bn" ? "en" : "bn";
  const t = dictionary(locale).language;
  const href = localizeHref(toHome ? "/" : pathWithoutLocale(pathname), other);
  return (
    <a
      href={href}
      hrefLang={other}
      lang={other}
      aria-label={t.switchToAria}
      data-language-switch={other}
      onClick={(e) => {
        document.cookie = `${LANG_COOKIE}=${other}; Path=/; Max-Age=${60 * 60 * 24 * 365}; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
        // Keep the query (e.g. ?service=ironing) when switching to the same page.
        if (!toHome) e.currentTarget.href = href + window.location.search + window.location.hash;
      }}
      className={className}
    >
      {t.switchTo}
    </a>
  );
}
