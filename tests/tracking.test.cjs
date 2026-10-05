/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");
const test = require("node:test");

const { DESTINATIONS, PARAM_KEYS, destinationEntry, eventIds, normalizeService, normalizeBranch } = require("../.foundation-test-build/analytics/destinations.js");
const { adClickIds, composeWhatsAppText, extractWhatsAppRef, fbcFromClick, readRefRequest, whatsappRefHref, REF_PATTERN } = require("../.foundation-test-build/whatsapp-ref.js");
const { metaPurchaseEvent } = require("../.foundation-test-build/conversions/meta-capi.js");

const id = () => "generated-id-123";

test("each website action maps once to GA4 and Meta", () => {
  const wa = destinationEntry("whatsapp_click", { page: "/services/ironing", placement: "mobile_sticky", service: "ironing" }, id);
  assert.equal(wa.event, "velto_track");
  assert.equal(wa.ga4_event, "whatsapp_click");
  assert.equal(wa.meta_event, "Contact");
  assert.equal(wa.meta_custom_event, "WhatsAppClick");
  assert.equal(wa.button_location, "mobile_sticky");
  assert.equal(wa.service, "ironing");
  assert.equal(destinationEntry("phone_click", {}, id).meta_custom_event, "CallClick");
  assert.equal(destinationEntry("book_pickup_click", {}, id).meta_event, "");
  assert.equal(destinationEntry("book_pickup_click", {}, id).meta_custom_event, "BookPickupClick");
  assert.equal(destinationEntry("pricing_search", { item: "shirt" }, id).ga4_event, "find_price");
  assert.equal(destinationEntry("directions_click", { branch: "sector-18" }, id).branch, "sector_18");
  assert.equal(destinationEntry("google_reviews_click", {}, id).ga4_event, "review_click");
  assert.equal(destinationEntry("service_view", { service: "blanket-comforter-cleaning" }, id).content_name, "blanket_cleaning");
  assert.equal(destinationEntry("booking_start", {}, id).meta_event, "InitiateCheckout");
  assert.equal(destinationEntry("pickup_scheduled", {}, id).meta_event, "Schedule");
  // First-party-only events produce nothing for GA4 / Meta.
  assert.equal(destinationEntry("phone_entered", {}, id), null);
  assert.equal(destinationEntry("consent_accept_all", {}, id), null);
});

test("intent is never a Lead and nothing in the browser is a Purchase", () => {
  for (const event of ["whatsapp_click", "phone_click", "book_pickup_click", "pricing_search", "booking_start"]) {
    assert.notEqual(DESTINATIONS[event].meta, "Lead", event);
    assert.notEqual(DESTINATIONS[event].ga4, "generate_lead", event);
  }
  for (const d of Object.values(DESTINATIONS)) {
    assert.notEqual(d.meta, "Purchase");
    assert.notEqual(d.ga4, "purchase");
  }
  for (const event of ["booking_success", "quote_success", "callback_request"]) {
    assert.equal(DESTINATIONS[event].meta, "Lead");
    assert.equal(DESTINATIONS[event].ga4, "generate_lead");
  }
});

test("every parameter is written on every entry (GTM keeps stale values otherwise)", () => {
  const entry = destinationEntry("page_view", { page: "/" }, id);
  for (const key of PARAM_KEYS) assert.ok(Object.hasOwn(entry, key), key);
  assert.equal(entry.item, undefined);
});

test("only normalized, non-personal values pass", () => {
  assert.equal(normalizeService("Dry Cleaning page title"), undefined);
  assert.equal(normalizeService("express"), "express_service");
  assert.equal(normalizeBranch("sector-7"), undefined);
  const e = destinationEntry("whatsapp_click", { placement: "Rahim 01711000000", item: "my address", page: "/book?phone=017" }, id);
  assert.equal(e.button_location, undefined);
  assert.equal(e.item, undefined);
  assert.equal(e.page_path, undefined);
});

test("event ids: given ids are kept, otherwise generated", () => {
  assert.equal(destinationEntry("booking_success", { event_id: eventIds.lead("WEB-AB12CD34") }, id).event_id, "lead.WEB-AB12CD34");
  assert.equal(destinationEntry("booking_success", { event_id: "bad id with spaces" }, id).event_id, "generated-id-123");
  assert.equal(eventIds.purchase("o-1"), "purchase.o-1");
});

