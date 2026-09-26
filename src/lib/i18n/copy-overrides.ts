/**
 * Website text edited in the admin panel (Text & copy), layered over the built-in copy.
 *
 * Every text module (dictionary, pageText, formText, accountText, servicePages) passes its
 * built-in object through withOverrides(namespace, locale, base). Overrides are plain
 * "namespace.path.to.string" → text maps per language, stored in website_content ("copy").
 *
 * The store is module-level. Server Components refresh it from the database before any text is
 * read (lib/i18n/server getLocale). Client Components run in a separate module instance (server
 * rendering and the browser), which LocaleProvider seeds per language from the same values, so
 * server and browser render the same words. Pure: no imports.
 */

export type CopyNamespace = "site" | "pages" | "forms" | "account" | "services";
export type CopyMap = Record<string, string>;
export type CopyOverrides = { en: CopyMap; bn: CopyMap };

let store: CopyOverrides = { en: {}, bn: {} };
let storeKey = "";
const memo = new Map<string, unknown>();

/** Replace the active overrides (no-op when unchanged). */
export function setCopyOverrides(next: Partial<CopyOverrides> | null | undefined) {
  const clean: CopyOverrides = { en: { ...(next?.en ?? {}) }, bn: { ...(next?.bn ?? {}) } };
  const key = JSON.stringify(clean);
  if (key === storeKey) return;
  store = clean;
  storeKey = key;
  memo.clear();
}

export const getCopyOverrides = () => store;

/** Replace one language's overrides and keep the other's (Client Components' copy of the store). */
export function setCopyLocale(locale: "en" | "bn", map: CopyMap | undefined) {
  setCopyOverrides({ ...store, [locale]: map ?? {} });
}

/** Keys that are links, ids or data, never shown as words: not editable. */
const NOT_TEXT = new Set(["href", "slug", "id", "src", "url", "event", "placement", "key", "icon", "width", "height", "position", "service", "image", "ogLocale", "sourceUrl", "platform"]);
export const isEditableValue = (key: string, value: unknown) =>
  typeof value === "string" && !NOT_TEXT.has(key) && !/^(\/|https?:\/\/|#)/.test(value) && value.trim().length > 0;

/**
 * Branches not edited here: price-list item names (must match Velto Ops), a customer's own review
 * (Reviews page, never reworded), image slots (Images page) and search titles (SEO page).
 */
const DATA_BRANCHES = new Set(["names", "review", "image", "seo", "meta"]);

/** Every editable string in a text object, as "path → text" (arrays by index). */
export function collectStrings(base: unknown, prefix = ""): { path: string; text: string }[] {
  if (Array.isArray(base)) return base.flatMap((v, i) => (typeof v === "string" ? (isEditableValue(String(i), v) ? [{ path: `${prefix}${i}`, text: v }] : []) : collectStrings(v, `${prefix}${i}.`)));
  if (!base || typeof base !== "object") return [];
  if ("alt" in base && "width" in base) return [];
  return Object.entries(base as Record<string, unknown>).flatMap(([k, v]) =>
    DATA_BRANCHES.has(k) ? [] : typeof v === "string" ? (isEditableValue(k, v) ? [{ path: `${prefix}${k}`, text: v }] : []) : collectStrings(v, `${prefix}${k}.`),
  );
}

/** True when a path is one collectStrings would offer (the server re-checks every save). */
export function isEditablePath(base: unknown, path: string) {
  return collectStrings(base).some((s) => s.path === path);
}

/** "{name}" placeholders in a text, sorted, so an edit can't drop or invent one. */
export const placeholders = (text: string) => [...new Set(text.match(/\{[a-zA-Z]+\}/g) ?? [])].sort();

/** Why an edited text can't be used, or null when it can. */
export function copyProblem(original: string, edited: string): string | null {
  const text = edited.trim();
  if (!text) return "The text can't be empty. Use Reset to go back to the original.";
  if (text.length > 4000) return "Keep it under 4,000 characters.";
  if (/<\s*\/?\s*(script|iframe|style|object|embed)\b/i.test(text)) return "HTML tags aren't allowed.";
  const need = placeholders(original);
  const have = placeholders(text);
  if (need.join() !== have.join()) {
    return need.length
      ? `Keep the placeholders exactly as they are: ${need.join(" ")}. They are filled in automatically.`
      : `Remove ${have.join(" ")}: this text has no automatic values.`;
  }
  return null;
}

function setPath(target: unknown, path: string[], value: string) {
  let node = target as Record<string, unknown>;
  for (let i = 0; i < path.length - 1; i++) {
    const next = node?.[path[i]];
    if (!next || typeof next !== "object") return;
    node = next as Record<string, unknown>;
  }
  const last = path[path.length - 1];
  if (node && typeof node[last] === "string") node[last] = value;
}

function clone<T>(value: T): T {
  if (Array.isArray(value)) return value.map(clone) as T;
  if (value && typeof value === "object") {
    // Only plain objects are copied; anything else (functions, class instances) is shared as-is.
    if (Object.getPrototypeOf(value) !== Object.prototype) return value;
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, clone(v)])) as T;
  }
  return value;
}

/** The base text object with this language's overrides for the namespace applied (memoised). */
export function withOverrides<T>(ns: CopyNamespace, locale: "en" | "bn", base: T, display?: (text: string) => string): T {
  const map = store[locale];
  const prefix = `${ns}.`;
  const keys = Object.keys(map).filter((k) => k.startsWith(prefix));
  if (!keys.length) return base;
  const memoKey = `${ns}:${locale}`;
  const hit = memo.get(memoKey) as { base: T; out: T } | undefined;
  if (hit && hit.base === base) return hit.out;
  const out = clone(base);
  for (const k of keys) setPath(out, k.slice(prefix.length).split("."), display ? display(map[k]) : map[k]);
  memo.set(memoKey, { base, out });
  return out;
}
