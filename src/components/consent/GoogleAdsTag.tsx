"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { CONSENT_CHANGE_EVENT, isStaffBrowser, readConsent } from "@/lib/analytics/client";
import { isPrivatePath } from "@/lib/analytics/private-paths";
import { isGoogleAdsLoaded, startGoogleAds } from "@/lib/google-ads/client";
import type { GoogleAdsConfig } from "@/lib/google-ads/events";
import { isMetaExcludedPath } from "@/lib/meta-pixel/events";

/**
 * Starts the Google Ads tag when the visitor allows Marketing: immediately on a return visit with
 * that consent saved, or the moment they choose it. Withdrawing Marketing updates Consent Mode
 * (src/lib/analytics/client.ts) and stops conversions (src/lib/google-ads/client.ts).
 *
 * Customer-account and sign-in pages never start it, nor do per-customer link pages (/r/, /i/,
 * /track, the same list as the Meta Pixel). Like GTM, a loaded tag can't be unloaded, so moving
 * onto a private page client-side reloads the document.
 */
export function GoogleAdsTag({ config }: { config: GoogleAdsConfig }) {
  const pathname = usePathname();

  useEffect(() => {
    if (isPrivatePath(pathname)) {
      if (isGoogleAdsLoaded()) window.location.reload();
      return;
    }
    const apply = () => {
      if (!readConsent()?.marketing || isStaffBrowser()) return;
      if (isMetaExcludedPath(window.location.pathname)) return;
      startGoogleAds(config);
    };
    apply();
    window.addEventListener(CONSENT_CHANGE_EVENT, apply);
    return () => window.removeEventListener(CONSENT_CHANGE_EVENT, apply);
  }, [config, pathname]);

  return null;
}
