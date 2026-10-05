/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("node:fs");
const path = require("node:path");

const build = "../../.command-center-test-build";
const { serializeConsent } = require(`${build}/lib/consent.js`);
const { consentFromCookie, whatsappLeadPayload, withReference, WHATSAPP_REF_PATTERN, BOT_UA } = require(`${build}/lib/whatsapp-ref-core.js`);
const { campaignTable } = require(`${build}/lib/admin/revenue.js`);

const jar = (values) => ({ get: (name) => (name in values ? { value: values[name] } : undefined) });
const consent = (analytics, marketing) => serializeConsent({ analytics, marketing }, new Date("2026-10-06T00:00:00Z"));

test("consent comes from the cookie, never from the link", () => {
  assert.equal(consentFromCookie(jar({})), "none");
  assert.equal(consentFromCookie(jar({ velto_consent_v1: consent(false, false) })), "essential");
  assert.equal(consentFromCookie(jar({ velto_consent_v1: consent(true, false) })), "analytics");
  assert.equal(consentFromCookie(jar({ velto_consent_v1: consent(true, true) })), "analytics+marketing");
  const p = whatsappLeadPayload(new URLSearchParams("consent=analytics%2Bmarketing&fbclid=abc&utm_source=facebook"), jar({}));
  assert.equal(p.consent, "none");
  assert.equal(p.fbclid, undefined, "click id dropped without marketing consent");
  assert.equal(p.utm_source, "facebook", "campaign kept");
});

test("marketing consent keeps click ids and Meta cookies; URL-supplied fbp/fbc are ignored", () => {
  const cookies = jar({ velto_consent_v1: consent(true, true), _fbp: "fb.1.1759700000000.123456789", _fbc: "fb.1.1759700000000.IwAR1" });
  const p = whatsappLeadPayload(new URLSearchParams("fbclid=IwAR1&gclid=G1&fbp=fb.1.1.evil&analytics_session=11111111-1111-4111-8111-111111111111"), cookies);
  assert.equal(p.fbclid, "IwAR1");
  assert.equal(p.gclid, "G1");
  assert.equal(p.fbp, "fb.1.1759700000000.123456789");
  assert.equal(p.fbc, "fb.1.1759700000000.IwAR1");
  assert.equal(p.analytics_session, "11111111-1111-4111-8111-111111111111");
  const noCookie = whatsappLeadPayload(new URLSearchParams("fbp=fb.1.1759700000000.999"), jar({ velto_consent_v1: consent(true, true) }));
  assert.equal(noCookie.fbp, undefined);
  const badCookie = whatsappLeadPayload(new URLSearchParams(""), jar({ velto_consent_v1: consent(false, true), _fbp: "not a meta cookie" }));
  assert.equal(badCookie.fbp, undefined);
});

test("payload keeps only allowlisted keys, an on-site landing path and a valid sector", () => {
  const p = whatsappLeadPayload(
    new URLSearchParams("text=Hi&wr=1&landing_page=%2Fservices%2Fironing&service=ironing&area_sector=11&phone=01712345678&lang=bn"),
    jar({}),
  );
  assert.equal(p.landing_page, "/services/ironing");
  assert.equal(p.service, "ironing");
  assert.equal(p.area_sector, "11");
  for (const k of ["text", "wr", "phone", "lang"]) assert.equal(p[k], undefined, `${k} must not be stored`);
  assert.equal(whatsappLeadPayload(new URLSearchParams("area_sector=44"), jar({})).area_sector, undefined);
  assert.equal(whatsappLeadPayload(new URLSearchParams("landing_page=//evil.example"), jar({})).landing_page, undefined);
});

