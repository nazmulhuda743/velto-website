"use client";

import { useEffect } from "react";
import { track } from "@/components/layout/Analytics";
import { markAppOpen } from "@/lib/analytics/app-open";

/** Back on screen after this long counts as a new open (a quick app switch does not). */
const AWAY_MS = 5 * 60_000;
/** One open per load, even when the effect runs twice (React dev mode, a remount). */
let lastOpenAt = 0;

/**
 * app_open for the app report (docs/technical/APP-METRICS.md): when the app shell loads and when
 * it comes back to the screen after a while. `placement` says installed or browser; `detail` is
 * the Home state when the customer is on Home (in_progress, pending, regular, lapsed, first),
 * read from Home's marker, so lapsed customers who open the app can be counted.
 */
export function AppOpenTracker() {
  useEffect(() => {
    const standalone = (() => {
      try {
        return window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
      } catch {
        return false;
      }
    })();
    const open = () => {
      if (Date.now() - lastOpenAt < 2_000) return;
      lastOpenAt = Date.now();
      const state = document.querySelector<HTMLElement>("[data-app-home-state]")?.dataset.appHomeState;
      markAppOpen();
      track("app_open", { placement: standalone ? "installed" : "browser", detail: state ?? "elsewhere" });
    };
    open();
    let hiddenAt = 0;
    const onVisibility = () => {
      if (document.visibilityState === "hidden") hiddenAt = Date.now();
      else if (hiddenAt && Date.now() - hiddenAt >= AWAY_MS) open();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);
  return null;
}
