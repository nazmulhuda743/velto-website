"use client";

import { dictionary, type Dictionary } from "@/content/i18n";
import { useLocale } from "./LocaleProvider";

type Section = { [K in keyof Dictionary]: Dictionary[K] extends Record<string, unknown> ? K : never }[keyof Dictionary];
export type TextKey = { [S in Section]: `${S}.${Extract<keyof Dictionary[S], string>}` }[Section];

/** One dictionary string in the page language, for markup shared by server and client code. */
export function T({ k }: { k: TextKey }) {
  const [section, key] = k.split(".") as [Section, string];
  const value = (dictionary(useLocale())[section] as Record<string, unknown>)[key];
  return <>{typeof value === "string" ? value : k}</>;
}