test("reference goes on its own last line; greeting when the button had no text", () => {
  assert.equal(withReference(null, "W7K2PQ", "en"), "Hi Velto\n\nRef: W7K2PQ");
  assert.equal(withReference("", "W7K2PQ", "bn"), "হ্যালো Velto\n\nRef: W7K2PQ");
  assert.equal(withReference("I need curtains cleaned", "W7K2PQ", "en"), "I need curtains cleaned\n\nRef: W7K2PQ");
  assert.ok(withReference("x".repeat(900), "W7K2PQ", "en").length <= 500);
});

test("reference alphabet avoids look-alike characters; link previews are bots", () => {
  assert.ok(WHATSAPP_REF_PATTERN.test("W7K2PQ"));
  for (const bad of ["W0K2PQ", "WOK2PQ", "W1K2PQ", "WIK2PQ", "w7k2pq", "W7K2P", "WEB-ABCDEF12"]) assert.ok(!WHATSAPP_REF_PATTERN.test(bad), bad);
  for (const ua of ["WhatsApp/2.23.20.0", "facebookexternalhit/1.1", "Googlebot/2.1", "curl/8.0"]) assert.ok(BOT_UA.test(ua), ua);
  assert.ok(!BOT_UA.test("Mozilla/5.0 (Linux; Android 14; SM-A145F) AppleWebKit/537.36 Chrome/129.0 Mobile Safari/537.36"));
});

test("campaign table counts WhatsApp taps apart from bookings and quotes", () => {
  const lead = (id, kind, linked) => ({
    lead_id: id, created_at: "2026-10-01T10:00:00Z", kind, service: null,
    utm_source: "facebook", utm_medium: "paid_social", utm_campaign: "curtains-oct", source: null, campaign: null,
    referrer_host: null, click_id: null, ft_at: null, ft_utm_source: null, ft_utm_medium: null, ft_utm_campaign: null,
    ft_referrer_host: null, ft_click_id: null, link_method: linked ? "x" : null, window_kind: linked ? "primary" : null,
    link_status: linked ? "active" : null, name_mismatch: false, conflict: null, has_order: linked,
  });
  const rows = campaignTable([], [lead("a", "booking", true), lead("b", "quote", false), lead("c", "whatsapp", true), lead("d", "whatsapp", false), lead("e", "whatsapp", false)], []);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].leads, 2);
  assert.equal(rows[0].coverage, 0.5);
  assert.equal(rows[0].whatsappTaps, 3);
  assert.equal(rows[0].whatsappMatched, 1);
});

test("GTM container: GA4 names, one lead event, no duplicate page views", () => {
  const file = path.join(__dirname, "../../docs/technical/gtm/velto-gtm-container.json");
  const cv = JSON.parse(fs.readFileSync(file, "utf8")).containerVersion;
  const ga4 = cv.tag.filter((t) => t.type === "gaawe").map((t) => t.parameter.find((p) => p.key === "eventName").value);
  for (const name of ["page_view", "view_service", "find_price", "book_pickup_click", "begin_checkout", "whatsapp_click", "review_click", "get_directions", "generate_lead", "repeat_booking"]) {
    assert.ok(ga4.includes(name), `missing GA4 ${name}`);
  }
  for (const old of ["service_view", "pricing_search", "booking_success", "quote_success", "google_reviews_click", "directions_click", "booking_start", "purchase", "schedule_pickup"]) {
    assert.ok(!ga4.includes(old), `GA4 must not send ${old}`);
  }
  assert.equal(new Set(ga4).size, ga4.length, "each GA4 event has one tag");
  const google = cv.tag.find((t) => t.type === "googtag");
  const spv = google.parameter.find((p) => p.key === "configSettingsTable").list.find((m) => m.map[0].value === "send_page_view");
  assert.equal(spv.map[1].value, "false", "page views come only from the site's page_view event");
  for (const t of cv.tag) assert.equal(t.consentSettings?.consentStatus, "NEEDED", `${t.name} must require consent`);
  const lead = cv.trigger.find((t) => t.triggerId === "46");
  assert.ok(lead.filter.some((f) => f.parameter.some((p) => p.value === "reminder")), "reminder rebooks are not leads");
});
