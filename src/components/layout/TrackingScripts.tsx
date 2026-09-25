import { ConsentGatedTagManager } from "@/components/consent/ConsentGatedTagManager";
import { configuredGtmId } from "@/lib/gtm";

/**
 * Google Tag Manager, only when a syntactically valid container ID is
 * configured AND the visitor has granted Analytics or Marketing consent.
 * GA4 and Meta Pixel are managed inside GTM so the website has one browser
 * tag entry point; each tag must also require its Consent Mode signal
 * (analytics_storage / ad_storage) — see docs/technical/COMMAND-CENTER.md.
 *
 * There is intentionally no <noscript> GTM iframe: it would load tags
 * without any consent decision.
 */
export function TrackingScripts() {
  const gtmId = configuredGtmId();
  if (!gtmId) return null;
  return <ConsentGatedTagManager gtmId={gtmId} />;
}
