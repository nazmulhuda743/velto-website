/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");
const test = require("node:test");

const build = "../../.command-center-test-build";
const { validateCollectBody } = require(`${build}/lib/analytics/collect-validation.js`);
const { allowedOnPrivatePath, APP_PATH_EVENTS, PRIVATE_PATH_EVENTS } = require(`${build}/lib/analytics/events.js`);
const { appMetrics, rate } = require(`${build}/lib/admin/app-metrics.js`);
const { secondsBucket } = require(`${build}/lib/analytics/app-open.js`);
const { appBookSource, APP_SOURCE } = require(`${build}/lib/customer/app-sources.js`);

const V = "11111111-1111-4111-8111-111111111111";
const S = "22222222-2222-4222-8222-222222222222";
const body = (events, extra = {}) => ({ type: "events", visitorId: V, sessionId: S, device: "mobile", isNew: false, attribution: {}, events, ...extra });

test("app screens record the app's metric events; /account stays as private as before", () => {
  for (const e of ["booking_success", "app_open", "order_view", "whatsapp_click", "notify_off", "routine_change"]) {
    assert.equal(allowedOnPrivatePath(e, "/app/home"), true, `${e} on /app/home`);
    assert.equal(allowedOnPrivatePath(e, "/account"), false, `${e} on /account`);
  }
  // Launches and the install card stay allowed everywhere private.
  for (const e of PRIVATE_PATH_EVENTS) assert.equal(allowedOnPrivatePath(e, "/account"), true);
  for (const e of PRIVATE_PATH_EVENTS) assert.ok(APP_PATH_EVENTS.includes(e));
  // Page views and form steps are never recorded from the app.
  assert.equal(allowedOnPrivatePath("page_view", "/app/home"), false);
  assert.equal(allowedOnPrivatePath("phone_entered", "/app/book"), false);

  const kept = validateCollectBody(
    body([
      { event: "booking_success", path: "/app/book", placement: "app_book_tab", detail: "0-30" },
      { event: "order_view", path: "/app/orders/VEL-00123", placement: "app_order", detail: "ready" },
      { event: "page_view", path: "/app/home" },
      { event: "booking_success", path: "/account", placement: "account_home" },
    ]),
  );
  assert.deepEqual(
    kept.events.map((e) => [e.event, e.path, e.placement, e.detail]),
    [
      ["booking_success", "/app/book", "app_book_tab", "0-30"],
      ["order_view", "/app/orders/[order]", "app_order", "ready"],
    ],
  );
});

test("collect: the page language is kept only as en or bn", () => {
  const e = [{ event: "app_open", path: "/app/home" }];
  assert.equal(validateCollectBody(body(e, { lang: "bn" })).lang, "bn");
  assert.equal(validateCollectBody(body(e, { lang: "en" })).lang, "en");
  assert.equal(validateCollectBody(body(e, { lang: "fr" })).lang, null);
  assert.equal(validateCollectBody(body(e)).lang, null);
});

test("open to booked: seconds become a coarse bucket the server accepts", () => {
  assert.equal(secondsBucket(4), "0-30");
  assert.equal(secondsBucket(29.9), "0-30");
  assert.equal(secondsBucket(30), "30-60");
  assert.equal(secondsBucket(90), "60-120");
  assert.equal(secondsBucket(600), "120-plus");
  for (const b of ["0-30", "30-60", "60-120", "120-plus"]) assert.equal(validateCollectBody(body([{ event: "booking_success", path: "/app/book", detail: b }])).events[0].detail, b);
});

test("booking source: only the named app entry points, anything else is the Book screen", () => {
  assert.equal(appBookSource("app_book_tab"), "app_book_tab");
  assert.equal(appBookSource(APP_SOURCE.bookAgain), "app_book_again");
  assert.equal(appBookSource("app-home-first"), "app_book");
  assert.equal(appBookSource("facebook"), "app_book");
  assert.equal(appBookSource(undefined), "app_book");
  for (const v of Object.values(APP_SOURCE)) assert.match(v, /^app_[a-z_]+$/);
});

