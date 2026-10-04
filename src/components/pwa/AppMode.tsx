"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { markAppInstalledAction } from "@/lib/customer/app-actions";
import { appRedirectFor, splitAppPath } from "@/lib/pwa/install-card";
import { isStandalone } from "@/lib/pwa/install-detect";

const MARKED_KEY = "velto.app.marked";

/**
 * Inside the installed app only (APP_MODE_SCRIPT handles the first page before it paints):
 * - website pages reached by a link (the logo, "Back to the homepage"…) go to the account instead;
 * - once the customer is signed in, their account is marked as having the app, so the website
 *   never offers it to them again, on this phone or another one.
 * In a normal browser this does nothing.
 */
export function AppMode() {
  const pathname = usePathname();
  const router = useRouter();
  const marking = useRef(false);

  useEffect(() => {
    if (!isStandalone()) return;
    document.documentElement.setAttribute("data-app", "");
    const to = appRedirectFor(pathname);
    if (to) {
      router.replace(to);
      return;
    }
    if (!/^\/account(?:\/|$)/.test(splitAppPath(pathname).path) || marking.current) return;
    try {
      if (localStorage.getItem(MARKED_KEY)) return;
    } catch {
      /* storage unavailable: try anyway */
    }
    marking.current = true;
    markAppInstalledAction()
      .then((ok) => {
        if (!ok) return;
        try {
          localStorage.setItem(MARKED_KEY, "1");
        } catch {
          /* storage unavailable */
        }
      })
      .catch(() => {})
      .finally(() => {
        marking.current = false;
      });
  }, [pathname, router]);

  return null;
}
