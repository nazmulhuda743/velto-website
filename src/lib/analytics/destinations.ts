/**
 * One place that decides what each website event means to GA4 and to Meta.
 * Runtime-neutral (no browser or Node APIs) so it is unit-tested and shared.
 *
 * The website emits its own event names (src/lib/analytics/events.ts). Those stay the first-party
 * vocabulary (Command Center, funnel). This module translates them once into the GA4 and Meta
 * names, and the browser pushes the result to the data layer as a single `velto_track` entry.
 * The GTM container (docs/technical/gtm) is generic: one GA4 event tag and one Meta tag read the
 * names from that entry. No event mapping lives inside GTM.
 *
 * Stages are kept apart on purpose:
 *   intent    WhatsApp / call / Book Pickup clicks, Find a Price      (never Lead, never Purchase)
 *   lead      a booking, quote or call-back request Velto Ops accepted (Lead / generate_lead)
 *   schedule  a booking that reserved a live pickup window             (Schedule / schedule_pickup)
 *   purchase  only server-side, once Ops knows the billed order value  (src/lib/conversions)
 *
 * Nothing here may carry personal data: no name, phone, address, email or notes.
 */
import type { AnalyticsEvent } from "./events";

export type MetaStandardEvent = "PageView" | "ViewContent" | "Contact" | "Lead" | "InitiateCheckout" | "Schedule";

export type Destination = {
  /** GA4 event name (snake_case, Google's naming rules). */
  ga4?: string;
  /** Meta standard event. */
  meta?: MetaStandardEvent;
  /** Meta custom event, sent alongside (or instead of) the standard one. */
  metaCustom?: string;
  /** For lead events: which form produced it. */
  leadSource?: "booking" | "quote" | "callback";
};

/**
 * The complete map. An event that isn't listed stays first-party only.
 * GA4 names follow the recommended events where one exists (generate_lead, begin_checkout).
 */
export const DESTINATIONS: Partial<Record<AnalyticsEvent, Destination>> = {
  page_view: { ga4: "page_view", meta: "PageView" },
  service_view: { ga4: "view_service", meta: "ViewContent" },
  pricing_search: { ga4: "find_price", metaCustom: "FindPrice" },
  pricing_view: { ga4: "view_price" },
  book_pickup_click: { ga4: "book_pickup_click", metaCustom: "BookPickupClick" },
  booking_start: { ga4: "begin_checkout", meta: "InitiateCheckout" },
  booking_success: { ga4: "generate_lead", meta: "Lead", leadSource: "booking" },
  pickup_scheduled: { ga4: "schedule_pickup", meta: "Schedule" },
  booking_error: { ga4: "booking_error" },
  quote_start: { ga4: "quote_start" },
  quote_success: { ga4: "generate_lead", meta: "Lead", leadSource: "quote" },
  callback_request: { ga4: "generate_lead", meta: "Lead", leadSource: "callback" },
  whatsapp_click: { ga4: "whatsapp_click", meta: "Contact", metaCustom: "WhatsAppClick" },
  phone_click: { ga4: "phone_click", meta: "Contact", metaCustom: "CallClick" },
  directions_click: { ga4: "get_directions", metaCustom: "GetDirections" },
  google_reviews_click: { ga4: "review_click", metaCustom: "ReviewClick" },
  track_order_open: { ga4: "track_order_open" },
  regular_laundry_interest: { ga4: "regular_laundry_interest" },
};

/** Normalized service identifiers sent to GA4 and Meta. Page titles are never sent. */
export const SERVICE_IDS = [
  "dry_cleaning",
  "wash_and_iron",
  "ironing",
  "curtain_cleaning",
  "carpet_cleaning",
  "blanket_cleaning",
  "express_service",
] as const;
export type ServiceId = (typeof SERVICE_IDS)[number];

const SERVICE_ALIASES: Record<string, ServiceId> = {
  "dry-cleaning": "dry_cleaning",
  "wash-and-iron": "wash_and_iron",
  ironing: "ironing",
  "curtain-cleaning": "curtain_cleaning",
  "carpet-cleaning": "carpet_cleaning",
  "blanket-comforter-cleaning": "blanket_cleaning",
  "blanket-cleaning": "blanket_cleaning",
  express: "express_service",
  "express-service": "express_service",
};

