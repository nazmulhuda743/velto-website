/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");
const test = require("node:test");

const build = "../../.command-center-test-build";
const { parseConsent, serializeConsent, consentModeSignals, CONSENT_POLICY_VERSION } = require(`${build}/lib/consent.js`);
const { validateCollectBody, cleanPath, cleanCampaignValue } = require(`${build}/lib/analytics/collect-validation.js`);
const { classifyChannel, deviceFromWidth, referrerHost } = require(`${build}/lib/analytics/classify.js`);
const insights = require(`${build}/lib/admin/insights.js`);
const { analyseRequest, parseCampaignLine, matchesQuickFilter } = require(`${build}/lib/admin/request-intel.js`);

const V = "11111111-1111-4111-8111-111111111111";
const S = "22222222-2222-4222-8222-222222222222";

test("consent cookie round-trips and rejects other policy versions or junk", () => {
  const raw = serializeConsent({ analytics: true, marketing: false }, new Date("2026-09-24T10:00:00Z"));
  assert.deepEqual(parseConsent(raw), { version: CONSENT_POLICY_VERSION, analytics: true, marketing: false, timestamp: "2026-09-24T10:00:00.000Z" });
  assert.equal(parseConsent(encodeURIComponent(JSON.stringify({ version: 99, analytics: true, marketing: true, timestamp: "2026-01-01" }))), null);
  assert.equal(parseConsent("not-json"), null);
  assert.equal(parseConsent(encodeURIComponent(JSON.stringify({ version: 1, analytics: "yes", marketing: false, timestamp: "2026-01-01" }))), null);
  assert.equal(parseConsent(undefined), null);
  // Only the four documented fields are stored.
  assert.deepEqual(Object.keys(JSON.parse(decodeURIComponent(raw))).sort(), ["analytics", "marketing", "timestamp", "version"]);
});

test("consent mode signals deny ad storage without marketing", () => {
  const s = consentModeSignals({ analytics: true, marketing: false });
  assert.equal(s.analytics_storage, "granted");
  assert.equal(s.ad_storage, "denied");
  assert.equal(s.ad_user_data, "denied");
  assert.equal(consentModeSignals({ analytics: false, marketing: false }).analytics_storage, "denied");
});

test("collect validation keeps pathnames only and redacts personal-looking data", () => {
  assert.equal(cleanPath("/book?phone=01712345678#x"), "/book");
  assert.equal(cleanPath("/track/01712345678"), "/track/#");
  assert.equal(cleanPath("/x/name@example.com/y"), "/x/#/y");
  assert.equal(cleanPath("//evil.example"), null);
  assert.equal(cleanPath("https://evil.example/"), null);
  assert.equal(cleanCampaignValue("curtain_sep26"), "curtain_sep26");
  assert.equal(cleanCampaignValue("me@example.com"), null);
  assert.equal(cleanCampaignValue("call 01712 345 678"), null);
});

test("collect validation accepts only taxonomy events, slugs and ids", () => {
  const body = validateCollectBody({
    type: "events",
    visitorId: V,
    sessionId: S,
    isNew: true,
    device: "mobile",
    attribution: { utm_source: "facebook", utm_medium: "paid_social", click_id: "fbclid", referrer_host: "l.facebook.com", landing_page: "/services/curtain-cleaning?x=1" },
    events: [
      { event: "page_view", path: "/services/curtain-cleaning" },
      { event: "pricing_search", path: "/pricing", detail: "Curtain-Panel" },
      { event: "pricing_search", path: "/pricing", detail: "my phone is 0171" },
      { event: "not_an_event", path: "/" },
      { event: "consent_accept_all", path: "/" },
    ],
  });
  assert.equal(body.type, "events");
  assert.equal(body.events.length, 3);
  assert.equal(body.events[1].detail, "curtain-panel");
  assert.equal(body.events[2].detail, null, "free text is never stored");
  assert.equal(body.attribution.landing_page, "/services/curtain-cleaning");
  assert.equal(validateCollectBody({ type: "events", visitorId: "01712345678", sessionId: S, device: "mobile", events: [{ event: "page_view", path: "/" }] }), null);
  assert.equal(validateCollectBody({ type: "events", visitorId: V, sessionId: S, device: "mobile", events: [] }), null);
  assert.equal(validateCollectBody({ type: "whatever" }), null);
});

