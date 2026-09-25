/**
 * Command Center analytics: pure aggregation over per-session rows returned by
 * `website_analytics_sessions` (docs/technical/sql/website_analytics.sql).
 * Runtime-neutral and deterministic so it is unit-tested directly.
 *
 * Nothing here invents values: every number is a count of stored sessions,
 * and a rate is only shown when its denominator is non-zero.
 */
import { CHANNEL_LABELS, CHANNEL_ORDER, classifyChannel, type Channel, type Device } from "../analytics/classify";

export type SessionRow = {
  session_id: string;
  visitor_id: string;
  started_at: string;
  ended_at: string;
  is_new: boolean;
  device: Device;
  landing_page: string | null;
  referrer_host: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;
  click_id: string | null;
  marketing: boolean;
  event_count: number;
  pageviews: number;
  paths: string[] | null;
  events_seen: string[] | null;
  services: string[] | null;
  searches: string[] | null;
};

/* ------------------------------------------------------------------ time */

const DHAKA_OFFSET_MS = 6 * 60 * 60 * 1000; // Bangladesh: UTC+6, no DST
const DAY_MS = 24 * 60 * 60 * 1000;

/** yyyy-mm-dd of an instant in Dhaka. */
export const dhakaDay = (d: Date) => new Date(d.getTime() + DHAKA_OFFSET_MS).toISOString().slice(0, 10);
/** Start of a Dhaka calendar day (yyyy-mm-dd) as a UTC instant. */
export const dhakaDayStart = (day: string) => new Date(Date.parse(`${day}T00:00:00Z`) - DHAKA_OFFSET_MS);
export const dhakaHour = (d: Date) => new Date(d.getTime() + DHAKA_OFFSET_MS).getUTCHours();

export type RangeKey = "today" | "7d" | "30d" | "custom";
export type DateRange = { key: RangeKey; from: Date; to: Date; days: number; label: string; prevFrom: Date; prevTo: Date };

/** Raw events are kept 90 days (retention), so custom ranges are capped there. */
export const MAX_RANGE_DAYS = 90;

const validDay = (v: string | undefined) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)) ? v : undefined);

export function parseRange(params: { range?: string; from?: string; to?: string }, now = new Date()): DateRange {
  const today = dhakaDay(now);
  const tomorrowStart = new Date(dhakaDayStart(today).getTime() + DAY_MS);
  let key: RangeKey = params.range === "today" || params.range === "30d" || params.range === "custom" ? params.range : "7d";
  let from: Date;
  let to = tomorrowStart;
  let label: string;

  if (key === "custom") {
    const f = validDay(params.from);
    const t = validDay(params.to);
    if (f && t && f <= t) {
      const earliest = new Date(tomorrowStart.getTime() - MAX_RANGE_DAYS * DAY_MS);
      from = new Date(Math.max(dhakaDayStart(f).getTime(), earliest.getTime()));
      to = new Date(Math.min(dhakaDayStart(t).getTime() + DAY_MS, tomorrowStart.getTime()));
      if (from >= to) from = new Date(to.getTime() - DAY_MS);
      label = `${dhakaDay(from)} → ${dhakaDay(new Date(to.getTime() - 1))}`;
    } else {
      key = "7d";
      from = new Date(tomorrowStart.getTime() - 7 * DAY_MS);
      label = "Last 7 days";
    }
  } else if (key === "today") {
    from = dhakaDayStart(today);
    label = "Today";
  } else {
    const n = key === "30d" ? 30 : 7;
    from = new Date(tomorrowStart.getTime() - n * DAY_MS);
    label = `Last ${n} days`;
  }
  const span = to.getTime() - from.getTime();
  return {
    key,
    from,
    to,
    days: Math.max(1, Math.round(span / DAY_MS)),
    label,
    prevFrom: new Date(from.getTime() - span),
    prevTo: from,
  };
}

/* --------------------------------------------------------------- helpers */

const has = (s: SessionRow, ...events: string[]) => events.some((e) => s.events_seen?.includes(e));
const paths = (s: SessionRow) => s.paths ?? [];
export const channelOf = (s: SessionRow): Channel => classifyChannel(s);

export const rate = (num: number, den: number): number | null => (den > 0 ? num / den : null);
/** 0.4567 → "46%", 0.0456 → "4.6%", null → "—". */
export const pct = (r: number | null) => (r === null ? "—" : `${(r * 100).toFixed(r === 0 || r * 100 >= 10 ? 0 : 1)}%`);

