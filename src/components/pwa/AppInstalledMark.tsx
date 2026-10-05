"use client";

import { useEffect } from "react";
import { markAppInstalledAction } from "@/lib/customer/app-actions";
import { isStandalone } from "@/lib/pwa/install-detect";

const MARKED_KEY = "velto.app.marked";

/**
 * Inside the installed app, once signed in: the account is marked as having the app, so the website
 * never offers it again, on this phone or another. Once per phone. Mounted only by the app shell.
 */
export function AppInstalledMark() {
  useEffect(() => {
    if (!isStandalone()) return;
    try {
      if (localStorage.getItem(MARKED_KEY)) return;
    } catch {
      /* storage unavailable: try anyway */
    }
    markAppInstalledAction()
      .then((ok) => {
        if (!ok) return;
        try {
          localStorage.setItem(MARKED_KEY, "1");
        } catch {
          /* storage unavailable */
        }
      })
      .catch(() => {});
  }, []);
  return null;
}