test("WhatsApp reference: link rebuild, parse and message", () => {
  const href = whatsappRefHref("/go/whatsapp?text=Hi", {
    clickId: "0f9c2d1e-aaaa-4bbb-8ccc-123456789abc",
    page: "/services/dry-cleaning",
    placement: "service_hero",
    service: "dry-cleaning",
    device: "mobile",
    attribution: { utm_source: "facebook", utm_campaign: "dc", fbclid: "IwAR0abcdefghijk" },
  });
  const url = new URL(href, "https://velto.local");
  assert.equal(url.searchParams.get("text"), "Hi");
  assert.equal(url.searchParams.get("vr"), "1");
  // A second click rebuilds from the text instead of stacking parameters.
  const again = new URL(whatsappRefHref(href, { clickId: "1f9c2d1e-aaaa-4bbb-8ccc-123456789abc" }), "https://velto.local");
  assert.equal(again.searchParams.get("utm_source"), null);
  assert.equal(again.searchParams.get("eid"), "1f9c2d1e-aaaa-4bbb-8ccc-123456789abc");
  assert.equal(whatsappRefHref("https://wa.me/880", { clickId: "x" }), "https://wa.me/880");

  const req = readRefRequest(url.searchParams);
  assert.equal(req.clickId, "0f9c2d1e-aaaa-4bbb-8ccc-123456789abc");
  assert.equal(req.attribution.utm_campaign, "dc");
  assert.equal(req.device, "mobile");
  assert.equal(readRefRequest(new URLSearchParams("text=Hi")), null);
  assert.equal(readRefRequest(new URLSearchParams("vr=1&eid=<script>")), null);

  assert.equal(composeWhatsAppText("Hi Velto", "WA-7K2PQ"), "Hi Velto\n\nRef: WA-7K2PQ");
  assert.equal(composeWhatsAppText(null, "WA-7K2PQ"), "Ref: WA-7K2PQ\n");
  assert.equal(composeWhatsAppText("Hi", null), "Hi");
  assert.equal(composeWhatsAppText(null, null), null);
});

test("WhatsApp reference: found in a pasted chat, lookalikes ignored", () => {
  assert.equal(extractWhatsAppRef("Assalamualaikum, curtain pickup lagbe\n\nRef: WA-7K2PQ"), "WA-7K2PQ");
  assert.equal(extractWhatsAppRef("ref wa-7k2pq"), "WA-7K2PQ");
  assert.equal(extractWhatsAppRef("WAX7K2PQ1 SWA-7K2PQ"), null);
  assert.equal(extractWhatsAppRef("WA-7K2P0"), null); // 0 is not in the alphabet
  assert.ok(REF_PATTERN.test("WA-7K2PQ"));
});

test("click ids need Marketing consent; Pixel cookies win", () => {
  const a = { fbclid: "IwAR0abcdefghijk", gclid: "Cj0KCQjw_abcdefgh" };
  assert.deepEqual(adClickIds(false, { fbp: "fb.1.1759700000000.1234567890" }, a, 1759700000000), {});
  const ids = adClickIds(true, { fbp: "fb.1.1759700000000.1234567890", fbc: "fb.1.1759600000000.IwAR0cookievalue" }, a, 1759700000000);
  assert.equal(ids.fbc, "fb.1.1759600000000.IwAR0cookievalue");
  assert.equal(ids.fbp, "fb.1.1759700000000.1234567890");
  assert.equal(ids.gclid, "Cj0KCQjw_abcdefgh");
  assert.equal(adClickIds(true, {}, a, 1759700000000).fbc, "fb.1.1759700000000.IwAR0abcdefghijk");
  assert.equal(adClickIds(true, { fbp: "garbage" }, {}, 1).fbp, undefined);
  assert.equal(fbcFromClick("bad id!", 1), undefined);
});

test("Purchase only with a final billed value, consent and click ids", () => {
  const now = Date.parse("2026-10-06T10:00:00Z");
  const order = { orderId: "6b2f0f6a-0000-4000-8000-000000000001", billedValue: 1250, status: "Delivered", billedAt: "2026-10-05T12:00:00Z", services: ["dry_cleaning"] };
  const attribution = { marketingConsent: true, clickIds: { fbc: "fb.1.1759600000000.IwAR0cookievalue" } };
  const ok = metaPurchaseEvent(order, attribution, now);
  assert.equal(ok.ok, true);
  assert.equal(ok.event.event_id, "purchase.6b2f0f6a-0000-4000-8000-000000000001");
  assert.equal(ok.event.custom_data.currency, "BDT");
  assert.equal(ok.event.custom_data.value, 1250);
  assert.equal(metaPurchaseEvent({ ...order, billedValue: 0 }, attribution, now).reason, "value_not_final");
  assert.equal(metaPurchaseEvent({ ...order, billedValue: null }, attribution, now).reason, "value_not_final");
  assert.equal(metaPurchaseEvent({ ...order, status: "Cancelled" }, attribution, now).reason, "cancelled");
  assert.equal(metaPurchaseEvent(order, { ...attribution, marketingConsent: false }, now).reason, "no_consent");
  assert.equal(metaPurchaseEvent(order, { marketingConsent: true, clickIds: {} }, now).reason, "no_click_ids");
  assert.equal(metaPurchaseEvent({ ...order, billedAt: "2026-09-20T00:00:00Z" }, attribution, now).reason, "too_old");
});

test("a click on a service page carries that service", () => {
  const { serviceFromPath } = require("../.foundation-test-build/analytics/destinations.js");
  assert.equal(serviceFromPath("/services/curtain-cleaning"), "curtain_cleaning");
  assert.equal(serviceFromPath("/bn/services/express"), "express_service");
  assert.equal(serviceFromPath("/services"), undefined);
  assert.equal(serviceFromPath("/book"), undefined);
});
