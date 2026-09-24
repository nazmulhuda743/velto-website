import "server-only";

/**
 * Synthetic data for the local dashboard preview ONLY (see ./preview.ts).
 * Deterministic (seeded) so screenshots are reproducible. Never shown on a
 * deployed site; every page renders a "Preview data" banner while in use.
 */
import type { WebsiteRequest } from "./data";
import { dhakaDay, dhakaDayStart, type ConsentSummary, type SessionRow } from "./insights";

function prng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pick = <T,>(r: () => number, items: readonly T[]) => items[Math.floor(r() * items.length)];
const weighted = <T,>(r: () => number, items: readonly [T, number][]) => {
  const total = items.reduce((a, [, w]) => a + w, 0);
  let x = r() * total;
  for (const [v, w] of items) {
    if ((x -= w) <= 0) return v;
  }
  return items[0][0];
};
const hex = (r: () => number, n: number) => Array.from({ length: n }, () => Math.floor(r() * 16).toString(16)).join("");
const uuid = (r: () => number) => `${hex(r, 8)}-${hex(r, 4)}-4${hex(r, 3)}-a${hex(r, 3)}-${hex(r, 12)}`;

const SERVICES = ["dry-cleaning", "wash-and-iron", "ironing", "curtain-cleaning", "carpet-cleaning", "blanket-comforter-cleaning"] as const;
const SOURCES: [Partial<SessionRow>, number][] = [
  [{}, 30],
  [{ referrer_host: "www.google.com" }, 22],
  [{ utm_source: "facebook", utm_medium: "paid_social", utm_campaign: "curtain_sep26", utm_content: "video_01", click_id: "fbclid", landing_page: "/services/curtain-cleaning" }, 14],
  [{ utm_source: "instagram", utm_medium: "paid_social", utm_campaign: "drycleaning_puja26", utm_content: "carousel_02", landing_page: "/services/dry-cleaning" }, 9],
  [{ utm_source: "google", utm_medium: "cpc", utm_campaign: "uttara_laundry", click_id: "gclid", landing_page: "/" }, 6],
  [{ utm_source: "whatsapp", utm_medium: "share", utm_campaign: "regulars_sep26", landing_page: "/regular-laundry" }, 5],
  [{ referrer_host: "l.facebook.com" }, 8],
  [{ utm_source: "newsletter", utm_medium: "email", utm_campaign: "sep_update" }, 2],
];
const SEARCHES = ["shirt", "saree", "panjabi", "suit-2pc", "blazer", "comforter-king", "curtain-panel", "bedsheet", "jeans", "carpet-sqft"];

let cache: SessionRow[] | undefined;

export function previewSessions(): SessionRow[] {
  if (cache) return cache;
  const r = prng(20260924);
  const now = Date.now();
  const rows: SessionRow[] = [];
  const visitors: string[] = [];
  for (let day = 89; day >= 0; day--) {
    const weekday = new Date(now - day * 86_400_000).getUTCDay();
    const n = Math.round((weekday === 5 ? 34 : 48) * (0.75 + r() * 0.5) * (1 + (90 - day) / 180));
    for (let i = 0; i < n; i++) {
      const hour = weighted(r, [[9, 3], [11, 5], [13, 4], [15, 4], [18, 6], [20, 8], [21, 7], [22, 5], [23, 2], [8, 2]] as [number, number][]);
      const start = dhakaDayStart(dhakaDay(new Date(now - day * 86_400_000))).getTime() + hour * 3_600_000 + Math.floor(r() * 3_600_000);
      if (start > now) continue;
      const returning = visitors.length > 20 && r() < 0.28;
      const visitor = returning ? pick(r, visitors) : uuid(r);
      if (!returning) visitors.push(visitor);
      const src = weighted(r, SOURCES);
      const device = weighted(r, [["mobile", 74], ["desktop", 21], ["tablet", 5]] as ["mobile" | "desktop" | "tablet", number][]);
      const service = src.landing_page?.startsWith("/services/") ? src.landing_page.slice(10) : pick(r, SERVICES);
      const landing = src.landing_page ?? weighted(r, [["/", 60], [`/services/${service}`, 25], ["/pricing", 10], ["/locations/sector-11", 5]] as [string, number][]);
      const paths = [landing];
      const events = new Set(["page_view"]);
      const services = new Set<string>();
      const searches: string[] = [];
      const paid = src.utm_medium === "paid_social" || src.utm_medium === "cpc";
      const household = /curtain|carpet|blanket/.test(service);
      if (landing.startsWith("/services/")) {
        events.add("service_view");
        services.add(service);
      }
      if (r() < 0.55) {
        if (!landing.startsWith("/services/")) {
          paths.push(`/services/${service}`);
          events.add("service_view");
          services.add(service);
        }
        if (r() < 0.5) {
          paths.push("/pricing");
          events.add("pricing_search");
          searches.push(pick(r, SEARCHES));
          if (r() < 0.3) searches.push(pick(r, SEARCHES));
        }
        if (r() < (paid ? 0.34 : 0.26)) {
          const quote = household && r() < 0.8;
          paths.push(quote ? "/quote" : "/book");
          events.add(quote ? "quote_start" : "booking_start");
          if (!quote) events.add("book_pickup_click");
          if (r() < 0.42) events.add(quote ? "quote_success" : "booking_success");
          else if (r() < 0.35) events.add("whatsapp_click");
        } else if (r() < 0.09) events.add("whatsapp_click");
      }
      if (r() < 0.04) {
        paths.push("/track");
        events.add("track_order_open");
      }
      const duration = paths.length * (40_000 + r() * 120_000);
      rows.push({
        session_id: uuid(r),
        visitor_id: visitor,
        started_at: new Date(start).toISOString(),
        ended_at: new Date(start + duration).toISOString(),
        is_new: !returning,
        device,
        landing_page: landing,
        referrer_host: src.referrer_host ?? (src.utm_source === "facebook" ? "l.facebook.com" : null),
        utm_source: src.utm_source ?? null,
        utm_medium: src.utm_medium ?? null,
        utm_campaign: src.utm_campaign ?? null,
        utm_content: src.utm_content ?? null,
        utm_term: null,
        click_id: src.click_id ?? null,
        marketing: r() < 0.62,
        event_count: paths.length + events.size,
        pageviews: paths.length,
        paths,
        events_seen: [...events].sort(),
        services: [...services],
        searches,
      });
    }
  }
  cache = rows.sort((a, b) => b.started_at.localeCompare(a.started_at));
  return cache;
}

