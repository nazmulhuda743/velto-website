import { googleAdsConfig } from "./events";

/** The configured Google Ads tag (ID + conversion labels), or null when switched off. Public by design. */
export function configuredGoogleAds() {
  return googleAdsConfig({
    id: process.env.NEXT_PUBLIC_GOOGLE_ADS_ID,
    whatsappLabel: process.env.NEXT_PUBLIC_GOOGLE_ADS_WHATSAPP_LABEL,
    bookingLabel: process.env.NEXT_PUBLIC_GOOGLE_ADS_BOOKING_LABEL,
  });
}