function countBy<T>(items: T[], key: (item: T) => string | null | undefined) {
  const out = new Map<string, number>();
  for (const item of items) {
    const k = key(item);
    if (k) out.set(k, (out.get(k) ?? 0) + 1);
  }
  return out;
}

export type Ranked = { key: string; count: number; share: number | null };
export function rank(map: Map<string, number>, limit = 8, total?: number): Ranked[] {
  const sum = total ?? [...map.values()].reduce((a, b) => a + b, 0);
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([key, count]) => ({ key, count, share: rate(count, sum) }));
}

/* --------------------------------------------------------------- filters */

export type SessionFilter = { service?: string; channel?: string; campaign?: string; device?: string };

export function filterSessions(rows: SessionRow[], f: SessionFilter): SessionRow[] {
  return rows.filter((s) => {
    if (f.service && !(s.services ?? []).includes(f.service) && !paths(s).includes(`/services/${f.service}`)) return false;
    if (f.channel && channelOf(s) !== f.channel) return false;
    if (f.campaign && s.utm_campaign !== f.campaign) return false;
    if (f.device && s.device !== f.device) return false;
    return true;
  });
}

/* -------------------------------------------------------------- overview */

export type Overview = {
  visitors: number;
  sessions: number;
  bookingStarts: number;
  bookings: number;
  quoteStarts: number;
  quotes: number;
  whatsapp: number;
  conversions: number;
  conversionRate: number | null;
  newVisitors: number;
  returningVisitors: number;
  pagesPerSession: number | null;
  topService: Ranked | null;
  topLanding: Ranked | null;
  topChannel: { channel: Channel; count: number } | null;
};

export function overview(rows: SessionRow[]): Overview {
  const visitors = new Set(rows.map((s) => s.visitor_id));
  const newVisitors = new Set(rows.filter((s) => s.is_new).map((s) => s.visitor_id));
  const conversions = rows.filter((s) => has(s, "booking_success", "quote_success")).length;
  const pageviews = rows.reduce((a, s) => a + s.pageviews, 0);
  const channels = countBy(rows, channelOf);
  const [topChannel] = [...channels.entries()].sort((a, b) => b[1] - a[1]);
  return {
    visitors: visitors.size,
    sessions: rows.length,
    bookingStarts: rows.filter((s) => has(s, "booking_start")).length,
    bookings: rows.filter((s) => has(s, "booking_success")).length,
    quoteStarts: rows.filter((s) => has(s, "quote_start")).length,
    quotes: rows.filter((s) => has(s, "quote_success")).length,
    whatsapp: rows.filter((s) => has(s, "whatsapp_click")).length,
    conversions,
    conversionRate: rate(conversions, rows.length),
    newVisitors: newVisitors.size,
    returningVisitors: visitors.size - newVisitors.size,
    pagesPerSession: rows.length ? pageviews / rows.length : null,
    topService: rank(countBy(rows.flatMap((s) => s.services ?? []), (x) => x), 1)[0] ?? null,
    topLanding: rank(countBy(rows, (s) => s.landing_page), 1, rows.length)[0] ?? null,
    topChannel: topChannel ? { channel: topChannel[0] as Channel, count: topChannel[1] } : null,
  };
}

/** Sessions per Dhaka day across the range (zero-filled), for sparklines. */
export function dailySeries(rows: SessionRow[], range: Pick<DateRange, "from" | "to">, pick: (s: SessionRow) => boolean = () => true) {
  const days: string[] = [];
  for (let t = range.from.getTime(); t < range.to.getTime(); t += DAY_MS) days.push(dhakaDay(new Date(t)));
  const counts = countBy(rows.filter(pick), (s) => dhakaDay(new Date(s.started_at)));
  return days.map((day) => ({ day, count: counts.get(day) ?? 0 }));
}

/* ---------------------------------------------------------------- funnel */

export const FUNNEL_STAGES = [
  { key: "landing", label: "Landed on the site", hint: "Every session" },
  { key: "service", label: "Viewed a service", hint: "A service page or a service interaction" },
  { key: "pricing", label: "Checked a price", hint: "Pricing page or price search" },
  { key: "started", label: "Started a booking or quote", hint: "First interaction with either form" },
  { key: "success", label: "Sent a request", hint: "Booking or quote confirmed by Velto Ops" },
] as const;

