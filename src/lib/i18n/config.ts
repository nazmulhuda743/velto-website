/**
 * Website languages. English lives at the existing URLs (/pricing); Bangla at
 * /bn/pricing. Internally every public page renders under app/[lang], and the
 * proxy rewrites unprefixed English URLs to /en/... so English URLs never change.
 *
 * Runtime-neutral: used by the proxy, server and client components and tests.
 */
export const LOCALES = ["en", "bn"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";

export const isLocale = (value: unknown): value is Locale =>
  typeof value === "string" && (LOCALES as readonly string[]).includes(value);

/** Set by the proxy on every public page request (read where root params aren't available). */
export const LOCALE_HEADER = "x-velto-locale";

/** Remembers an explicit choice from the language switcher (not personal data). */
export const LANG_COOKIE = "velto_lang";

/**
 * Bangla stays off (no /bn pages, no switcher, no hreflang) until every public page
 * is translated and the copy is approved. NEXT_PUBLIC_ so the browser switcher agrees.
 */
export const banglaEnabled = () => process.env.NEXT_PUBLIC_BANGLA_ENABLED === "true";

/** Paths that exist in one language only (APIs, admin, redirects, files). */
const UNLOCALIZED = /^\/(?:api|admin|go|auth|_next)(?:\/|$)|^\/[^?#]*\.[a-z0-9]{2,5}(?:[?#]|$)/i;

/** Split "/bn/pricing?x=1" into its locale and the English-shaped path "/pricing?x=1". */
export function splitLocale(path: string): { locale: Locale; path: string } {
  const m = /^\/(en|bn)(?=\/|\?|#|$)(.*)$/.exec(path);
  if (!m) return { locale: DEFAULT_LOCALE, path };
  const rest = m[2] || "/";
  return { locale: m[1] as Locale, path: rest.startsWith("/") ? rest : `/${rest}` };
}

/** The pathname without any language prefix: "/bn/account/orders" → "/account/orders". */
export const pathWithoutLocale = (pathname: string) => splitLocale(pathname).path;

/**
 * An internal link in the given language: "/pricing" → "/bn/pricing" for Bangla,
 * unchanged for English. External links, hashes and one-language paths pass through.
 */
export function localizeHref(href: string, locale: Locale): string {
  if (!href.startsWith("/") || href.startsWith("//") || UNLOCALIZED.test(href)) return href;
  const { path } = splitLocale(href);
  if (locale === DEFAULT_LOCALE) return path;
  return path === "/" ? "/bn" : /^\/[?#]/.test(path) ? `/bn${path.slice(1)}` : `/bn${path}`;
}

const BN_DIGITS = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"];

/** Western digits → Bangla digits ("৳499" → "৳৪৯৯"). Phones and order numbers should not use this. */
export const toBanglaDigits = (value: string | number) => String(value).replace(/[0-9]/g, (d) => BN_DIGITS[Number(d)]);

/** Numbers as shown to the reader of this language. */
export const localDigits = (value: string | number, locale: Locale) =>
  locale === "bn" ? toBanglaDigits(value) : String(value);

/** "{rating} on Google" + { rating: "5.0" } → "5.0 on Google"; Bangla digits on Bangla pages. */
export function fill(template: string, vars: Record<string, string | number>, locale: Locale): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => (key in vars ? localDigits(vars[key], locale) : match));
}
