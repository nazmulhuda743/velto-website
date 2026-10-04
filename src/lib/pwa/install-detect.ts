"use client";

import { APP_INSTALLED_KEY, isInAppBrowser, isIOSDevice } from "./install-card";

/** Opened from the home screen (the installed app), on Android or iPhone. */
export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    document.documentElement.hasAttribute("data-app") ||
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: minimal-ui)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function deviceInfo() {
  const ua = navigator.userAgent;
  return { isIOS: isIOSDevice(ua, navigator.maxTouchPoints ?? 0), inApp: isInAppBrowser(ua), isAndroid: /Android/i.test(ua) };
}

/** This phone has opened or installed the app before (Android browser and app share this storage). */
export function installedOnThisPhone(): boolean {
  try {
    return Boolean(localStorage.getItem(APP_INSTALLED_KEY));
  } catch {
    return false;
  }
}

type RelatedApp = { platform: string; url?: string; id?: string };

/**
 * Chrome on Android (and desktop) can tell a website whether its own app is installed, through
 * the manifest's related_applications entry (app/manifest.ts). Elsewhere this is simply false.
 */
export async function chromeSaysInstalled(): Promise<boolean> {
  const nav = navigator as Navigator & { getInstalledRelatedApps?: () => Promise<RelatedApp[]> };
  if (typeof nav.getInstalledRelatedApps !== "function") return false;
  try {
    const apps = await nav.getInstalledRelatedApps();
    return apps.some((a) => a.platform === "webapp");
  } catch {
    return false;
  }
}

/** Every signal this browser can give that Velto is already on the phone. */
export async function knownInstalled(): Promise<boolean> {
  if (isStandalone() || installedOnThisPhone()) return true;
  return chromeSaysInstalled();
}