test("consent events are anonymous and banner views never carry a choice", () => {
  const c = validateCollectBody({ type: "consent", action: "banner_view", analytics: true, marketing: true, version: 1, device: "desktop" });
  assert.deepEqual(c, { type: "consent", action: "banner_view", analytics: false, marketing: false, version: 1, device: "desktop" });
  assert.equal(validateCollectBody({ type: "consent", action: "accept_all", version: 1, device: "phone" }), null);
});

test("channel classification never claims paid traffic without evidence", () => {
  assert.equal(classifyChannel({}), "direct");
  assert.equal(classifyChannel({ referrer_host: "www.google.com" }), "google_organic");
  assert.equal(classifyChannel({ utm_source: "facebook", utm_medium: "paid_social" }), "meta_ads");
  assert.equal(classifyChannel({ utm_source: "facebook" }), "referral");
  assert.equal(classifyChannel({ click_id: "fbclid", referrer_host: "l.facebook.com" }), "referral");
  assert.equal(classifyChannel({ click_id: "gclid" }), "google_ads");
  assert.equal(classifyChannel({ utm_source: "google", utm_medium: "cpc" }), "google_ads");
  assert.equal(classifyChannel({ utm_source: "whatsapp", utm_medium: "share" }), "whatsapp");
  assert.equal(classifyChannel({ utm_source: "newsletter", utm_medium: "email" }), "other");
  assert.equal(deviceFromWidth(390), "mobile");
  assert.equal(deviceFromWidth(1024), "tablet");
  assert.equal(deviceFromWidth(1440), "desktop");
  assert.equal(referrerHost("https://www.velto.com.bd/x", "www.velto.com.bd"), undefined);
  assert.equal(referrerHost("https://l.facebook.com/l.php?u=secret"), "l.facebook.com");
});

const session = (over) => ({
  session_id: S, visitor_id: V, started_at: "2026-09-24T10:00:00Z", ended_at: "2026-09-24T10:05:00Z", is_new: true, device: "mobile",
  landing_page: "/", referrer_host: null, utm_source: null, utm_medium: null, utm_campaign: null, utm_content: null, utm_term: null,
  click_id: null, marketing: false, event_count: 1, pageviews: 1, paths: ["/"], events_seen: ["page_view"], services: [], searches: [], ...over,
});

test("funnel counts each session at its furthest stage and stays monotonic", () => {
  const rows = [
    session({}),
    session({ session_id: "a", paths: ["/services/dry-cleaning"], events_seen: ["page_view", "service_view"], services: ["dry-cleaning"] }),
    session({ session_id: "b", paths: ["/book"], events_seen: ["page_view", "booking_start", "booking_success"] }),
    session({ session_id: "c", paths: ["/", "/pricing"], events_seen: ["page_view", "pricing_search", "whatsapp_click"] }),
  ];
  const f = insights.funnel(rows);
  assert.deepEqual(f.steps.map((s) => s.count), [4, 3, 2, 1, 1]);
  assert.equal(f.steps[4].ofTotal, 0.25);
  assert.equal(f.whatsappFallback, 1);
  for (let i = 1; i < f.steps.length; i++) assert.ok(f.steps[i].count <= f.steps[i - 1].count);
  assert.deepEqual(insights.funnel([]).steps.map((s) => s.ofTotal), [null, null, null, null, null], "no invented rates for empty data");
});

test("overview and UTM table only report what sessions carried", () => {
  const rows = [
    session({ events_seen: ["page_view", "quote_success"], utm_source: "facebook", utm_medium: "paid_social", utm_campaign: "curtain_sep26" }),
    session({ session_id: "x", visitor_id: "v2", is_new: false }),
  ];
  const o = insights.overview(rows);
  assert.equal(o.sessions, 2);
  assert.equal(o.visitors, 2);
  assert.equal(o.quotes, 1);
  assert.equal(o.conversionRate, 0.5);
  assert.equal(o.returningVisitors, 1);
  const utm = insights.utmTable(rows);
  assert.equal(utm.length, 1, "untagged sessions are not given a campaign");
  assert.equal(utm[0].campaign, "curtain_sep26");
  assert.equal(insights.pct(null), "—");
  assert.equal(insights.pct(0.456), "46%");
  assert.equal(insights.pct(0.0456), "4.6%");
});

