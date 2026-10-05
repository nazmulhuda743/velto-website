"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { appSafetyTarget } from "@/lib/pwa/install-card";
import { isStandalone } from "@/lib/pwa/install-detect";

/**
 * Safety net, inside the installed app only. The app is everything under /app/ (manifest scope); if
 * a website page is ever shown there (a client-side link, an old install), go to the app's own page
 * (appSafetyTarget). APP_MODE_SCRIPT does the same for full page loads before anything paints.
 * In a normal browser this does nothing.
 */
export function AppMode() {
  const pathname = usePathname();
  useEffect(() => {
    if (!isStandalone()) return;
    const to = appSafetyTarget(pathname);
    if (to) window.location.replace(to + window.location.search);
  }, [pathname]);
  return null;
}
