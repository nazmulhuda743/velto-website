"use client";

import { useEffect } from "react";
import { track } from "@/components/layout/Analytics";

/**
 * Registers the service worker (installable app + offline page) after the page has loaded, in
 * production only. Nothing on screen changes: installing uses the browser's own "Install app" /
 * "Add to Home Screen". NEXT_PUBLIC_PWA_ENABLED=false removes any installed worker and its caches.
 *
 * An app opened from the home screen sends one app_launch event per session, through the same
 * consent-gated analytics as every other event.
 */
export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;

    if (process.env.NEXT_PUBLIC_PWA_ENABLED === "false") {
      navigator.serviceWorker.getRegistrations().then((regs) => regs.forEach((r) => r.unregister())).catch(() => {});
      if ("caches" in window) caches.keys().then((keys) => keys.filter((k) => k.startsWith("velto-")).forEach((k) => caches.delete(k))).catch(() => {});
      return;
    }

    const register = () => navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => {});
    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });

    try {
      const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
      if (standalone && !sessionStorage.getItem("velto_app_launch")) {
        sessionStorage.setItem("velto_app_launch", "1");
        track("app_launch", { placement: "home_screen" });
      }
    } catch {
      /* storage unavailable: measurement is best-effort */
    }
    return () => window.removeEventListener("load", register);
  }, []);

  return null;
}
