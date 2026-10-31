/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");
const test = require("node:test");

const {
  metaCallsFor,
  pageViewCalls,
  metaPagePath,
  isMetaExcludedPath,
  buttonLocation,
  metaService,
  validMetaPixelId,
} = require("../.foundation-test-build/meta-pixel/events.js");

const names = (calls) => calls.map((c) => `${c.kind}:${c.name}`);

test("page views: PageView everywhere, ViewContent only on service and outlet pages", () => {
  assert.deepEqual(names(pageViewCalls("/")), ["standard:PageView"]);
  assert.deepEqual(names(pageViewCalls("/pricing")), ["standard:PageView"]);
  const service = pageViewCalls("/services/curtain-cleaning");
  assert.deepEqual(names(service), ["standard:PageView", "standard:ViewContent"]);
  assert.deepEqual(service[1].params, { content_name: "curtain_cleaning", content_category: "service", content_type: "service", page_path: "/services/curtain-cleaning" });
  assert.equal(pageViewCalls("/bn/services/express")[1].params.content_name, "express_service");
  assert.equal(pageViewCalls("/services/blanket-comforter-cleaning")[1].params.content_name, "blanket_cleaning");
  const outlet = pageViewCalls("/locations/sector-18");
  assert.deepEqual(outlet[1].params, { content_name: "sector_18", content_category: "location", content_type: "location", page_path: "/locations/sector-18" });
  // Unknown slugs never produce a ViewContent with junk values.
  assert.deepEqual(names(pageViewCalls("/services/unknown-thing")), ["standard:PageView"]);
});

test("service_view maps to nothing (ViewContent comes from the path, so it can't double-fire)", () => {
  assert.deepEqual(metaCallsFor("service_view", { service: "dry-cleaning" }, "/services/dry-cleaning"), []);
  assert.deepEqual(metaCallsFor("page_view", {}, "/"), []);
});

test("WhatsApp: Contact + WhatsAppClick, with location and service from the page", () => {
  const calls = metaCallsFor("whatsapp_click", { placement: "mobile_sticky" }, "/services/ironing");
  assert.deepEqual(names(calls), ["standard:Contact", "custom:WhatsAppClick"]);
  assert.deepEqual(calls[0].params, { contact_method: "whatsapp", service: "ironing", page_path: "/services/ironing", button_location: "sticky_mobile", placement: "mobile_sticky" });
  assert.deepEqual(calls[1].params, { service: "ironing", page_path: "/services/ironing", button_location: "sticky_mobile", placement: "mobile_sticky" });
  assert.equal(calls[0].params.service, "ironing");
  // No service on the home page: the key is left out, never "undefined".
  const home = metaCallsFor("whatsapp_click", { placement: "hero" }, "/");
  assert.equal("service" in home[0].params, false);
});

test("calls: Contact + CallClick", () => {
  assert.deepEqual(names(metaCallsFor("phone_click", { placement: "header" }, "/")), ["standard:Contact", "custom:CallClick"]);
});

test("booking funnel: click is not a Lead; start, accepted booking and reserved window are", () => {
  const click = metaCallsFor("book_pickup_click", { placement: "hero", service: "wash-and-iron" }, "/");
  assert.deepEqual(names(click), ["custom:BookPickupClick"]);
  assert.deepEqual(click[0].params, { service: "wash_and_iron", cta: "book_pickup", page_path: "/", button_location: "hero", placement: "hero" });

  assert.deepEqual(names(metaCallsFor("booking_start", { section: "booking-form" }, "/book")), ["standard:InitiateCheckout"]);

  const requested = metaCallsFor("booking_success", { service: "dry-cleaning", pickup: "requested" }, "/book");
  assert.deepEqual(names(requested), ["standard:Lead"]);
  assert.equal(requested[0].params.lead_type, "pickup_booking");

  const booked = metaCallsFor("booking_success", { service: "dry-cleaning", pickup: "booked" }, "/book");
  assert.deepEqual(names(booked), ["standard:Lead", "standard:Schedule"]);

  assert.deepEqual(names(metaCallsFor("booking_error", {}, "/book")), []);
  assert.deepEqual(names(metaCallsFor("quote_success", { service: "carpet-cleaning" }, "/quote")), ["standard:Lead"]);
  assert.equal(metaCallsFor("quote_success", { service: "carpet-cleaning" }, "/quote")[0].params.lead_type, "household_quote");
  // Nothing on the site is a Purchase.
  for (const event of ["booking_success", "quote_success", "whatsapp_click", "book_pickup_click"]) {
    assert.ok(metaCallsFor(event, { pickup: "booked" }, "/").every((c) => c.name !== "Purchase"));
  }
});

