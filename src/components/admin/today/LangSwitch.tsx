"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { TODAY_LANG_COOKIE } from "@/content/i18n/admin-today";
import type { TodayLang } from "./format";

/**
 * বাংলা / EN on the Today header. Remembers the choice for this person in a cookie (a year, admin
 * pages only) and re-renders the page on the server in that language.
 */
export function LangSwitch({ lang, label }: { lang: TodayLang; label: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const options: { id: TodayLang; text: string; langAttr: string }[] = [
    { id: "en", text: "EN", langAttr: "en" },
    { id: "bn", text: "বাংলা", langAttr: "bn" },
  ];
  return (
    <div role="group" aria-label={label} aria-busy={pending || undefined} className="flex shrink-0 overflow-hidden rounded-full border border-white/30">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          lang={o.langAttr}
          aria-pressed={lang === o.id}
          onClick={() => {
            if (o.id === lang) return;
            document.cookie = `${TODAY_LANG_COOKIE}=${o.id}; path=/admin; max-age=31536000; samesite=lax`;
            start(() => router.refresh());
          }}
          className={`min-h-11 min-w-12 px-3.5 text-[14px] font-semibold ${lang === o.id ? "bg-white text-navy" : "text-white/85 hover:bg-white/10 hover:text-white"}`}
        >
          {o.text}
        </button>
      ))}
    </div>
  );
}
