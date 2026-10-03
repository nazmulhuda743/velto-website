export const ANALYTICS_EVENTS = [
  "book_pickup_click",
  "booking_start",
  // Quick booking: the customer opened "Add items and see prices".
  "booking_items_open",
  "booking_addon_add",
  // A valid phone number typed into the booking or quote form (once per form).
  "phone_entered",
  // Abandoned booking recovery: the saved draft continued, "Get a call back" opened and sent.
  "booking_draft_restore",
  "callback_open",
  "callback_request",
  "booking_success",
  "booking_error",
  "whatsapp_click",
  "phone_click",
  "pricing_view",
  "quote_start",
  "quote_success",
  "regular_laundry_interest",
  "regular_laundry_submit",
  "directions_click",
  // Spec §23 events missing from the original foundation list; the union is
  // kept exhaustive by tests/analytics.type-test.ts.
  "pricing_search",
  "google_reviews_click",
  // Footer social profile links (Facebook, Instagram, LinkedIn); placement names the network.
  "social_click",
  "service_view",
  // Command Center additions: first-party page/funnel measurement, the order
  // tracking entry point and anonymous consent-banner outcomes.
  "page_view",
  "track_order_open",
  "cookie_banner_view",
  "consent_accept_all",
  "consent_reject_nonessential",
  "consent_preferences_saved",
  // Installed app (PWA): opened from the home screen, once per session.
  "app_launch",
  // Booking form: the mobile verification step (shown, code sent, verified, or failed with a reason).
  "booking_verify_shown",
  "booking_code_sent",
  "booking_code_verified",
  "booking_verify_failed",
  // Campaign popup (Promo & popup): shown, its link followed, or closed.
  "promo_view",
  "promo_click",
  "promo_dismiss",
] as const;

export type AnalyticsEvent = (typeof ANALYTICS_EVENTS)[number];

export type AnalyticsContext = {
  page?: string;
  section?: string;
  placement?: string;
  service?: string;
  branch?: "sector-11" | "sector-18";
  source?: string;
  medium?: string;
  campaign?: string;
};

export type AnalyticsPayload = AnalyticsContext & {
  event: AnalyticsEvent;
};

/**
 * Events describing the consent decision itself. They are recorded
 * anonymously (no visitor/session id) so consent rates can be measured
 * without first-party behavioral tracking.
 */
export const CONSENT_EVENTS = [
  "cookie_banner_view",
  "consent_accept_all",
  "consent_reject_nonessential",
  "consent_preferences_saved",
] as const satisfies readonly AnalyticsEvent[];

export function isAnalyticsEvent(value: string): value is AnalyticsEvent {
  return (ANALYTICS_EVENTS as readonly string[]).includes(value);
}
