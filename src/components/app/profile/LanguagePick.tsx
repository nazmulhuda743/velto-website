"use client";

import { LANG_COOKIE } from "@/lib/i18n/config";
import { announceSaved } from "./SavedFlag";

/** Remembers the language for every app page (outside the component: it writes document.cookie). */
function remember(lang: "en" | "bn") {
  document.cookie = `${LANG_COOKIE}=${lang}; Path=/; Max-Age=${60 * 60 * 24 * 365}; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
}

/** Profile › Language: the app's pages keep one address; the choice is the velto_lang cookie. */
export function LanguagePick({ current, names }: { current: "en" | "bn"; names: { en: string; bn: string } }) {
  const pick = (lang: "en" | "bn") => {
    if (lang === current) return;
    remember(lang);
    announceSaved();
    // A full load, so the document language and fonts switch cleanly.
    location.reload();
  };
  return (
    <fieldset className="space-y-2" data-app-language>
      <legend className="sr-only">{names[current]}</legend>
      {(["en", "bn"] as const).map((l) => (
        <label key={l} lang={l} className={`flex min-h-13 cursor-pointer items-center justify-between rounded-xl border-[1.5px] px-4 a-row ${l === current ? "border-action bg-app-tint font-semibold text-navy" : "border-app-chip bg-app-card text-body"}`}>
          {names[l]}
          <input type="radio" name="app-lang" className="size-4 accent-[#0b72b9]" checked={l === current} onChange={() => pick(l)} />
        </label>
      ))}
    </fieldset>
  );
}
