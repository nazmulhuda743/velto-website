/**
 * When the "Install Velto" popup shows and which version (pure; tests in
 * tests/command-center/install-card.test.cjs).
 * - "android": the browser offered its one-tap install prompt (beforeinstallprompt), so the popup has a button.
 * - "ios": an iPhone or iPad in Safari, which has no prompt: the popup shows the Share → Add to Home Screen steps.
 * - "hidden": already installed (standalone), dismissed in the last 14 days, or a browser that can't install.
 */

/** "Not now" holds for 14 days, like the notification card's snooze. */
export const INSTALL_DISMISS_MS = 14 * 24 * 60 * 60 * 1000;
export const INSTALL_DISMISSED_KEY = "velto.install.dismissed";

export type InstallCardState = "hidden" | "android" | "ios";

export function installCardState(input: { standalone: boolean; isIOS: boolean; hasPrompt: boolean; dismissedAt: number | null; now: number }): InstallCardState {
  if (input.standalone) return "hidden";
  if (input.dismissedAt !== null && Number.isFinite(input.dismissedAt) && input.now - input.dismissedAt < INSTALL_DISMISS_MS) return "hidden";
  if (input.hasPrompt) return "android";
  if (input.isIOS) return "ios";
  return "hidden";
}

/** iPhone and iPad (iPadOS Safari reports itself as a Mac, but with touch). */
export function isIOSDevice(userAgent: string, maxTouchPoints: number): boolean {
  return /iPhone|iPad|iPod/.test(userAgent) || (/Macintosh/.test(userAgent) && maxTouchPoints > 1);
}

/** The stored dismissal, or null when absent or unreadable. */
export function parseDismissedAt(raw: string | null | undefined): number | null {
  const n = Number(raw);
  return raw && Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * Inline at the top of <body> (root layout), before any bundle: Chrome can fire beforeinstallprompt
 * during page load, before React hydrates, and only once. Static, no data. Read by install-prompt.ts.
 */
export const INSTALL_PROMPT_SCRIPT =
  "addEventListener('beforeinstallprompt',function(e){e.preventDefault();window.__veltoInstallPrompt=e;dispatchEvent(new Event('velto:installprompt'))});" +
  "addEventListener('appinstalled',function(){window.__veltoInstallPrompt=null;dispatchEvent(new Event('velto:installprompt'))});";
