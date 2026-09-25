"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { CONSENT_CHANGE_EVENT, readConsent } from "@/lib/analytics/client";
import { isPrivatePath } from "@/lib/analytics/private-paths";

let loaded = false;

function loadGtm(gtmId: string) {
  if (loaded) return;
  loaded = true;
  // The Consent Mode default is already the first data-layer entry (lib/analytics/client).
  window.dataLayer?.push({ "gtm.start": Date.now(), event: "gtm.js" });
  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtm.js?id=${encodeURIComponent(gtmId)}`;
  document.head.appendChild(script);
}

/**
 * Loads GTM after the visitor allows Analytics or Marketing — immediately on
 * a return visit with saved consent, or the moment they choose. Consent Mode
 * state is the first data-layer entry, so tags inside the container see the
 * real per-category state.
 *
 * Customer-account and sign-in pages never start GTM. A loaded container can't
 * be unloaded, so moving onto one of those pages client-side from a public page
 * where GTM is running reloads the document: order pages opened from the
 * account area then never share a page with GTM.
 */
export function ConsentGatedTagManager({ gtmId }: { gtmId: string }) {
  const pathname = usePathname();

  useEffect(() => {
    if (isPrivatePath(pathname)) {
      if (loaded) window.location.reload();
      return;
    }
    const maybeLoad = () => {
      const consent = readConsent();
      if (consent && (consent.analytics || consent.marketing) && !isPrivatePath(window.location.pathname)) loadGtm(gtmId);
    };
    maybeLoad();
    window.addEventListener(CONSENT_CHANGE_EVENT, maybeLoad);
    return () => window.removeEventListener(CONSENT_CHANGE_EVENT, maybeLoad);
  }, [gtmId, pathname]);
  return null;
}
