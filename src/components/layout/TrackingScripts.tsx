import { ConsentGatedTagManager } from "@/components/consent/ConsentGatedTagManager";
import { GoogleAdsTag } from "@/components/consent/GoogleAdsTag";
import { MetaPixel } from "@/components/consent/MetaPixel";
import { configuredGoogleAds } from "@/lib/google-ads/config";
import { configuredGtmId } from "@/lib/gtm";
import { configuredMetaPixelId } from "@/lib/meta-pixel/config";

/**
 * Browser tags, each behind the cookie consent:
 *
 * - Google Tag Manager (GA4 inside it), only when a syntactically valid container ID is configured
 *   AND the visitor has granted Analytics or Marketing consent. The GA4 tag must also require its
 *   Consent Mode signal (analytics_storage) — see docs/technical/COMMAND-CENTER.md.
 * - Meta Pixel, only when NEXT_PUBLIC_META_PIXEL_ID is set AND the visitor has granted Marketing
 *   consent. It is loaded here, not through GTM, so its event map is versioned with the site
 *   (src/lib/meta-pixel/events.ts). GTM must not contain a Meta Pixel tag as well.
 *
 * - Google Ads tag (gtag.js), only when the visitor has granted Marketing consent. It sends the two
 *   lead conversions (WhatsApp click, Booking submitted) mapped in src/lib/google-ads/events.ts and
 *   stores the ad click id. GTM must not contain Google Ads conversion tags as well.
 *
 * There is intentionally no <noscript> GTM iframe or Pixel image: both would load without any
 * consent decision.
 */
export function TrackingScripts() {
  const gtmId = configuredGtmId();
  const pixelId = configuredMetaPixelId();
  const googleAds = configuredGoogleAds();
  return (
    <>
      {gtmId ? <ConsentGatedTagManager gtmId={gtmId} /> : null}
      {pixelId ? <MetaPixel pixelId={pixelId} /> : null}
      {googleAds ? <GoogleAdsTag config={googleAds} /> : null}
    </>
  );
}
