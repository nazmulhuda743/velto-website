/**
 * Meta Pixel event map: which site analytics events (src/lib/analytics/events.ts) become which
 * Meta events, and with which parameters. Runtime-neutral (no browser APIs) so the mapping is
 * unit-tested in tests/meta-pixel.test.cjs.
 *
 * Every parameter value is either a fixed vocabulary word or a sanitised slug. Nothing typed by a
 * visitor (name, phone, address, notes) can reach Meta through this module, because no free-text
 * context key is ever copied.
 *
 * Meaning of the standard events, chosen so Meta optimisation is not misled:
 * - Lead: a booking or household quote that Velto Ops actually accepted. Never a click.
 * - Schedule: a booking that reserved a live pickup window (not a "preferred time" request).
 * - InitiateCheckout: first real interaction with the booking form.
 * - Contact: a deliberate WhatsApp or call tap.
 * - ViewContent: a service or outlet page was opened.
 * There is no Purchase: the website never sees a completed order (that happens in Ops after pickup).
 */

export type MetaParams = Record<string, string>;
export type MetaCall = { kind: "standard" | "custom"; name: string; params: MetaParams };

/** Site service slugs → the normalised values sent to Meta. Anything else is dropped. */
const SERVICE: Record<string, string> = {
  "dry-cleaning": "dry_cleaning",
  "wash-and-iron": "wash_and_iron",
  ironing: "ironing",
  "curtain-cleaning": "curtain_cleaning",
  "carpet-cleaning": "carpet_cleaning",
  "blanket-comforter-cleaning": "blanket_cleaning",
  express: "express_service",
};
const SERVICE_VALUES = new Set(Object.values(SERVICE));

const BRANCH: Record<string, string> = { "sector-11": "sector_11", "sector-18": "sector_18" };

export function metaService(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const v = value.trim().toLowerCase();
  return SERVICE[v] ?? (SERVICE_VALUES.has(v) ? v : undefined);
}

export function metaBranch(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const v = value.trim().toLowerCase();
  return BRANCH[v] ?? (Object.values(BRANCH).includes(v) ? v : undefined);
}

const LOCALE_PREFIX = /^\/(?:en|bn)(?=\/|$)/;

/**
 * Page path for Meta: no query or hash, and one-time link codes replaced, so a reminder or
 * invoice link (/r/<code>, /i/<code>) can never be read back from Meta reports.
 */
