/**
 * Admin → Velto app: the design's "Metrics that prove it works", computed from the app's own
 * first-party events (website_analytics_events rows on /app/… paths; docs/technical/APP-METRICS.md).
 * Pure and runtime-neutral, so it is unit-tested directly. Nothing is invented: a rate is shown
 * only when its denominator is above zero, otherwise it is null and the page says "not enough data".
 * Events exist only with Analytics consent, so every number is "of consenting app users".
 */

export type AppEventRow = {
  occurred_at: string;
  visitor_id: string;
  session_id: string;
  event: string;
  path: string;
  placement: string | null;
  detail: string | null;
  lang?: string | null;
};

/** Bookings that repeat the last order without the Book tab: the one-tap card, "Change" on it, "Book this again". */
export const REBOOK_SOURCES = ["app_home_card", "app_home_change", "app_book_again"] as const;
const REBOOK = new Set<string>(REBOOK_SOURCES);
export const OPEN_BUCKETS = ["0-30", "30-60", "60-120", "120-plus"] as const;
const DAY_MS = 86_400_000;

export const rate = (part: number, whole: number) => (whole > 0 ? part / whole : null);

export type AppMetrics = {
  opens: { total: number; installed: number; browser: number; visitors: number };
  rebook: { bookings: number; rebooks: number; share: number | null; bySource: { source: string; count: number }[] };
  openToBooked: { timed: number; buckets: { bucket: string; count: number }[]; under30: number | null };
  lapsed: { visitors: number; booked: number; share: number | null };
  tracking: { orderViews: number; byStep: { step: string; count: number }[]; helpWhatsapp: number; perWeek: number | null };
  weekly: { requests: number; changes: number; pauses: number; resumes: number; stops: number };
  notifications: { prompts: number; on: number; denied: number; off: number; optIn: number | null };
  language: {
    sessions: number;
    bangla: number;
    share: number | null;
    completion: { en: number | null; bn: number | null };
  };
};

const count = (rows: AppEventRow[], f: (r: AppEventRow) => boolean) => rows.reduce((n, r) => n + (f(r) ? 1 : 0), 0);
const tally = (values: string[]) => {
  const m = new Map<string, number>();
  for (const v of values) m.set(v, (m.get(v) ?? 0) + 1);
  return [...m.entries()].map(([k, n]) => ({ k, n })).sort((a, b) => b.n - a.n || a.k.localeCompare(b.k));
};

