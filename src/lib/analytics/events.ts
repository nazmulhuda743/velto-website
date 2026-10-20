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
  // "Install Velto" popup: shown with the one-tap prompt (Android) or the iPhone steps, accepted or dismissed.
  "install_prompt_shown",
  "install_accepted",
  "install_dismissed",
  "install_ios_shown",
  // Campaign popup (Promo & popup): shown, its link followed, or closed.
  "promo_view",
  "promo_click",
  "promo_dismiss",
  // Notifications: "Turn on" tapped (the phone's prompt shown), allowed, or blocked.
  "notify_prompt",
  "notify_on",
  "notify_denied",
  // Installed app (step 7, docs/technical/APP-METRICS.md): opened or brought back to the screen
  // (detail = Home state), an order opened (detail = tracker step), notifications turned off,
  // a weekly pickup requested, changed, paused, resumed, withdrawn or stopped (detail).
  "app_open",
  "order_view",
  "notify_off",
  "routine_change",
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

/**
 * The few events that may be recorded on customer-account pages (src/lib/analytics/private-paths.ts):
 * app launches and the install popup. They carry no order or customer data. Checked in the browser
 * (track) and again by /api/collect.
 */
export const PRIVATE_PATH_EVENTS = [
  "app_launch",
  "install_prompt_shown",
  "install_accepted",
  "install_dismissed",
  "install_ios_shown",
] as const satisfies readonly AnalyticsEvent[];

/**
 * In the installed app's screens (/app/…) also the events behind the app's metrics (design "Metrics
 * that prove it works"): bookings and where they started, opens, order views, WhatsApp, notifications
 * and weekly pickup. First-party only (GTM and the Meta Pixel never load on /app), with Analytics
 * consent, never from staff browsers, with no customer id and order numbers redacted from paths.
 * The website's /account pages stay as before.
 */
export const APP_PATH_EVENTS = [
  ...PRIVATE_PATH_EVENTS,
  "app_open",
  "booking_start",
  "booking_success",
  "booking_error",
  "book_pickup_click",
  "whatsapp_click",
  "order_view",
  "notify_prompt",
  "notify_on",
  "notify_denied",
  "notify_off",
  "routine_change",
] as const satisfies readonly AnalyticsEvent[];

const PRIVATE_PATH_EVENT_SET = new Set<string>(PRIVATE_PATH_EVENTS);
const APP_PATH_EVENT_SET = new Set<string>(APP_PATH_EVENTS);
const APP_PATH = /^(?:\/(?:en|bn))?\/app\//;

/** May this event be recorded from this private page? `path` is the page's pathname. */
export function allowedOnPrivatePath(event: string, path = ""): boolean {
  return APP_PATH.test(path) ? APP_PATH_EVENT_SET.has(event) : PRIVATE_PATH_EVENT_SET.has(event);
}
