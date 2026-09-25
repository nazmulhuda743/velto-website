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

/**
 * Pages whose Bangla version is fully translated (English paths). Only these get
 * hreflang, a self-canonical /bn URL and a Bangla sitemap entry; any other /bn page
 * still works but canonicalises to its English page until its phase ships.
 */
export const BANGLA_READY_PATHS: readonly string[] = [
  "/",
  // Phase 2: services, pricing, how it works, regular laundry, locations, about.
  "/services",
  "/services/dry-cleaning",
  "/services/wash-and-iron",
  "/services/ironing",
  "/services/curtain-cleaning",
  "/services/carpet-cleaning",
  "/services/blanket-comforter-cleaning",
  "/services/express",
  "/pricing",
  "/how-it-works",
  "/regular-laundry",
  "/locations",
  "/locations/sector-11",
  "/locations/sector-18",
  "/about",
];
export const banglaIndexable = (path: string) => banglaEnabled() && BANGLA_READY_PATHS.includes(path);

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

/**
 * "Remove {item}" + { item: "Shirt" } → "Remove Shirt", values inserted as they are. For
 * values that must keep their digits (phone and order numbers, references, typed text).
 */
export const format = (template: string, vars: Record<string, string | number>) =>
  template.replace(/\{(\w+)\}/g, (match, key: string) => (key in vars ? String(vars[key]) : match));

/** "{rating} on Google" + { rating: "5.0" } → "5.0 on Google"; Bangla digits on Bangla pages. */
export function fill(template: string, vars: Record<string, string | number>, locale: Locale): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => (key in vars ? localDigits(vars[key], locale) : match));
}

/**
 * Bangla attaches case endings to a word with a hyphen ("সেক্টর ১১-এ", "Velto-র"). Browsers may
 * break a line after the hyphen and strand the ending on the next line, so a word joiner (U+2060,
 * invisible) is added after every hyphen that runs into a Bangla letter. Applied to Bangla copy
 * where it is served; search titles and descriptions (keys in `skip`) are left as written.
 */
export function keepBanglaSuffixes<T>(value: T, skip: readonly string[] = ["seo", "meta"]): T {
  if (typeof value === "string") return value.replace(/-(?=[\u0980-\u09FF])/g, "-\u2060") as T;
  if (Array.isArray(value)) return value.map((v) => keepBanglaSuffixes(v, skip)) as T;
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, skip.includes(k) ? v : keepBanglaSuffixes(v, skip)]),
    ) as T;
  }
  return value;
}