test("Find a Price, directions and reviews", () => {
  const price = metaCallsFor("pricing_search", { section: "find-a-price", item: "shirt" }, "/pricing");
  assert.deepEqual(price, [{ kind: "custom", name: "FindPrice", params: { item: "shirt", page_path: "/pricing" } }]);
  assert.deepEqual(names(metaCallsFor("pricing_view", { item: "shirt" }, "/pricing")), [], "a rendered result is not an action");

  const dir = metaCallsFor("directions_click", { placement: "locations", branch: "sector-11" }, "/");
  assert.deepEqual(dir[0].params, { branch: "sector_11", page_path: "/", button_location: "location_section", placement: "locations" });
  // On an outlet page the branch comes from the page when the link doesn't carry it.
  assert.equal(metaCallsFor("google_reviews_click", { placement: "location_hero" }, "/locations/sector-18")[0].params.branch, "sector_18");
});

test("no free text or personal data can reach Meta", () => {
  const ctx = {
    name: "Rahim Uddin",
    phone: "01711000000",
    address: "House 1, Road 2",
    notes: "my silk saree",
    item: "Not a slug, has spaces",
    placement: "<script>",
    service: "01711000000",
    branch: "somewhere",
  };
  for (const event of ["whatsapp_click", "phone_click", "book_pickup_click", "booking_start", "booking_success", "quote_success", "pricing_search", "directions_click", "google_reviews_click", "callback_request"]) {
    for (const call of metaCallsFor(event, ctx, "/book")) {
      const text = JSON.stringify(call.params);
      for (const bad of ["Rahim", "0171", "House", "saree", "spaces", "<script>", "somewhere", "undefined"]) {
        assert.ok(!text.includes(bad), `${event} leaked ${bad}: ${text}`);
      }
    }
  }
});

test("paths: codes redacted, per-customer pages excluded", () => {
  assert.equal(metaPagePath("/i/AB12CD?x=1#y"), "/i/[code]");
  assert.equal(metaPagePath("/bn/r/xyz"), "/bn/r/[code]");
  assert.equal(metaPagePath("/book?service=dry-cleaning&utm_source=facebook"), "/book");
  for (const p of ["/account", "/bn/account/orders/9", "/app/home", "/login", "/signup", "/r/abc", "/i/abc", "/track", "/bn/track"]) {
    assert.equal(isMetaExcludedPath(p), true, p);
  }
  for (const p of ["/", "/book", "/quote", "/pricing", "/services/ironing", "/locations/sector-11", "/app", "/bn", "/regular-laundry", "/install"]) {
    assert.equal(isMetaExcludedPath(p), false, p);
  }
});

test("button locations use one fixed vocabulary", () => {
  const cases = {
    hero: "hero", services_hero: "hero", location_hero: "hero", header: "header", mobile_sticky: "sticky_mobile",
    "dry-cleaning-page-sticky": "sticky_mobile", mobile_menu: "mobile_menu", footer: "footer", footer_facebook: "footer",
    final: "final_cta", pricing: "pricing_section", home_popular_price: "pricing_section", service_prices: "pricing_section",
    locations: "location_section", location_page: "location_section", reviews: "reviews_section", review_card: "reviews_section",
    service_process: "service_section", regular_services: "service_section", regular_laundry: "regular_laundry_section",
    booking_error: "booking_form", callback_blocked: "booking_form", quote_aside: "quote_form", not_found: "other",
  };
  for (const [placement, expected] of Object.entries(cases)) assert.equal(buttonLocation(placement), expected, placement);
  assert.equal(buttonLocation(undefined), undefined);
});

test("service and Pixel ID normalisation", () => {
  assert.equal(metaService("dry-cleaning"), "dry_cleaning");
  assert.equal(metaService("dry_cleaning"), "dry_cleaning");
  assert.equal(metaService("regular-laundry"), undefined);
  assert.equal(validMetaPixelId(" 1572691373844990 "), "1572691373844990");
  assert.equal(validMetaPixelId("PASTE_META_PIXEL_ID_HERE"), null);
  assert.equal(validMetaPixelId(""), null);
  assert.equal(validMetaPixelId(undefined), null);
});

test("the B999 blanket page is a blanket service page for Meta: ViewContent on load, Lead and InitiateCheckout as usual, never Purchase", () => {
  assert.deepEqual(names(pageViewCalls("/blanket-cleaning-uttara")), ["standard:PageView", "standard:ViewContent"]);
  assert.equal(pageViewCalls("/bn/blanket-cleaning-uttara")[1].params.content_name, "blanket_cleaning");
  const all = ["booking_start", "booking_success", "whatsapp_click", "service_view", "book_pickup_click"].flatMap((e) =>
    metaCallsFor(e, { service: "blanket-comforter-cleaning", placement: "b999" }, "/blanket-cleaning-uttara"),
  );
  assert.ok(all.some((c) => c.name === "InitiateCheckout") && all.some((c) => c.name === "Lead") && all.some((c) => c.name === "Contact"));
  assert.ok(!all.some((c) => c.name === "Purchase"));
});
