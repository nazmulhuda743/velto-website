import type { AnalyticsEvent } from "../src/lib/analytics/events";

const approvedEvents = [
  "book_pickup_click",
  "booking_start",
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
  "pricing_search",
  "google_reviews_click",
  "service_view",
  "page_view",
  "track_order_open",
  "cookie_banner_view",
  "consent_accept_all",
  "consent_reject_nonessential",
  "consent_preferences_saved",
] as const satisfies readonly AnalyticsEvent[];

const taxonomyIsComplete: Exclude<AnalyticsEvent, (typeof approvedEvents)[number]> extends never
  ? true
  : never = true;

void taxonomyIsComplete;
void approvedEvents;
