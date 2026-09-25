/**
 * Request intelligence: read-only analysis of website requests as they sit in
 * the Velto Ops task list. Ops stays the source of truth for status; this
 * module only reads the task fields and the "Label: value" description lines
 * written by `website_create_request` (including its "Campaign:" line).
 */
import { CHANNEL_LABELS, classifyChannel, type Channel } from "../analytics/classify";
import type { WebsiteRequest } from "./data";
import { requestDetails } from "./request-details";

export type RequestInsight = {
  request: WebsiteRequest;
  details: Record<string, string>;
  kind: "booking" | "quote";
  service: string | null;
  area: string | null;
  outlet: string | null;
  sector: number | null;
  household: boolean;
  campaign: Record<string, string>;
  channel: Channel;
  landing: string | null;
  device: string | null;
  open: boolean;
  ageHours: number;
};

/** "utm_source=facebook, utm_medium=paid_social, landing_page=/x" → record. */
export function parseCampaignLine(line: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!line) return out;
  for (const part of line.split(/,\s+(?=[a-z_]+=)/)) {
    const i = part.indexOf("=");
    if (i > 0) out[part.slice(0, i).trim()] = part.slice(i + 1).trim();
  }
  return out;
}

const HOUSEHOLD = /curtain|carpet|blanket|comforter/i;

export function analyseRequest(r: WebsiteRequest, now = Date.now()): RequestInsight {
  const details = requestDetails(r.description);
  const campaign = parseCampaignLine(details.Campaign);
  const area = details.Area ?? null;
  const sectorMatch = area?.match(/(?:^|[^0-9])(\d{1,2})(?:[^0-9]|$)/);
  const service = details.Service ?? null;
  return {
    request: r,
    details,
    kind: r.source === "website_booking" ? "booking" : "quote",
    service,
    area,
    outlet: r.outlet_code,
    sector: sectorMatch ? Number(sectorMatch[1]) : null,
    household: r.source === "website_quote" || HOUSEHOLD.test(service ?? ""),
    campaign,
    channel: classifyChannel({
      utm_source: campaign.utm_source ?? null,
      utm_medium: campaign.utm_medium ?? null,
      utm_campaign: campaign.utm_campaign ?? null,
      click_id: campaign.click_id === "gclid" || campaign.gclid ? "gclid" : campaign.click_id === "fbclid" || campaign.fbclid ? "fbclid" : null,
      referrer_host: campaign.referrer ?? null,
    }),
    landing: campaign.landing_page ?? null,
    device: campaign.device ?? null,
    open: r.status !== "done",
    ageHours: Math.max(0, (now - new Date(r.created_at).getTime()) / 3_600_000),
  };
}

export const QUICK_FILTERS = [
  { key: "all", label: "All" },
  { key: "new", label: "New" },
  { key: "today", label: "Today" },
  { key: "booking", label: "Bookings" },
  { key: "quote", label: "Quotes" },
  { key: "open", label: "Open" },
  { key: "done", label: "Done" },
  { key: "sector-18", label: "Sector 18" },
  { key: "household", label: "Household" },
  { key: "paid-social", label: "Paid Social" },
  { key: "organic", label: "Organic" },
  { key: "direct", label: "Direct" },
] as const;

export type QuickFilter = (typeof QUICK_FILTERS)[number]["key"];

const DAY_MS = 24 * 60 * 60 * 1000;
const dhakaDay = (t: number) => new Date(t + 6 * 60 * 60 * 1000).toISOString().slice(0, 10);

/** "New" = still open in Ops and less than 24 hours old. */
export function matchesQuickFilter(i: RequestInsight, filter: string, now = Date.now()): boolean {
  switch (filter) {
    case "new":
      return i.open && i.ageHours < 24;
    case "today":
      return dhakaDay(new Date(i.request.created_at).getTime()) === dhakaDay(now);
    case "booking":
      return i.kind === "booking";
    case "quote":
      return i.kind === "quote";
    case "open":
      return i.open;
    case "done":
      return !i.open;
    case "sector-18":
      return i.sector === 18 || i.outlet === "RUAP";
    case "household":
      return i.household;
    case "paid-social":
      return i.channel === "meta_ads";
    case "organic":
      return i.channel === "google_organic";
    case "direct":
      return i.channel === "direct";
    default:
      return true;
  }
}

function tally(items: RequestInsight[], key: (i: RequestInsight) => string | null) {
  const map = new Map<string, number>();
  for (const i of items) {
    const k = key(i) ?? "Not recorded";
    map.set(k, (map.get(k) ?? 0) + 1);
  }
  return [...map.entries()].sort((a, b) => b[1] - a[1]).map(([label, count]) => ({ label, count }));
}

export function requestSummary(items: RequestInsight[], now = Date.now()) {
  const within = (ms: number) => items.filter((i) => now - new Date(i.request.created_at).getTime() < ms);
  const today = items.filter((i) => matchesQuickFilter(i, "today", now));
  const open = items.filter((i) => i.open);
  return {
    today: today.length,
    last7: within(7 * DAY_MS).length,
    last30: within(30 * DAY_MS).length,
    bookings: items.filter((i) => i.kind === "booking").length,
    quotes: items.filter((i) => i.kind === "quote").length,
    open: open.length,
    openOver24h: open.filter((i) => i.ageHours >= 24).length,
    oldestOpenHours: open.length ? Math.max(...open.map((i) => i.ageHours)) : null,
    byService: tally(items, (i) => i.service),
    byArea: tally(items, (i) => i.area),
    byChannel: tally(items, (i) => CHANNEL_LABELS[i.channel]),
    byLanding: tally(items, (i) => i.landing),
    byDevice: tally(items, (i) => i.device),
  };
}

export function formatAge(hours: number) {
  if (hours < 1) return `${Math.max(1, Math.round(hours * 60))} min`;
  if (hours < 48) return `${Math.round(hours)} h`;
  return `${Math.round(hours / 24)} days`;
}

/** Right-now counts for the overview "Today" strip (independent of any date range). */
export function todaySummary(requests: WebsiteRequest[], now = Date.now()) {
  const insights = requests.map((r) => analyseRequest(r, now));
  const summary = requestSummary(insights, now);
  return {
    newOpen: insights.filter((i) => matchesQuickFilter(i, "new", now)).length,
    openOver24h: summary.openOver24h,
    oldestOpenHours: summary.oldestOpenHours,
  };
}