export type FunnelStageKey = (typeof FUNNEL_STAGES)[number]["key"];

/** Furthest stage a session reached (0..4). Later stages imply the earlier ones. */
export function furthestStage(s: SessionRow): number {
  if (has(s, "booking_success", "quote_success")) return 4;
  if (has(s, "booking_start", "quote_start")) return 3;
  if (has(s, "pricing_search", "pricing_view") || paths(s).includes("/pricing")) return 2;
  if (has(s, "service_view") || paths(s).some((p) => p.startsWith("/services/")) || (s.services ?? []).length) return 1;
  return 0;
}

export type FunnelStep = {
  key: FunnelStageKey;
  label: string;
  hint: string;
  count: number;
  /** Share of all sessions. */
  ofTotal: number | null;
  /** Share of the previous stage. */
  fromPrevious: number | null;
  /** Share of the previous stage lost here. */
  dropOff: number | null;
};

export function funnel(rows: SessionRow[]) {
  const reached = [0, 0, 0, 0, 0];
  for (const s of rows) {
    const f = furthestStage(s);
    for (let i = 0; i <= f; i++) reached[i] += 1;
  }
  const steps: FunnelStep[] = FUNNEL_STAGES.map((stage, i) => {
    const prev = i === 0 ? reached[0] : reached[i - 1];
    const fromPrevious = i === 0 ? rate(reached[0], reached[0]) : rate(reached[i], prev);
    return {
      ...stage,
      count: reached[i],
      ofTotal: rate(reached[i], reached[0]),
      fromPrevious,
      dropOff: i === 0 || fromPrevious === null ? null : 1 - fromPrevious,
    };
  });
  const notConverted = rows.filter((s) => furthestStage(s) < 4);
  const whatsappFallback = notConverted.filter((s) => has(s, "whatsapp_click")).length;
  return { steps, whatsappFallback, whatsappFallbackRate: rate(whatsappFallback, notConverted.length) };
}

/* ----------------------------------------------------------- acquisition */

export type ConversionRow = {
  key: string;
  label: string;
  sessions: number;
  bookingStarts: number;
  bookings: number;
  quotes: number;
  whatsapp: number;
  conversionRate: number | null;
};

function conversionRow(key: string, label: string, rows: SessionRow[]): ConversionRow {
  const bookings = rows.filter((s) => has(s, "booking_success")).length;
  const quotes = rows.filter((s) => has(s, "quote_success")).length;
  const converted = rows.filter((s) => has(s, "booking_success", "quote_success")).length;
  return {
    key,
    label,
    sessions: rows.length,
    bookingStarts: rows.filter((s) => has(s, "booking_start")).length,
    bookings,
    quotes,
    whatsapp: rows.filter((s) => has(s, "whatsapp_click")).length,
    conversionRate: rate(converted, rows.length),
  };
}

export function byChannel(rows: SessionRow[]): ConversionRow[] {
  return CHANNEL_ORDER.map((c) => conversionRow(c, CHANNEL_LABELS[c], rows.filter((s) => channelOf(s) === c)));
}

export function byDevice(rows: SessionRow[]): ConversionRow[] {
  return (["mobile", "tablet", "desktop"] as const).map((d) =>
    conversionRow(d, d[0].toUpperCase() + d.slice(1), rows.filter((s) => s.device === d)),
  );
}

export type UtmRow = ConversionRow & {
  source: string;
  medium: string;
  campaign: string;
  content: string;
  landing: string;
};

/** Only sessions that actually carried UTM fields; nothing is inferred. */
export function utmTable(rows: SessionRow[], limit = 50): UtmRow[] {
  const groups = new Map<string, SessionRow[]>();
  for (const s of rows) {
    if (!s.utm_source && !s.utm_medium && !s.utm_campaign) continue;
    const k = [s.utm_source, s.utm_medium, s.utm_campaign, s.utm_content, s.landing_page].map((v) => v ?? "").join("\u0001");
    const list = groups.get(k);
    if (list) list.push(s);
    else groups.set(k, [s]);
  }
  return [...groups.entries()]
    .map(([k, list]) => {
      const [source, medium, campaign, content, landing] = k.split("\u0001");
      return { ...conversionRow(k, campaign || source, list), source, medium, campaign, content, landing };
    })
    .sort((a, b) => b.sessions - a.sessions)
    .slice(0, limit);
}

