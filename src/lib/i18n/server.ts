import "server-only";

import { headers } from "next/headers";
import { lang } from "next/root-params";
import { dictionary } from "@/content/i18n";
import { LOCATIONS, SERVICE_AREA, SERVICE_SECTORS } from "@/content/site";
import { DEFAULT_LOCALE, isLocale, LOCALE_HEADER, localDigits, localizeHref, type Locale } from "./config";

/**
 * The language of the page being rendered: the root [lang] segment (next/root-params),
 * or, where root params aren't available (server actions), the proxy's request header. Admin, route
 * handlers and server actions get English.
 */
export async function getLocale(): Promise<Locale> {
  try {
    const value = await lang();
    if (isLocale(value)) return value;
  } catch {
    /* not rendered under app/[lang] */
  }
  try {
    const value = (await headers()).get(LOCALE_HEADER);
    return isLocale(value) ? value : DEFAULT_LOCALE;
  } catch {
    return DEFAULT_LOCALE;
  }
}

/** localizeHref for the current page's language. */
export async function localHref(href: string) {
  return localizeHref(href, await getLocale());
}

/** "/login?next=<this page>" in the current language, so sign-in brings the reader back to it. */
export async function loginRedirectPath(nextPath?: string) {
  const login = await localHref("/login");
  return nextPath ? `${login}?next=${encodeURIComponent(await localHref(nextPath))}` : login;
}

/** A location's name and opening hours in the page language (admin-edited hours shown as entered). */
export async function localLocation<L extends { id: string; name: string; hours: string }>(loc: L): Promise<L> {
  const locale = await getLocale();
  if (locale === "en") return loc;
  const d = dictionary(locale);
  const defaultHours = LOCATIONS.find((l) => l.id === loc.id)?.hours;
  return {
    ...loc,
    name: d.locationNames[loc.id] ?? loc.name,
    hours: loc.hours === defaultHours && d.locationHours[loc.id] ? d.locationHours[loc.id] : localDigits(loc.hours, locale),
  };
}

/** "Uttara Sectors 1–18" in the given language. */
export const serviceArea = (locale: Locale) =>
  locale === "bn" ? `উত্তরা সেক্টর ${localDigits(SERVICE_SECTORS, locale)}` : SERVICE_AREA;
