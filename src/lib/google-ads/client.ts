/**
 * Browser runtime for the Google Ads tag (gtag.js). The only module that sends Google Ads conversions.
 *
 * - Loaded once, asynchronously, and only after the visitor allows Marketing (the consent gate is
 *   src/components/consent/GoogleAdsTag.tsx). Consent Mode is already the first data-layer entry
 *   (src/lib/analytics/client.ts), so the tag sees the real ad_storage state.
 * - gtag('config') also acts as the conversion linker: it stores the ad click id (gclid) in a
 *   first-party cookie so a later WhatsApp click or booking is credited to the ad.
 * - Events arrive only from track() in src/components/layout/Analytics.tsx, mapped by events.ts.
 *   Do not add Google Ads conversion tags inside GTM as well: they would count twice.
 */
import { readConsent } from "@/lib/analytics/client";
import { conversionSendTo, type GoogleAdsConfig } from "./events";

let config: GoogleAdsConfig | null = null;
let loaded = false;

function gtag(...args: unknown[]) {
  window.dataLayer ??= [];
  window.gtag ??= function gtag() {
    // eslint-disable-next-line prefer-rest-params
    window.dataLayer!.push(arguments);
  };
  window.gtag(...args);
}

/** Load gtag.js for the Google Ads ID. Safe to call repeatedly; it loads once per document. */
export function startGoogleAds(next: GoogleAdsConfig) {
  config = next;
  if (loaded) return;
  loaded = true;
  gtag("js", new Date());
  gtag("config", next.id);
  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(next.id)}`;
  document.head.appendChild(script);
}

export const isGoogleAdsLoaded = () => loaded;

/** Forward one site analytics event (from track()) to Google Ads when it is a conversion. */
export function sendGoogleAdsConversion(event: string) {
  if (typeof window === "undefined" || !loaded || !config) return;
  // Marketing withdrawn after load: Consent Mode already blocks cookies; send nothing at all.
  if (!readConsent()?.marketing) return;
  const sendTo = conversionSendTo(config, event);
  if (!sendTo) return;
  // beacon: WhatsApp buttons leave the page immediately, so the request must survive navigation.
  gtag("event", "conversion", { send_to: sendTo, transport_type: "beacon" });
}
