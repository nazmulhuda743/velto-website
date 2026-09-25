"use client";

import NextLink from "next/link";
import type { ComponentProps } from "react";
import { localizeHref } from "@/lib/i18n/config";
import { useLocale } from "./LocaleProvider";

/**
 * next/link that keeps the reader in their language: on a Bangla page "/pricing"
 * becomes "/bn/pricing". Drop-in replacement for public-site links.
 */
export default function Link({ href, ...props }: ComponentProps<typeof NextLink>) {
  const locale = useLocale();
  return <NextLink href={typeof href === "string" ? localizeHref(href, locale) : href} {...props} />;
}