test("app report: every metric from the events, null when there is nothing to divide by", () => {
  assert.equal(rate(1, 0), null);
  const empty = appMetrics([], 30);
  assert.equal(empty.rebook.share, null);
  assert.equal(empty.openToBooked.under30, null);
  assert.equal(empty.lapsed.share, null);
  assert.equal(empty.language.share, null);
  assert.equal(empty.notifications.optIn, null);

  const day = (d, h = 10) => `2026-10-${String(d).padStart(2, "0")}T${String(h).padStart(2, "0")}:00:00.000Z`;
  const row = (o) => ({ visitor_id: "v1", session_id: "s1", placement: null, detail: null, lang: "en", path: "/app/home", ...o });
  const rows = [
    // v1 (Bangla): lapsed open on the 1st, rebooks from the Home card 3 days later in a new session.
    row({ occurred_at: day(1), event: "app_open", placement: "installed", detail: "lapsed", lang: "bn" }),
    row({ occurred_at: day(4), session_id: "s2", event: "app_open", placement: "installed", detail: "regular", lang: "bn" }),
    row({ occurred_at: day(4, 11), session_id: "s2", event: "booking_success", path: "/app/home", placement: "app_home_card", detail: "0-30", lang: "bn" }),
    // v2 (English): lapsed open, books 20 days later (outside 14 days) on the Book tab, slowly.
    row({ visitor_id: "v2", session_id: "s3", occurred_at: day(2), event: "app_open", placement: "browser", detail: "lapsed" }),
    row({ visitor_id: "v2", session_id: "s4", occurred_at: day(22), event: "booking_success", path: "/app/book", placement: "app_book_tab", detail: "120-plus" }),
    // v3: views an order twice and asks on WhatsApp once; turns notifications on after one ask.
    row({ visitor_id: "v3", session_id: "s5", occurred_at: day(5), event: "order_view", path: "/app/orders/[order]", detail: "ready" }),
    row({ visitor_id: "v3", session_id: "s5", occurred_at: day(5), event: "order_view", path: "/app/orders/[order]", detail: "ready" }),
    row({ visitor_id: "v3", session_id: "s5", occurred_at: day(5), event: "whatsapp_click", path: "/app/orders/[order]", placement: "app_order_help" }),
    row({ visitor_id: "v3", session_id: "s5", occurred_at: day(5), event: "notify_prompt", path: "/app/book" }),
    row({ visitor_id: "v3", session_id: "s5", occurred_at: day(5), event: "notify_on", path: "/app/book" }),
    row({ visitor_id: "v3", session_id: "s5", occurred_at: day(6), event: "routine_change", path: "/app/profile/weekly", detail: "request" }),
    // A website event is ignored.
    row({ visitor_id: "v9", session_id: "s9", occurred_at: day(6), event: "booking_success", path: "/book", placement: "home_hero" }),
  ];
  const m = appMetrics(rows, 28);
  assert.deepEqual(m.opens, { total: 3, installed: 2, browser: 1, visitors: 2 });
  assert.equal(m.rebook.bookings, 2);
  assert.equal(m.rebook.rebooks, 1);
  assert.equal(m.rebook.share, 0.5);
  assert.equal(m.openToBooked.timed, 2);
  assert.equal(m.openToBooked.under30, 0.5);
  assert.deepEqual(m.lapsed, { visitors: 2, booked: 1, share: 0.5 });
  assert.equal(m.tracking.orderViews, 2);
  assert.deepEqual(m.tracking.byStep, [{ step: "ready", count: 2 }]);
  assert.equal(m.tracking.helpWhatsapp, 1);
  assert.equal(m.tracking.perWeek, 0.25);
  assert.equal(m.weekly.requests, 1);
  assert.deepEqual([m.notifications.prompts, m.notifications.on, m.notifications.optIn], [1, 1, 1]);
  // Sessions s1, s2 Bangla; s3, s4, s5 English → 2 of 5. Booked after opening: Bangla s2 of s1, s2 = 0.5; English s3 opened, not booked = 0.
  assert.equal(m.language.sessions, 5);
  assert.equal(m.language.bangla, 2);
  assert.equal(m.language.share, 0.4);
  assert.equal(m.language.completion.bn, 0.5);
  assert.equal(m.language.completion.en, 0);
});
