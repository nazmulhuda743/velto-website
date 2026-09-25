"use client";

import { usePathname } from "next/navigation";
import { dictionary } from "@/content/i18n";
import { banglaEnabled, LANG_COOKIE, localizeHref, pathWithoutLocale } from "@/lib/i18n/config";
import { useLocale } from "./LocaleProvider";

/**
 * "বাংলা" on English pages, "English" on Bangla pages: the same page in the other
 * language. A full page load (not client navigation) so the document language, fonts
 * and metadata switch cleanly; the choice is remembered in velto_lang for next visits.
 */
export function LanguageSwitcher({ className = "" }: { className?: string }) {
  const locale = useLocale();
  const pathname = usePathname();
  if (!banglaEnabled()) return null;
  const other = locale === "bn" ? "en" : "bn";
  const t = dictionary(locale).language;
  const href = localizeHref(pathWithoutLocale(pathname), other);
  return (
    <a
      href={href}
      hrefLang={other}
      lang={other}
      aria-label={t.switchToAria}
      data-language-switch={other}
      onClick={(e) => {
        document.cookie = `${LANG_COOKIE}=${other}; Path=/; Max-Age=${60 * 60 * 24 * 365}; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
        // Keep the query (e.g. ?service=ironing) when switching.
        e.currentTarget.href = href + window.location.search + window.location.hash;
      }}
      className={className}
    >
      {t.switchTo}
    </a>
  );
}
