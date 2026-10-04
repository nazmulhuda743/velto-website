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

/**
 * Pages that are the marketing website. Inside the installed app they send the customer to their
 * account instead: the app is the customer's place, not a second copy of the website. Booking,
 * prices, tracking, sign-in, legal pages and the rebook/invoice links stay usable in the app.
 */
export const APP_WEBSITE_PATH = /^\/(?:$|services(?:\/|$)|how-it-works$|about$|locations(?:\/|$)|regular-laundry$)/;

/** "/bn/about" → { prefix: "/bn", path: "/about" }; "/" → { prefix: "", path: "/" }. */
export function splitAppPath(pathname: string): { prefix: string; path: string } {
  const m = /^\/bn(?=\/|$)/.exec(pathname);
  const path = m ? pathname.slice(3) || "/" : pathname || "/";
  return { prefix: m ? "/bn" : "", path };
}

/** Where the installed app should be instead of this page, or null to stay. */
export function appRedirectFor(pathname: string): string | null {
  const { prefix, path } = splitAppPath(pathname);
  return APP_WEBSITE_PATH.test(path) ? `${prefix}/account` : null;
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
 * Inline at the top of <body>, before anything paints. Inside the installed app (home-screen
 * launch) it marks <html data-app> so the website chrome (promo bar, menu, footer, sticky bars,
 * campaign popup) never shows and the app tab bar does, remembers on this phone that the app is
 * installed, and sends website pages (home, services, about…) to the account before they render.
 */
export const APP_MODE_SCRIPT =
  "(function(){try{var s=matchMedia('(display-mode: standalone)').matches||matchMedia('(display-mode: minimal-ui)').matches||navigator.standalone===true;if(!s)return;" +
  "document.documentElement.setAttribute('data-app','');" +
  `try{localStorage.setItem('${APP_INSTALLED_KEY}',String(Date.now()))}catch(e){}` +
  "var p=location.pathname,m=/^\\/bn(?=\\/|$)/.exec(p),q=m?p.slice(3)||'/':p||'/';" +
  `if(${APP_WEBSITE_PATH.toString()}.test(q))location.replace((m?'/bn':'')+'/account')` +
  "}catch(e){}})();";
