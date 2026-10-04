/**
 * Customer-account surfaces that stay outside analytics: Google Tag Manager is
 * never started on them and first-party events from them are dropped. The
 * sign-in pages are included because their `?next=` URL can carry an order
 * page address. Runtime-neutral so the browser, /api/collect and the tests
 * share one definition.
 */
// The installed app's screens (/app/home, /app/orders, …) are as private as the account; /app itself
// (the install screen) is not.
const PRIVATE_PATH = /^\/(?:account|auth)(?:\/|$)|^\/app\/|^\/(?:login|signup|forgot-password|reset-password)\/?$/;

/** Language prefix ("/bn/account" is as private as "/account"). Kept local: this module is runtime-neutral. */
const LOCALE_PREFIX = /^\/(?:en|bn)(?=\/|$)/;

export function isPrivatePath(pathname: string): boolean {
  return PRIVATE_PATH.test(pathname.replace(LOCALE_PREFIX, "") || "/");
}

/** Order numbers in account URLs are not analytics data. */
export function redactPrivatePath(pathname: string): string {
  return pathname.replace(/^((?:\/(?:en|bn))?\/(?:account|app)\/orders\/)[^/]+/, "$1[order]");
}