test("date ranges use Dhaka days and cap custom ranges at raw retention", () => {
  const now = new Date("2026-09-24T20:00:00Z"); // 02:00 on 25 Sept in Dhaka
  const today = insights.parseRange({ range: "today" }, now);
  assert.equal(today.from.toISOString(), "2026-09-24T18:00:00.000Z");
  assert.equal(today.to.toISOString(), "2026-09-25T18:00:00.000Z");
  const custom = insights.parseRange({ range: "custom", from: "2025-01-01", to: "2026-09-25" }, now);
  assert.equal(custom.days, insights.MAX_RANGE_DAYS);
  assert.equal(insights.parseRange({ range: "custom", from: "bad", to: "2026-09-25" }, now).key, "7d");
  assert.equal(insights.parseRange({}, now).days, 7);
});

test("request intelligence reads Ops descriptions without inventing fields", () => {
  const description = ["Name: Nusrat", "Phone: 01700000000", "Area: Sector 18", "Service: Curtain Cleaning", "Campaign: device=mobile, landing_page=/services/curtain-cleaning, utm_medium=paid_social, utm_source=facebook"].join("\n");
  assert.deepEqual(parseCampaignLine("a=1, b=x, y"), { a: "1", b: "x, y" });
  const now = Date.parse("2026-09-24T12:00:00Z");
  const i = analyseRequest({ id: "1", title: "t", type: "call", status: "open", source: "website_quote", outlet_code: "RUAP", description, created_at: "2026-09-24T10:00:00Z", done_at: null, done_by_name: null }, now);
  assert.equal(i.channel, "meta_ads");
  assert.equal(i.sector, 18);
  assert.equal(i.household, true);
  assert.equal(i.device, "mobile");
  assert.ok(matchesQuickFilter(i, "new", now));
  assert.ok(matchesQuickFilter(i, "sector-18", now));
  assert.ok(matchesQuickFilter(i, "paid-social", now));
  const legacy = analyseRequest({ id: "2", title: "t", type: "pickup", status: "done", source: "website_booking", outlet_code: "S11", description: "Name: A", created_at: "2026-09-01T10:00:00Z", done_at: null, done_by_name: null }, now);
  assert.equal(legacy.landing, null);
  assert.equal(legacy.device, null);
  assert.equal(legacy.channel, "direct");
});

test("customer-account pages stay out of analytics and order numbers are redacted", () => {
  const { isPrivatePath, redactPrivatePath } = require(`${build}/lib/analytics/private-paths.js`);
  for (const p of ["/account", "/account/", "/account/orders", "/account/orders/VEL-00001", "/account/profile", "/auth/confirm", "/login", "/signup", "/forgot-password", "/reset-password"]) {
    assert.equal(isPrivatePath(p), true, p);
  }
  for (const p of ["/", "/book", "/track", "/accounts", "/services/wash-fold", "/loginx", "/authors"]) {
    assert.equal(isPrivatePath(p), false, p);
  }
  assert.equal(redactPrivatePath("/account/orders/VEL-00001"), "/account/orders/[order]");
  assert.equal(cleanPath("/account/orders/VEL-00001?x=1"), "/account/orders/[order]");

  const body = (path) => ({ type: "events", visitorId: V, sessionId: S, device: "mobile", isNew: false, attribution: {}, events: [{ event: "page_view", path }] });
  assert.equal(validateCollectBody(body("/account/orders/VEL-00001")), null);
  assert.equal(validateCollectBody(body("/login")), null);
  assert.equal(validateCollectBody(body("/book")).events[0].path, "/book");
  assert.equal(validateCollectBody({ type: "not_found", path: "/account/orders/VEL-99999" }).path, "/account/orders/[order]");
});
