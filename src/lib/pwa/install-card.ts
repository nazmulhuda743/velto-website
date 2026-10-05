/**
 * When the "Install Velto" popup shows and which version (pure; tests in
 * tests/command-center/install-card.test.cjs).
 * - "android": the browser offered its one-tap install prompt (beforeinstallprompt), so the popup is one button.
 * - "ios": iPhone or iPad Safari. Apple gives websites no install button, so the popup points at Share.
 * - "hidden": everything else. Already installed (inside the app, this phone has opened the app, or the
 *   customer's account has), dismissed in the last 14 days, an in-app browser (Facebook, Instagram,
 *   WhatsApp, Messenger: nothing can be installed from there), or a browser with no install prompt.
 *   No popup ever shows menu instructions on Android: either it is one tap or it doesn't show.
 */

/** "Not now" holds for 14 days, like the notification card's snooze. */
export const INSTALL_DISMISS_MS = 14 * 24 * 60 * 60 * 1000;
export const INSTALL_DISMISSED_KEY = "velto.install.dismissed";
/** Set on this phone once the app is installed (appinstalled) or opened from the home screen. */
export const APP_INSTALLED_KEY = "velto.app.installed";

export type InstallCardState = "hidden" | "android" | "ios";

export type InstallInput = {
  standalone: boolean;
  isIOS: boolean;
  hasPrompt: boolean;
  dismissedAt: number | null;
  now: number;
  /** In-app browser (Facebook, Instagram, WhatsApp, Messenger…): installing is impossible there. */
  inApp?: boolean;
  /** Known installed: this phone opened the app, Chrome reports it installed, or the account has. */
  installed?: boolean;
};

export function installCardState(input: InstallInput): InstallCardState {
  if (input.standalone || input.installed || input.inApp) return "hidden";
  if (input.dismissedAt !== null && Number.isFinite(input.dismissedAt) && input.now - input.dismissedAt < INSTALL_DISMISS_MS) return "hidden";
  if (input.hasPrompt) return "android";
  if (input.isIOS) return "ios";
  return "hidden";
}

/** iPhone and iPad (iPadOS Safari reports itself as a Mac, but with touch). */
export function isIOSDevice(userAgent: string, maxTouchPoints: number): boolean {
  return /iPhone|iPad|iPod/.test(userAgent) || (/Macintosh/.test(userAgent) && maxTouchPoints > 1);
}

/** Browsers inside other apps, where "Add to Home Screen" / "Install app" does not exist. */
export function isInAppBrowser(userAgent: string): boolean {
  return /FBAN|FBAV|FB_IAB|FBIOS|Instagram|Messenger|WhatsApp|Line\/|MicroMessenger|Snapchat|TikTok|musical_ly|; wv\)/i.test(userAgent);
}

/** The stored dismissal, or null when absent or unreadable. */
export function parseDismissedAt(raw: string | null | undefined): number | null {
  const n = Number(raw);
  return raw && Number.isFinite(n) && n > 0 ? n : null;
}

/** Website pages the installed app may open as they are: legal text, sign-in links from email, rebook and invoice links. */
const APP_KEEP = /^\/(?:terms|privacy|cookies|offline)$|^\/(?:auth|r|i|go|api)(?:\/|$)/;

/**
 * The installed app is everything under /app/ (manifest scope). If it ever shows a website page
 * (an old install whose start was /account, a push or email link, a phone that ignores the scope),
 * this says where to go instead: the account's pages map to the app's own, anything else to Home;
 * null to stay. Pure (tests in tests/command-center/install-card.test.cjs).
 */
export function appSafetyTarget(pathname: string): string | null {
  const path = (/^\/(?:bn|en)(?=\/|$)/.test(pathname) ? pathname.slice(3) : pathname) || "/";
  if (/^\/app(?:\/|$)/.test(path) || APP_KEEP.test(path)) return null;
  const order = /^\/account\/orders\/([^/]+)\/?$/.exec(path);
  if (order) return `/app/orders/${order[1]}`;
  if (/^\/account\/orders\/?$/.test(path)) return "/app/orders";
  if (/^\/account\/(profile|rewards)\/?$/.test(path)) return `/app/${/^\/account\/(profile|rewards)/.exec(path)![1]}`;
  if (/^\/book\/?$/.test(path)) return "/app/book";
  if (/^\/pricing\/?$/.test(path)) return "/app/prices";
  if (/^\/(?:login|signup)\/?$/.test(path)) return "/app/login";
  return "/app/home";
}

/**
 * Inline at the top of <body> (root layout), before any bundle: Chrome can fire beforeinstallprompt
 * during page load, before React hydrates, and only once. Static, no data. Read by install-prompt.ts.
 * It also remembers on this phone that the app got installed.
 */
export const INSTALL_PROMPT_SCRIPT =
  "addEventListener('beforeinstallprompt',function(e){e.preventDefault();window.__veltoInstallPrompt=e;dispatchEvent(new Event('velto:installprompt'))});" +
  `addEventListener('appinstalled',function(){window.__veltoInstallPrompt=null;try{localStorage.setItem('${APP_INSTALLED_KEY}',String(Date.now()))}catch(e){}dispatchEvent(new Event('velto:installprompt'))});`;

/**
 * appSafetyTarget as plain browser JavaScript, for APP_MODE_SCRIPT (it runs before any bundle).
 * Kept by hand in step with appSafetyTarget; a test runs both over the same paths.
 */
export const APP_SAFETY_JS =
  "function(p){var q=/^\\/(?:bn|en)(?=\\/|$)/.test(p)?p.slice(3):p;q=q||'/';" +
  "if(/^\\/app(?:\\/|$)/.test(q)||/^\\/(?:terms|privacy|cookies|offline)$|^\\/(?:auth|r|i|go|api)(?:\\/|$)/.test(q))return null;" +
  "var m=/^\\/account\\/orders\\/([^/]+)\\/?$/.exec(q);if(m)return '/app/orders/'+m[1];" +
  "if(/^\\/account\\/orders\\/?$/.test(q))return '/app/orders';" +
  "m=/^\\/account\\/(profile|rewards)\\/?$/.exec(q);if(m)return '/app/'+m[1];" +
  "if(/^\\/book\\/?$/.test(q))return '/app/book';" +
  "if(/^\\/pricing\\/?$/.test(q))return '/app/prices';" +
  "if(/^\\/(?:login|signup)\\/?$/.test(q))return '/app/login';" +
  "return '/app/home'}";

/**
 * Inline at the top of <body>, before anything paints. Inside the installed app only: remembers on
 * this phone that the app is installed and, on a website page, goes to the app's own page instead
 * (appSafetyTarget, inlined) before the website renders. In a browser it does nothing.
 */
export const APP_MODE_SCRIPT =
  "(function(){try{var s=matchMedia('(display-mode: standalone)').matches||matchMedia('(display-mode: minimal-ui)').matches||navigator.standalone===true;if(!s)return;" +
  `try{localStorage.setItem('${APP_INSTALLED_KEY}',String(Date.now()))}catch(e){}` +
  "var t=(" + APP_SAFETY_JS + ")(location.pathname);if(t)location.replace(t+location.search)" +
  "}catch(e){}})();";