export const campaigns = (rows: SessionRow[]) =>
  [...new Set(rows.map((s) => s.utm_campaign).filter((c): c is string => Boolean(c)))].sort();

/* -------------------------------------------------------------- visitors */

export function devices(rows: SessionRow[]) {
  return rank(countBy(rows, (s) => s.device), 3, rows.length);
}

export function topPages(rows: SessionRow[], limit = 10) {
  return rank(countBy(rows.flatMap(paths), (p) => p), limit);
}

export const landingPages = (rows: SessionRow[], limit = 10) => rank(countBy(rows, (s) => s.landing_page), limit, rows.length);
export const exitPages = (rows: SessionRow[], limit = 10) => rank(countBy(rows, (s) => paths(s).at(-1)), limit, rows.length);
export const serviceInterest = (rows: SessionRow[], limit = 10) =>
  rank(countBy(rows.flatMap((s) => [...new Set(s.services ?? [])]), (x) => x), limit, rows.length);
export const pricingSearches = (rows: SessionRow[], limit = 12) => rank(countBy(rows.flatMap((s) => s.searches ?? []), (x) => x), limit);

/** Session starts by Dhaka hour of day (0–23). */
export function hourOfDay(rows: SessionRow[]) {
  const hours = Array.from({ length: 24 }, () => 0);
  for (const s of rows) hours[dhakaHour(new Date(s.started_at))] += 1;
  return hours;
}

const PAGE_LABELS: Record<string, string> = {
  "/": "Homepage",
  "/services": "Services",
  "/pricing": "Pricing",
  "/book": "Booking form",
  "/quote": "Quote form",
  "/track": "Track order",
  "/how-it-works": "How it works",
  "/regular-laundry": "Regular laundry",
  "/locations": "Locations",
  "/about": "About",
};

const titleCase = (slug: string) => slug.split("-").map((w) => (w === "and" ? "&" : w[0]?.toUpperCase() + w.slice(1))).join(" ");

export function pageLabel(path: string) {
  if (PAGE_LABELS[path]) return PAGE_LABELS[path];
  if (path.startsWith("/services/")) return titleCase(path.slice("/services/".length));
  if (path.startsWith("/locations/")) return titleCase(path.slice("/locations/".length));
  return path;
}

export function outcomeOf(s: SessionRow): string {
  if (has(s, "booking_success")) return "Booking sent";
  if (has(s, "quote_success")) return "Quote sent";
  if (has(s, "whatsapp_click")) return "WhatsApp";
  if (has(s, "booking_start", "quote_start")) return "Left a form";
  return "Left";
}

/**
 * Most common journeys: channel → up to four distinct pages → outcome.
 * Aggregated (a journey is only shown with its session count), never a
 * per-visitor timeline.
 */
export function journeys(rows: SessionRow[], limit = 8) {
  const counts = new Map<string, { steps: string[]; count: number; converted: boolean }>();
  for (const s of rows) {
    const pages: string[] = [];
    for (const p of paths(s)) {
      const label = pageLabel(p);
      if (pages.at(-1) !== label) pages.push(label);
    }
    const steps = [CHANNEL_LABELS[channelOf(s)], ...pages.slice(0, 4), outcomeOf(s)];
    const key = steps.join(" → ");
    const hit = counts.get(key);
    if (hit) hit.count += 1;
    else counts.set(key, { steps, count: 1, converted: furthestStage(s) === 4 });
  }
  return [...counts.values()]
    .sort((a, b) => Number(b.converted) - Number(a.converted) || b.count - a.count)
    .slice(0, limit);
}

/* -------------------------------------------------------------- consent */

export type ConsentSummary = {
  banner_views: number;
  decisions: number;
  accept_all: number;
  reject_nonessential: number;
  custom: number;
  analytics_granted: number;
  marketing_granted: number;
  by_device: Record<string, number>;
};

export function consentRates(c: ConsentSummary) {
  return {
    decisionRate: rate(c.decisions, c.banner_views),
    acceptAll: rate(c.accept_all, c.decisions),
    reject: rate(c.reject_nonessential, c.decisions),
    custom: rate(c.custom, c.decisions),
    analytics: rate(c.analytics_granted, c.decisions),
    marketing: rate(c.marketing_granted, c.decisions),
  };
}

/** Relative change vs the previous period, or null when there is no baseline. */
export const delta = (current: number, previous: number) => (previous > 0 ? (current - previous) / previous : null);
