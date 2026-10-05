import "server-only";
import { localHref, loginRedirectPath } from "@/lib/i18n/server";
import type { AppBase } from "./app-routes";

/**
 * Sign-in for a surface, coming back to `next`: the website's /login, or the app's own /app/login
 * (app URLs are never language-prefixed: the language comes from the cookie).
 */
export async function signInFor(base: AppBase, next: string): Promise<string> {
  if (base === "/app") return `/app/login?next=${encodeURIComponent(next)}`;
  return loginRedirectPath(next);
}

/** A localized link for the surface: app links stay unprefixed. */
export async function hrefFor(base: AppBase, href: string): Promise<string> {
  return base === "/app" ? href : localHref(href);
}
