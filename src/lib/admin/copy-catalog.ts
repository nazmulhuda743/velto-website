import "server-only";

import { accountBn } from "@/content/i18n/account/bn";
import { accountEn } from "@/content/i18n/account/en";
import { bn } from "@/content/i18n/bn";
import { en } from "@/content/i18n/en";
import { formsBn } from "@/content/i18n/forms/bn";
import { formsEn } from "@/content/i18n/forms/en";
import { pagesBn } from "@/content/i18n/pages/bn";
import { pagesEn } from "@/content/i18n/pages/en";
import { SERVICE_PAGES_BN } from "@/content/i18n/services.bn";
import { SERVICE_PAGES } from "@/content/services";
import { collectStrings, type CopyNamespace } from "@/lib/i18n/copy-overrides";

/**
 * Everything the Text & copy page can edit: the built-in text of each namespace, per language,
 * as written in the source files (the originals a Reset returns to).
 */

export const COPY_AREAS: { ns: CopyNamespace; title: string; hint: string }[] = [
  { ns: "site", title: "Header, footer & homepage", hint: "Menu, buttons, footer, cookie banner and every homepage section." },
  { ns: "pages", title: "Other pages", hint: "About, How It Works, Pricing, Locations, Regular Laundry, FAQ and legal text." },
  { ns: "services", title: "Service pages", hint: "Dry Cleaning, Wash & Iron, Ironing, Curtains, Carpets, Blankets and Express." },
  { ns: "forms", title: "Booking & forms", hint: "Book a Pickup, Request a Quote and Track an Order, including messages." },
  { ns: "account", title: "Customer account", hint: "Sign-in, sign-up and the customer dashboard." },
];

const BASES: Record<CopyNamespace, { en: unknown; bn: unknown }> = {
  site: { en, bn },
  pages: { en: pagesEn, bn: pagesBn },
  forms: { en: formsEn, bn: formsBn },
  account: { en: accountEn, bn: accountBn },
  services: { en: SERVICE_PAGES, bn: SERVICE_PAGES_BN },
};

export const copyBase = (ns: CopyNamespace, lang: "en" | "bn") => BASES[ns][lang];

export type CopyEntry = { path: string; key: string; group: string; label: string; original: string };

const human = (s: string) =>
  s
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[-_]/g, " ")
    .replace(/^./, (c) => c.toUpperCase());

/** Every editable string in an area, grouped by its first key (a service slug for service pages). */
export function copyEntries(ns: CopyNamespace, lang: "en" | "bn"): CopyEntry[] {
  const base = copyBase(ns, lang);
  const slugs = ns === "services" ? (base as { slug: string }[]).map((s) => s.slug) : [];
  return collectStrings(base).map(({ path, text }) => {
    const parts = path.split(".");
    const group = ns === "services" ? slugs[Number(parts[0])] ?? parts[0] : parts[0];
    const rest = ns === "services" ? parts.slice(1) : parts.slice(1);
    return {
      path,
      key: `${ns}.${path}`,
      group,
      label: rest.map((p) => (/^\d+$/.test(p) ? `#${Number(p) + 1}` : human(p))).join(" › ") || human(group),
      original: text,
    };
  });
}

export const groupLabel = (group: string) => human(group);
