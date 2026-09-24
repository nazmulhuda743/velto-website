export const ANALYTICS_EVENTS = [
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
  // Spec §23 events missing from the original foundation list; the union is
  // kept exhaustive by tests/analytics.type-test.ts.
  "pricing_search",
  "google_reviews_click",
  "service_view",
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

export function isAnalyticsEvent(value: string): value is AnalyticsEvent {
  return (ANALYTICS_EVENTS as readonly string[]).includes(value);
}