/** Website slug (or an already-normalized id) → normalized id; anything else → undefined. */
export function normalizeService(value: string | undefined | null): ServiceId | undefined {
  const v = value?.trim().toLowerCase();
  if (!v) return undefined;
  if ((SERVICE_IDS as readonly string[]).includes(v)) return v as ServiceId;
  return SERVICE_ALIASES[v];
}

/** The service a /services/<slug> page is about, so a click there carries it without markup changes. */
export function serviceFromPath(pathname: string): ServiceId | undefined {
  const m = /^(?:\/(?:en|bn))?\/services\/([a-z-]+)\/?$/.exec(pathname);
  return m ? normalizeService(m[1]) : undefined;
}

export type BranchId = "sector_11" | "sector_18";

export function normalizeBranch(value: string | undefined | null): BranchId | undefined {
  const v = value?.trim().toLowerCase().replace(/-/g, "_");
  return v === "sector_11" || v === "sector_18" ? v : undefined;
}

/** Placement / section / item values: short lowercase slugs only, so free text can never leak through. */
function slug(value: string | undefined | null): string | undefined {
  const v = value?.trim().toLowerCase();
  return v && /^[a-z0-9][a-z0-9_-]{0,63}$/.test(v) ? v : undefined;
}

const PATH = /^\/[A-Za-z0-9/_.\-[\]]{0,200}$/;

/**
 * Campaign/UTM context is not repeated on events: GA4 and Meta attribute sessions from the
 * landing URL themselves, and the website keeps its own copy for bookings (src/lib/attribution.ts).
 *
 * Every parameter key the data layer entry can hold. All of them are written on every push
 * (undefined when absent) because GTM's data layer keeps old values: an `item` from an earlier
 * Find a Price search must never be read by a later WhatsApp click.
 */
export const PARAM_KEYS = [
  "page_path",
  "service",
  "button_location",
  "section",
  "branch",
  "item",
  "lead_source",
  "content_name",
  "content_category",
] as const;
export type ParamKey = (typeof PARAM_KEYS)[number];

export type DestinationInput = {
  page?: string;
  service?: string;
  placement?: string;
  section?: string;
  branch?: string;
  item?: string;
  /** Stable id for this occurrence (Meta eventID, for browser + server deduplication). */
  event_id?: string;
};

export type DestinationEntry = {
  event: "velto_track";
  velto_event: string;
  /** "" when the event doesn't go to that platform (never undefined: GTM triggers read these). */
  ga4_event: string;
  meta_event: string;
  meta_custom_event: string;
  event_id: string;
} & Record<ParamKey, string | undefined>;

const EVENT_ID = /^[A-Za-z0-9._:-]{8,80}$/;

/**
 * The data layer entry for one website event, or null when the event stays first-party.
 * `makeId` supplies a fresh id when the caller didn't pass one.
 */
export function destinationEntry(event: string, input: DestinationInput, makeId: () => string): DestinationEntry | null {
  const dest = DESTINATIONS[event as AnalyticsEvent];
  if (!dest) return null;

  const service = normalizeService(input.service);
  const params: Record<ParamKey, string | undefined> = {
    page_path: input.page && PATH.test(input.page) ? input.page : undefined,
    service,
    button_location: slug(input.placement),
    section: slug(input.section),
    branch: normalizeBranch(input.branch),
    item: slug(input.item),
    lead_source: dest.leadSource,
    content_name: dest.meta === "ViewContent" ? service : undefined,
    content_category: dest.meta === "ViewContent" ? "laundry_service" : dest.meta === "Lead" ? service : undefined,
  };

  const id = input.event_id && EVENT_ID.test(input.event_id) ? input.event_id : makeId();
  return {
    event: "velto_track",
    velto_event: event,
    ga4_event: dest.ga4 ?? "",
    meta_event: dest.meta ?? "",
    meta_custom_event: dest.metaCustom ?? "",
    event_id: id,
    ...params,
  };
}

/** Event ids that tie a browser event to the record Velto keeps, so a later server event can deduplicate. */
export const eventIds = {
  /** Booking / quote: the Ops reference (WEB-XXXXXXXX). */
  lead: (reference: string) => `lead.${reference}`,
  schedule: (reference: string) => `schedule.${reference}`,
  /** WhatsApp: the id the browser sent to /go/whatsapp, stored with the WhatsApp reference. */
  contact: (clickId: string) => `contact.${clickId}`,
  /** Purchase: one per Ops order, whoever sends it. */
  purchase: (orderId: string) => `purchase.${orderId}`,
};
