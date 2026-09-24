export const ANALYTICS_EVENTS = [
  "book_pickup_click",
  "booking_start",
  "booking_success",
  "whatsapp_click",
  "pricing_search",
  "pricing_view",
  "service_view",
  "quote_start",
  "quote_success",
  "directions_click",
  "google_reviews_click",
  "regular_laundry_interest",
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