export function metaPagePath(pathname: string): string {
  const path = (pathname.split(/[?#]/, 1)[0] || "/").slice(0, 200);
  return path.replace(/^((?:\/(?:en|bn))?\/[ri]\/)[^/]+/, "$1[code]");
}

/**
 * Pages where nothing is sent to Meta: customer-account and sign-in pages (also kept out of all
 * analytics by src/lib/analytics/private-paths.ts) plus the per-customer link pages: reminder
 * (/r/), invoice (/i/) and order tracking (/track), whose URLs or content belong to one customer.
 */
const META_EXCLUDED = /^\/(?:account|auth|r|i|track)(?:\/|$)|^\/app\/.|^\/(?:login|signup|forgot-password|reset-password)\/?$/;

export function isMetaExcludedPath(pathname: string): boolean {
  const path = pathname.split(/[?#]/, 1)[0].replace(LOCALE_PREFIX, "") || "/";
  return META_EXCLUDED.test(path);
}

/** Service or outlet page the path points at, for ViewContent and as fallback service context. */
export function pageSubject(pathname: string): { service?: string; branch?: string } {
  const path = pathname.replace(LOCALE_PREFIX, "") || "/";
  const service = /^\/services\/([a-z0-9-]+)\/?$/.exec(path)?.[1];
  if (service) return { service: metaService(service) };
  // The B999 blanket landing page is a blanket service page for Meta (ViewContent on load).
  if (/^\/blanket-cleaning-uttara\/?$/.test(path)) return { service: metaService("blanket-comforter-cleaning") };
  const branch = /^\/locations\/([a-z0-9-]+)\/?$/.exec(path)?.[1];
  if (branch) return { branch: metaBranch(branch) };
  return {};
}

/**
 * The site's CTA placements (data-placement) grouped into one fixed vocabulary for Meta, so
 * reports can compare page areas. The exact placement still travels as `placement`.
 */
export function buttonLocation(placement: string | undefined): string | undefined {
  if (!placement) return undefined;
  const p = placement.toLowerCase();
  if (p === "mobile_sticky" || p.endsWith("-sticky")) return "sticky_mobile";
  if (p === "mobile_menu") return "mobile_menu";
  if (p === "header" || p === "app_header") return "header";
  if (p.startsWith("footer")) return "footer";
  if (p === "hero" || p.endsWith("_hero")) return "hero";
  if (p === "final" || p.endsWith("-final")) return "final_cta";
  if (p.startsWith("pricing") || p.includes("price")) return "pricing_section";
  if (p.startsWith("location") || p === "home_locations") return "location_section";
  if (p.includes("review")) return "reviews_section";
  if (p.startsWith("regular_laundry")) return "regular_laundry_section";
  if (p.startsWith("service") || p.endsWith("_services") || p.endsWith("_process") || p === "process_delicate") return "service_section";
  if (p.startsWith("booking") || p.startsWith("callback")) return "booking_form";
  if (p.startsWith("quote")) return "quote_form";
  return "other";
}

const SLUG = /^[a-z0-9][a-z0-9_-]{0,63}$/;
const slug = (value: string | undefined) => (value && SLUG.test(value) ? value : undefined);

/** Drop empty values so Meta never receives "undefined" or "". */
function clean(params: Record<string, string | undefined>): MetaParams {
  const out: MetaParams = {};
  for (const [key, value] of Object.entries(params)) if (value) out[key] = value;
  return out;
}

export type MetaContext = Record<string, string | undefined>;

/** The page-level calls for a page view: PageView, plus ViewContent on a service or outlet page. */
export function pageViewCalls(pathname: string): MetaCall[] {
  const page_path = metaPagePath(pathname);
  const calls: MetaCall[] = [{ kind: "standard", name: "PageView", params: {} }];
  const subject = pageSubject(pathname);
  if (subject.service) {
    calls.push({ kind: "standard", name: "ViewContent", params: { content_name: subject.service, content_category: "service", content_type: "service", page_path } });
  } else if (subject.branch) {
    calls.push({ kind: "standard", name: "ViewContent", params: { content_name: subject.branch, content_category: "location", content_type: "location", page_path } });
  }
  return calls;
}

/**
 * Meta calls for one site analytics event. `page_view` is handled by pageViewCalls (the runtime
 * deduplicates it per path); `service_view` deliberately maps to nothing because ViewContent is
 * derived from the page path, so a service page can never send it twice.
 */
export function metaCallsFor(event: string, context: MetaContext, pathname: string): MetaCall[] {
  const page_path = metaPagePath(pathname);
  const subject = pageSubject(pathname);
  const service = metaService(context.service) ?? subject.service;
  const placement = slug(context.placement);
  const button_location = buttonLocation(context.placement);
  const where = { page_path, button_location, placement };

  switch (event) {
    case "whatsapp_click":
      return [
        { kind: "standard", name: "Contact", params: clean({ contact_method: "whatsapp", service, ...where }) },
        { kind: "custom", name: "WhatsAppClick", params: clean({ service, ...where }) },
      ];
    case "phone_click":
      return [
        { kind: "standard", name: "Contact", params: clean({ contact_method: "phone", service, ...where }) },
        { kind: "custom", name: "CallClick", params: clean(where) },
      ];
    case "book_pickup_click":
      return [{ kind: "custom", name: "BookPickupClick", params: clean({ service, cta: "book_pickup", ...where }) }];
    case "regular_laundry_interest":
      return [{ kind: "custom", name: "BookPickupClick", params: clean({ service, cta: "regular_pickup", ...where }) }];
    case "booking_start":
      return [{ kind: "standard", name: "InitiateCheckout", params: clean({ content_category: "pickup_booking", service, page_path }) }];
    case "booking_success": {
      const calls: MetaCall[] = [
        { kind: "standard", name: "Lead", params: clean({ lead_type: "pickup_booking", content_category: "pickup_booking", service, page_path, booking_source: placement }) },
      ];
      if (context.pickup === "booked") {
        calls.push({ kind: "standard", name: "Schedule", params: clean({ content_category: "pickup_window", service, page_path }) });
      }
      return calls;
    }
    case "quote_start":
      return [{ kind: "custom", name: "QuoteStart", params: clean({ service, page_path }) }];
    case "quote_success":
      return [{ kind: "standard", name: "Lead", params: clean({ lead_type: "household_quote", content_category: "household_quote", service, page_path }) }];
    case "callback_request":
      return [{ kind: "custom", name: "CallbackRequest", params: clean({ page_path }) }];
    case "pricing_search":
      return [{ kind: "custom", name: "FindPrice", params: clean({ item: slug(context.item), service, page_path }) }];
    case "directions_click":
      return [{ kind: "custom", name: "GetDirections", params: clean({ branch: metaBranch(context.branch) ?? subject.branch, ...where }) }];
    case "google_reviews_click":
      return [{ kind: "custom", name: "ReviewClick", params: clean({ branch: metaBranch(context.branch) ?? subject.branch, ...where }) }];
    default:
      return [];
  }
}

/** Meta Pixel IDs are numeric. Anything else (a placeholder, a typo) keeps the Pixel off. */
export function validMetaPixelId(value: string | undefined): string | null {
  const v = value?.trim();
  return v && /^\d{10,20}$/.test(v) ? v : null;
}