export function appMetrics(all: AppEventRow[], days: number): AppMetrics {
  const rows = all.filter((r) => /^(?:\/(?:en|bn))?\/app\//.test(r.path));
  const opens = rows.filter((r) => r.event === "app_open");
  const bookings = rows.filter((r) => r.event === "booking_success");

  // Rebook share: of app bookings, those that repeated the last order.
  const bySource = tally(bookings.map((b) => b.placement ?? "unknown")).map(({ k, n }) => ({ source: k, count: n }));
  const rebooks = count(bookings, (b) => REBOOK.has(b.placement ?? ""));

  // Open to booked: the seconds bucket each booking carried.
  const timed = bookings.filter((b) => (OPEN_BUCKETS as readonly string[]).includes(b.detail ?? ""));
  const buckets = OPEN_BUCKETS.map((bucket) => ({ bucket, count: count(timed, (b) => b.detail === bucket) }));

  // Lapsed reactivation: visitors who opened the app on the welcome-back state and booked within 14 days.
  const lapsedFirst = new Map<string, number>();
  for (const o of opens) {
    if (o.detail !== "lapsed") continue;
    const t = Date.parse(o.occurred_at);
    const seen = lapsedFirst.get(o.visitor_id);
    if (seen === undefined || t < seen) lapsedFirst.set(o.visitor_id, t);
  }
  let lapsedBooked = 0;
  for (const [visitor, at] of lapsedFirst) {
    if (bookings.some((b) => b.visitor_id === visitor && Date.parse(b.occurred_at) >= at && Date.parse(b.occurred_at) - at <= 14 * DAY_MS)) lapsedBooked += 1;
  }

  // Tracking views, and "where is my order?" taps on WhatsApp from an order.
  const views = rows.filter((r) => r.event === "order_view");
  const helpWhatsapp = count(rows, (r) => r.event === "whatsapp_click" && r.placement === "app_order_help");

  // Notifications.
  const prompts = count(rows, (r) => r.event === "notify_prompt");
  const on = count(rows, (r) => r.event === "notify_on");

  // Language: share of app sessions in Bangla, and bookings per session that opened the app, per language.
  const sessions = new Map<string, string | null>();
  for (const r of rows) if (!sessions.has(r.session_id) || (r.lang && !sessions.get(r.session_id))) sessions.set(r.session_id, r.lang ?? null);
  const known = [...sessions.values()].filter((l): l is string => l === "en" || l === "bn");
  const bookedSessions = new Set(bookings.map((b) => b.session_id));
  const openedSessions = (lang: string) => [...sessions.entries()].filter(([s, l]) => l === lang && opens.some((o) => o.session_id === s));
  const completion = (lang: string) => {
    const opened = openedSessions(lang);
    return rate(
      opened.filter(([s]) => bookedSessions.has(s)).length,
      opened.length,
    );
  };

  const weeks = Math.max(1, days) / 7;
  return {
    opens: {
      total: opens.length,
      installed: count(opens, (o) => o.placement === "installed"),
      browser: count(opens, (o) => o.placement === "browser"),
      visitors: new Set(opens.map((o) => o.visitor_id)).size,
    },
    rebook: { bookings: bookings.length, rebooks, share: rate(rebooks, bookings.length), bySource },
    openToBooked: { timed: timed.length, buckets, under30: rate(buckets[0].count, timed.length) },
    lapsed: { visitors: lapsedFirst.size, booked: lapsedBooked, share: rate(lapsedBooked, lapsedFirst.size) },
    tracking: {
      orderViews: views.length,
      byStep: tally(views.map((v) => v.detail ?? "unknown")).map(({ k, n }) => ({ step: k, count: n })),
      helpWhatsapp,
      perWeek: views.length || helpWhatsapp ? helpWhatsapp / weeks : null,
    },
    weekly: {
      requests: count(rows, (r) => r.event === "routine_change" && r.detail === "request"),
      changes: count(rows, (r) => r.event === "routine_change" && r.detail === "change"),
      pauses: count(rows, (r) => r.event === "routine_change" && (r.detail === "pause" || r.detail === "withdraw")),
      resumes: count(rows, (r) => r.event === "routine_change" && r.detail === "resume"),
      stops: count(rows, (r) => r.event === "routine_change" && r.detail === "stop"),
    },
    notifications: {
      prompts,
      on,
      denied: count(rows, (r) => r.event === "notify_denied"),
      off: count(rows, (r) => r.event === "notify_off"),
      optIn: rate(on, prompts),
    },
    language: {
      sessions: known.length,
      bangla: known.filter((l) => l === "bn").length,
      share: rate(known.filter((l) => l === "bn").length, known.length),
      completion: { en: completion("en"), bn: completion("bn") },
    },
  };
}

/** The events the report reads (anything else from /app is ignored). */
export const APP_REPORT_EVENTS = ["app_open", "booking_success", "order_view", "whatsapp_click", "notify_prompt", "notify_on", "notify_denied", "notify_off", "routine_change"] as const;

/** Clearly synthetic rows for local design review (VELTO_ADMIN_PREVIEW=1). */
export function previewAppEvents(from: Date, to: Date): AppEventRow[] {
  const rows: AppEventRow[] = [];
  const span = Math.max(1, to.getTime() - from.getTime());
  const at = (i: number) => new Date(from.getTime() + ((i * 7919) % 997) / 997 * span).toISOString();
  const states = ["regular", "regular", "lapsed", "first", "in_progress"];
  const sources = ["app_home_card", "app_home_card", "app_book_tab", "app_book_again", "app_home_change", "app_book_tab"];
  for (let i = 0; i < 60; i++) {
    const visitor = `00000000-0000-4000-8000-${String(i % 24).padStart(12, "0")}`;
    const session = `00000000-0000-4000-9000-${String(i).padStart(12, "0")}`;
    const lang = i % 3 === 0 ? "bn" : "en";
    const state = states[i % states.length];
    rows.push({ occurred_at: at(i), visitor_id: visitor, session_id: session, event: "app_open", path: "/app/home", placement: i % 4 ? "installed" : "browser", detail: state, lang });
    if (i % 2 === 0)
      rows.push({ occurred_at: at(i + 1), visitor_id: visitor, session_id: session, event: "booking_success", path: "/app/book", placement: sources[i % sources.length], detail: OPEN_BUCKETS[i % 4], lang });
    if (i % 3 === 1) rows.push({ occurred_at: at(i + 2), visitor_id: visitor, session_id: session, event: "order_view", path: "/app/orders/[order]", placement: "app_order", detail: ["collected", "cleaning", "ready", "delivered"][i % 4], lang });
    if (i % 9 === 4) rows.push({ occurred_at: at(i + 3), visitor_id: visitor, session_id: session, event: "whatsapp_click", path: "/app/orders/[order]", placement: "app_order_help", detail: null, lang });
    if (i % 6 === 0) rows.push({ occurred_at: at(i + 4), visitor_id: visitor, session_id: session, event: "notify_prompt", path: "/app/book", placement: "app_book_success", detail: null, lang });
    if (i % 12 === 0) rows.push({ occurred_at: at(i + 5), visitor_id: visitor, session_id: session, event: "notify_on", path: "/app/book", placement: "app_book_success", detail: null, lang });
    if (i % 20 === 7) rows.push({ occurred_at: at(i + 6), visitor_id: visitor, session_id: session, event: "routine_change", path: "/app/profile/weekly", placement: "app_profile_weekly", detail: "request", lang });
  }
  return rows;
}
