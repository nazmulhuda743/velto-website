"use client";

import { useSyncExternalStore } from "react";

/**
 * Chrome (Android, desktop) fires `beforeinstallprompt` once, early, before the install popup is
 * on screen. INSTALL_PROMPT_SCRIPT (install-card.ts, inline in the root layout) keeps it on window;
 * this is the install popup's view of it. iPhone never fires it. Stand-in QA dispatches a synthetic event.
 */
export type InstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

/**
 * Caught before any bundle runs by INSTALL_PROMPT_SCRIPT (inline at the top of <body>): Chrome can
 * fire beforeinstallprompt during page load, before React hydrates, and it fires only once.
 */
declare global {
  interface Window {
    __veltoInstallPrompt?: InstallPromptEvent | null;
  }
}

const current = (): InstallPromptEvent | null => (typeof window === "undefined" ? null : (window.__veltoInstallPrompt ?? null));

/** The prompt, used once: after prompt() the browser won't fire it again this page load. */
export function takeInstallPrompt(): InstallPromptEvent | null {
  const p = current();
  window.__veltoInstallPrompt = null;
  window.dispatchEvent(new Event("velto:installprompt"));
  return p;
}

const subscribe = (l: () => void) => {
  window.addEventListener("velto:installprompt", l);
  return () => window.removeEventListener("velto:installprompt", l);
};

export function useHasInstallPrompt(): boolean {
  return useSyncExternalStore(subscribe, () => current() !== null, () => false);
}