export function previewConsent(days: number): ConsentSummary {
  const views = Math.round(days * 41);
  const decisions = Math.round(views * 0.83);
  const accept = Math.round(decisions * 0.64);
  const reject = Math.round(decisions * 0.27);
  const custom = decisions - accept - reject;
  return {
    banner_views: views,
    decisions,
    accept_all: accept,
    reject_nonessential: reject,
    custom,
    analytics_granted: accept + Math.round(custom * 0.8),
    marketing_granted: accept + Math.round(custom * 0.3),
    by_device: { mobile: Math.round(decisions * 0.75), desktop: Math.round(decisions * 0.2), tablet: Math.round(decisions * 0.05) },
  };
}

const NAMES = ["Nusrat J.", "Tanvir H.", "Farhana A.", "Rafiq I.", "Sadia R.", "Imran K.", "Lamia S.", "Arif M.", "Mehjabin T.", "Shakil A."];
const AREAS = ["Sector 4", "Sector 7", "Sector 11", "Sector 13", "Sector 18", "Sector 10", "Sector 3", "Sector 14"];

export function previewRequests(): WebsiteRequest[] {
  const r = prng(7);
  const now = Date.now();
  const rows = Array.from({ length: 64 }, (_, i) => {
    const quote = r() < 0.35;
    const area = pick(r, AREAS);
    const created = now - Math.floor(i * 11 * 3_600_000 * (0.5 + r()));
    const service = quote ? pick(r, ["Curtain Cleaning", "Carpet Cleaning", "Blanket & Comforter Cleaning"]) : pick(r, ["Dry Cleaning", "Wash & Iron", "Ironing"]);
    const src = weighted(r, SOURCES);
    const attr = [
      src.utm_campaign ? `utm_campaign=${src.utm_campaign}` : "",
      src.utm_medium ? `utm_medium=${src.utm_medium}` : "",
      src.utm_source ? `utm_source=${src.utm_source}` : "",
      src.referrer_host ? `referrer=${src.referrer_host}` : "",
      `landing_page=${src.landing_page ?? (quote ? "/quote" : "/")}`,
      `device=${weighted(r, [["mobile", 75], ["desktop", 25]] as [string, number][])}`,
    ].filter(Boolean).join(", ");
    const name = pick(r, NAMES);
    return {
      id: `preview-${i}`,
      title: `Website ${quote ? "quote" : "pickup"} - ${name}`,
      type: quote ? "call" : "pickup",
      status: i < 5 ? "open" : r() < 0.12 ? "open" : "done",
      source: quote ? "website_quote" : "website_booking",
      outlet_code: /18/.test(area) ? "RUAP" : "S11",
      description: [`Name: ${name}`, "Phone: 01XXXXXXXXX", `Area: ${area}`, `Service: ${service}`, `Campaign: ${attr}`].join("\n"),
      created_at: new Date(created).toISOString(),
      done_at: null,
      done_by_name: null,
    } satisfies WebsiteRequest;
  });
  return rows.sort((a, b) => b.created_at.localeCompare(a.created_at));
}
