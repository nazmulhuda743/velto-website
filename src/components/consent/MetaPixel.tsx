"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { CONSENT_CHANGE_EVENT, readConsent } from "@/lib/analytics/client";
import { isPrivatePath } from "@/lib/analytics/private-paths";
import { isMetaPixelLoaded, startMetaPixel, stopMetaPixel } from "@/lib/meta-pixel/client";
import { isMetaExcludedPath } from "@/lib/meta-pixel/events";

/**
 * Starts the Meta Pixel when the visitor allows Marketing: immediately on a return visit with that
 * consent saved, or the moment they choose it. Withdrawing Marketing stops all sending.
 *
 * Customer-account and sign-in pages never start it. Like ConsentGatedTagManager, a loaded Pixel
 * can't be unloaded, so moving onto one of those pages client-side reloads the document.
 */
export function MetaPixel({ pixelId }: { pixelId: string }) {
  const pathname = usePathname();

  useEffect(() => {
    if (isPrivatePath(pathname)) {
      if (isMetaPixelLoaded()) window.location.reload();
      return;
    }
    const apply = () => {
      // Per-customer link pages (/r/, /i/, /track) don't start it either; it starts on the next page.
      if (!readConsent()?.marketing) stopMetaPixel();
      else if (!isMetaExcludedPath(window.location.pathname)) startMetaPixel(pixelId);
    };
    apply();
    window.addEventListener(CONSENT_CHANGE_EVENT, apply);
    return () => window.removeEventListener(CONSENT_CHANGE_EVENT, apply);
  }, [pixelId, pathname]);

  return null;
}
