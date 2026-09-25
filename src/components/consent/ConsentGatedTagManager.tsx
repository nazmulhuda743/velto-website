"use client";

import { useEffect } from "react";
import { CONSENT_CHANGE_EVENT, readConsent } from "@/lib/analytics/client";

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
 */
export function ConsentGatedTagManager({ gtmId }: { gtmId: string }) {
  useEffect(() => {
    const maybeLoad = () => {
      const consent = readConsent();
      if (consent && (consent.analytics || consent.marketing)) loadGtm(gtmId);
    };
    maybeLoad();
    window.addEventListener(CONSENT_CHANGE_EVENT, maybeLoad);
    return () => window.removeEventListener(CONSENT_CHANGE_EVENT, maybeLoad);
  }, [gtmId]);
  return null;
}
