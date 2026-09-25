/**
 * Revenue attribution reporting (V1): pure aggregation over the rows returned
 * by website_attribution_conversions / _leads / _totals and the spend ledger.
 * Runtime-neutral and deterministic, so it is unit-tested directly.
 *
 * Honesty rules enforced here:
 * - a ratio with no denominator is null ("—"), never 0;
 * - CAC / ROAS without recorded spend are null ("Spend not recorded");
 * - a 30/60/90-day value is only reported once every conversion in the group
 *   has matured; otherwise the group is "pending" (never "0 at 30 days");
 * - late booking conversions (day 8–14) are reported separately, never mixed
 *   into primary attribution.
 */
import { CHANNEL_LABELS, classifyChannel, type Channel } from "../analytics/classify";

export type Classification = "acquired" | "reactivated" | "existing";
export type WindowKind = "explicit" | "primary" | "late";

export type ConversionRow = {
  link_id: string;
  lead_id: string;
  lead_kind: "booking" | "quote";
  lead_created_at: string;
  service: string | null;
  device: string | null;
  consent: string;
  link_method: "staff_order_link" | "exact_phone" | "whatsapp_reference";
  window_kind: WindowKind;
  link_status: "active" | "confirmed";
  name_mismatch: boolean;
  conflict: string | null;
  customer_id: string;
  customer_ref: string | null;
  order_id: string;
  order_number: string;
  order_date: string;
  classification: Classification;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  source: string | null;
  campaign: string | null;
  landing_page: string | null;
  referrer_host: string | null;
  click_id: string | null;
  ft_at: string | null;
  ft_utm_source: string | null;
  ft_utm_medium: string | null;
  ft_utm_campaign: string | null;
  ft_utm_content: string | null;
  ft_referrer_host: string | null;
  ft_click_id: string | null;
  first_billed: number | string;
  first_collected: number | string;
  billed_30: number | string | null;
  billed_60: number | string | null;
  billed_90: number | string | null;
  billed_life: number | string;
  collected_30: number | string | null;
  collected_60: number | string | null;
  collected_90: number | string | null;
  collected_life: number | string;
  matured_30: boolean;
  matured_60: boolean;
  matured_90: boolean;
  order_count: number;
  repeat_customer: boolean;
  days_to_second: number | null;
  repeat_30: boolean | null;
  repeat_60: boolean | null;
  repeat_90: boolean | null;
};

export type LeadRow = {
  lead_id: string;
  created_at: string;
  kind: "booking" | "quote";
  service: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  source: string | null;
  campaign: string | null;
  referrer_host: string | null;
  click_id: string | null;
  ft_at: string | null;
  ft_utm_source: string | null;
  ft_utm_medium: string | null;
  ft_utm_campaign: string | null;
  ft_referrer_host: string | null;
  ft_click_id: string | null;
  link_method: string | null;
  window_kind: string | null;
  link_status: string | null;
  name_mismatch: boolean;
  conflict: string | null;
  has_order: boolean;
};

export type SpendRow = {
  id: string;
  spend_date: string;
  platform: string;
  medium: string | null;
  campaign_name: string;
  campaign_id: string | null;
  adset_name: string | null;
  adset_id: string | null;
  ad_name: string | null;
  ad_id: string | null;
  spend: number | string;
  currency: string;
  spend_bdt: number | string;
  notes: string | null;
  import_source: string;
  created_at: string;
  created_by: string;
  updated_at: string | null;
  updated_by: string | null;
};

export type Totals = {
  orders: number;
  billed: number;
  collected: number;
  customers: number;
  orders_without_customer: number;
  conversion_orders: number;
  conversion_billed: number;
  late_orders: number;
  late_billed: number;
  follow_on_orders: number;
  follow_on_billed: number;
  unattributed_orders: number;
  unattributed_billed: number;
  attributed_collected: number;
  attributed_customers: number;
  new_customers: number;
  attributed_new_customers: number;
  new_customer_billed: number;
  attributed_new_customer_billed: number;
};

const num = (v: number | string | null | undefined) => (v === null || v === undefined || v === "" ? 0 : Number(v));
export const ratio = (a: number, b: number): number | null => (b > 0 ? a / b : null);

/* ---------------------------------------------------------- touch model */

export type Touch = {
  model: "first_touch" | "last_touch";
  source: string | null;
  medium: string | null;
  campaign: string | null;
  content: string | null;
  channel: Channel;
};

type TouchFields = Pick<
  ConversionRow,
  | "utm_source" | "utm_medium" | "utm_campaign" | "source" | "campaign" | "referrer_host" | "click_id"
  | "ft_at" | "ft_utm_source" | "ft_utm_medium" | "ft_utm_campaign" | "ft_referrer_host" | "ft_click_id"
> & { utm_content?: string | null; ft_utm_content?: string | null };

/**
 * Acquisition touch: the visitor's first first-party session (needs Analytics
 * consent and ≤ 90-day retention) when known, otherwise the campaign sent with
 * the booking/quote itself. Legacy `campaign`/`source` params back-fill UTMs.
 */
export function acquisitionTouch(r: TouchFields): Touch {
  if (r.ft_at) {
    return {
      model: "first_touch",
      source: r.ft_utm_source,
      medium: r.ft_utm_medium,
      campaign: r.ft_utm_campaign,
      content: r.ft_utm_content ?? null,
      channel: classifyChannel({ utm_source: r.ft_utm_source, utm_medium: r.ft_utm_medium, referrer_host: r.ft_referrer_host, click_id: r.ft_click_id }),
    };
  }
  const source = r.utm_source ?? r.source;
  return {
    model: "last_touch",
    source,
    medium: r.utm_medium,
    campaign: r.utm_campaign ?? r.campaign,
    content: r.utm_content ?? null,
    channel: classifyChannel({ utm_source: source, utm_medium: r.utm_medium, referrer_host: r.referrer_host, click_id: r.click_id }),
  };
}

/** Campaign grouping key: case-insensitive campaign name, or the channel when no campaign was tagged. */
export const campaignKey = (t: Pick<Touch, "campaign" | "channel">) =>
  t.campaign ? `c:${t.campaign.trim().toLowerCase()}` : `ch:${t.channel}`;

export const campaignLabel = (t: Pick<Touch, "campaign" | "channel">) => t.campaign ?? `(no campaign) · ${CHANNEL_LABELS[t.channel]}`;

/* ------------------------------------------------------------- filters */

export type RevenueFilter = { source?: string; campaign?: string; service?: string; type?: string };

export function filterConversions(rows: ConversionRow[], f: RevenueFilter) {
  return rows.filter((r) => {
    const t = acquisitionTouch(r);
    if (f.source && (t.source ?? "").toLowerCase() !== f.source.toLowerCase() && t.channel !== f.source) return false;
    if (f.campaign && campaignKey(t) !== f.campaign) return false;
    if (f.service && r.service !== f.service) return false;
    if (f.type && r.classification !== f.type) return false;
    return true;
  });
}

export function filterLeads(rows: LeadRow[], f: RevenueFilter) {
  return rows.filter((r) => {
    const t = acquisitionTouch({ ...r, utm_content: null, ft_utm_content: null });
    if (f.source && (t.source ?? "").toLowerCase() !== f.source.toLowerCase() && t.channel !== f.source) return false;
    if (f.campaign && campaignKey(t) !== f.campaign) return false;
    if (f.service && r.service !== f.service) return false;
    return true;
  });
}

export function filterSpend(rows: SpendRow[], f: RevenueFilter) {
  return rows.filter((s) => {
    if (f.source && s.platform.toLowerCase() !== f.source.toLowerCase()) return false;
    if (f.campaign && `c:${s.campaign_name.trim().toLowerCase()}` !== f.campaign) return false;
    return true;
  });
}

/* ------------------------------------------------------------ windows */

export type Windowed = { value: number | null; pending: number; matured: number };

/** Sum a 30/60/90-day metric only when every row has matured; otherwise report it as pending. */
export function windowSum(rows: ConversionRow[], key: "billed_30" | "billed_60" | "billed_90" | "collected_30" | "collected_60" | "collected_90") {
  const days = key.endsWith("30") ? "matured_30" : key.endsWith("60") ? "matured_60" : "matured_90";
  const matured = rows.filter((r) => r[days]);
  const pending = rows.length - matured.length;
  return {
    value: rows.length && pending === 0 ? matured.reduce((a, r) => a + num(r[key]), 0) : null,
    pending,
    matured: matured.length,
  } satisfies Windowed;
}

/* ------------------------------------------------------------ summary */

export type Summary = {
  conversions: number;
  late: number;
  acquired: number;
  reactivated: number;
  existing: number;
  repeatCustomers: number;
  firstBilled: number;
  firstCollected: number;
  lifetimeBilled: number;
  lifetimeCollected: number;
  billed30: Windowed;
  billed60: Windowed;
  billed90: Windowed;
  spend: number | null;
  cac: number | null;
  firstOrderRoas: number | null;
  roas30: number | null;
  roas60: number | null;
  roas90: number | null;
  lifetimeRoas: number | null;
  collectedRoas: number | null;
  repeatRate: number | null;
};

/**
 * Primary attribution = explicit + primary windows. Late conversions are
 * counted separately. CAC divides spend by ACQUIRED customers only.
 */
export function summarize(all: ConversionRow[], spendRows: SpendRow[]): Summary {
  const rows = all.filter((r) => r.window_kind !== "late");
  const acquired = rows.filter((r) => r.classification === "acquired");
  const spend = spendRows.length ? spendRows.reduce((a, s) => a + num(s.spend_bdt), 0) : null;
  const firstBilled = rows.reduce((a, r) => a + num(r.first_billed), 0);
  const lifetimeBilled = rows.reduce((a, r) => a + num(r.billed_life), 0);
  const lifetimeCollected = rows.reduce((a, r) => a + num(r.collected_life), 0);
  const b30 = windowSum(rows, "billed_30");
  const b60 = windowSum(rows, "billed_60");
  const b90 = windowSum(rows, "billed_90");
  const per = (v: number | null) => (spend !== null && v !== null ? ratio(v, spend) : null);
  return {
    conversions: rows.length,
    late: all.length - rows.length,
    acquired: acquired.length,
    reactivated: rows.filter((r) => r.classification === "reactivated").length,
    existing: rows.filter((r) => r.classification === "existing").length,
    repeatCustomers: rows.filter((r) => r.repeat_customer).length,
    firstBilled,
    firstCollected: rows.reduce((a, r) => a + num(r.first_collected), 0),
    lifetimeBilled,
    lifetimeCollected,
    billed30: b30,
    billed60: b60,
    billed90: b90,
    spend,
    cac: spend !== null && acquired.length ? spend / acquired.length : null,
    firstOrderRoas: per(firstBilled),
    roas30: per(b30.value),
    roas60: per(b60.value),
    roas90: per(b90.value),
    lifetimeRoas: per(lifetimeBilled),
    collectedRoas: per(lifetimeCollected),
    repeatRate: ratio(rows.filter((r) => r.repeat_customer).length, rows.length),
  };
}

/* ------------------------------------------------------ campaign table */

export type CampaignRow = Summary & {
  key: string;
  label: string;
  sources: string[];
  leads: number;
  identifiedLeads: number;
  /** Share of this row's leads matched to an Ops customer. */
  coverage: number | null;
};

export function campaignTable(conversions: ConversionRow[], leads: LeadRow[], spend: SpendRow[]): CampaignRow[] {
  const groups = new Map<string, { label: string; sources: Set<string>; conv: ConversionRow[]; leads: LeadRow[]; spend: SpendRow[] }>();
  const group = (key: string, label: string) => {
    let g = groups.get(key);
    if (!g) {
      g = { label, sources: new Set(), conv: [], leads: [], spend: [] };
      groups.set(key, g);
    }
    return g;
  };
  for (const r of conversions) {
    const t = acquisitionTouch(r);
    const g = group(campaignKey(t), campaignLabel(t));
    g.conv.push(r);
    if (t.source) g.sources.add(t.source.toLowerCase());
  }
  for (const l of leads) {
    const t = acquisitionTouch({ ...l, utm_content: null, ft_utm_content: null });
    const g = group(campaignKey(t), campaignLabel(t));
    g.leads.push(l);
    if (t.source) g.sources.add(t.source.toLowerCase());
  }
  for (const s of spend) {
    const g = group(`c:${s.campaign_name.trim().toLowerCase()}`, s.campaign_name);
    g.spend.push(s);
    g.sources.add(s.platform.toLowerCase());
  }
  return [...groups.entries()]
    .map(([key, g]) => {
      const identified = g.leads.filter((l) => l.link_status).length;
      return {
        ...summarize(g.conv, g.spend),
        key,
        label: g.label,
        sources: [...g.sources].sort(),
        leads: g.leads.length,
        identifiedLeads: identified,
        coverage: ratio(identified, g.leads.length),
      };
    })
    .sort((a, b) => (b.spend ?? 0) - (a.spend ?? 0) || b.lifetimeBilled - a.lifetimeBilled || b.leads - a.leads);
}

/* ------------------------------------------------------------ coverage */

export type Coverage = {
  orders: number;
  billed: number;
  attributedOrders: number;
  attributedBilled: number;
  lateOrders: number;
  lateBilled: number;
  unattributedOrders: number;
  unattributedBilled: number;
  reconciles: boolean;
  revenueCoverage: number | null;
  newCustomers: number;
  attributedNewCustomers: number;
  newCustomerCoverage: number | null;
  ordersWithoutCustomer: number;
};

/** Every eligible order is exactly one of attributed (conversion/follow-on), late, or unattributed. */
export function coverage(t: Totals): Coverage {
  const n = (k: keyof Totals) => num(t[k] as number);
  const attributedOrders = n("conversion_orders") + n("follow_on_orders");
  const attributedBilled = n("conversion_billed") + n("follow_on_billed");
  const reconciles =
    attributedOrders + n("late_orders") + n("unattributed_orders") === n("orders") &&
    Math.abs(attributedBilled + n("late_billed") + n("unattributed_billed") - n("billed")) < 0.005;
  return {
    orders: n("orders"),
    billed: n("billed"),
    attributedOrders,
    attributedBilled,
    lateOrders: n("late_orders"),
    lateBilled: n("late_billed"),
    unattributedOrders: n("unattributed_orders"),
    unattributedBilled: n("unattributed_billed"),
    reconciles,
    revenueCoverage: ratio(attributedBilled, n("billed")),
    newCustomers: n("new_customers"),
    attributedNewCustomers: n("attributed_new_customers"),
    newCustomerCoverage: ratio(n("attributed_new_customers"), n("new_customers")),
    ordersWithoutCustomer: n("orders_without_customer"),
  };
}

/* ------------------------------------------------------------ spend CSV */

export const SPEND_CSV_COLUMNS = [
  "date", "platform", "medium", "campaign_name", "campaign_id", "adset_name", "adset_id",
  "ad_name", "ad_id", "spend", "currency", "spend_bdt", "notes",
] as const;

export type SpendInput = {
  spend_date: string;
  platform: string;
  medium: string | null;
  campaign_name: string;
  campaign_id: string | null;
  adset_name: string | null;
  adset_id: string | null;
  ad_name: string | null;
  ad_id: string | null;
  spend: number;
  currency: string;
  spend_bdt: number;
  notes: string | null;
};

const opt = (v: unknown, max: number) => {
  const s = typeof v === "string" ? v.trim() : "";
  return s && !/[\u0000-\u001f\u007f]/.test(s) ? s.slice(0, max) : null;
};

/** Validate one spend entry (form or CSV row). Returns the clean row or an error message. */
export function validateSpend(raw: Record<string, unknown>): { ok: true; value: SpendInput } | { ok: false; error: string } {
  const date = opt(raw.date ?? raw.spend_date, 10);
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(`${date}T00:00:00Z`))) return { ok: false, error: "Date must be YYYY-MM-DD." };
  const platform = opt(raw.platform, 40)?.toLowerCase();
  if (!platform || !/^[a-z0-9][a-z0-9_ .-]{0,39}$/.test(platform)) return { ok: false, error: "Platform is required (e.g. facebook, instagram, google)." };
  const campaign = opt(raw.campaign_name, 160);
  if (!campaign) return { ok: false, error: "Campaign name is required." };
  const spendText = String(raw.spend ?? "").replace(/,/g, "").trim();
  const spend = Number(spendText);
  if (!spendText || !Number.isFinite(spend) || spend < 0 || spend > 1e10) return { ok: false, error: "Spend must be a positive number." };
  const currency = (opt(raw.currency, 3) ?? "BDT").toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) return { ok: false, error: "Currency must be a 3-letter code." };
  let spendBdt = spend;
  if (currency !== "BDT") {
    const bdt = String(raw.spend_bdt ?? "").replace(/,/g, "").trim();
    spendBdt = Number(bdt);
    if (!bdt || !Number.isFinite(spendBdt) || spendBdt < 0) return { ok: false, error: "Non-BDT spend needs the BDT amount (spend_bdt)." };
  }
  const round = (v: number) => Math.round(v * 100) / 100;
  return {
    ok: true,
    value: {
      spend_date: date,
      platform,
      medium: opt(raw.medium, 60),
      campaign_name: campaign,
      campaign_id: opt(raw.campaign_id, 80),
      adset_name: opt(raw.adset_name, 160),
      adset_id: opt(raw.adset_id, 80),
      ad_name: opt(raw.ad_name, 160),
      ad_id: opt(raw.ad_id, 80),
      spend: round(spend),
      currency,
      spend_bdt: round(spendBdt),
      notes: opt(raw.notes, 500),
    },
  };
}

/** Natural key used for duplicate detection (mirrors website_spend_natural_uidx). */
export const spendKey = (s: Pick<SpendInput, "spend_date" | "platform" | "campaign_name" | "adset_id" | "adset_name" | "ad_id" | "ad_name">) =>
  [s.spend_date, s.platform.toLowerCase(), s.campaign_name.toLowerCase(), (s.adset_id ?? s.adset_name ?? "").toLowerCase(), (s.ad_id ?? s.ad_name ?? "").toLowerCase()].join("|");

/** Minimal RFC 4180 CSV parser (quoted fields, escaped quotes, CRLF). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"' && field === "") quoted = true;
    else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      if (row.some((c) => c.trim() !== "")) rows.push(row);
      row = [];
      field = "";
    } else field += ch;
  }
  row.push(field);
  if (row.some((c) => c.trim() !== "")) rows.push(row);
  return rows;
}

export type CsvPreview = {
  rows: { line: number; value?: SpendInput; error?: string; duplicate?: "file" | "existing" }[];
  valid: SpendInput[];
  headerError?: string;
};

/** Validate a spend CSV: required columns, each row, duplicates within the file and against existing rows. */
export function previewSpendCsv(text: string, existingKeys: Set<string>, maxRows = 1000): CsvPreview {
  const table = parseCsv(text.replace(/^﻿/, ""));
  if (!table.length) return { rows: [], valid: [], headerError: "The file is empty." };
  const header = table[0].map((h) => h.trim().toLowerCase());
  const missing = ["date", "platform", "campaign_name", "spend"].filter((c) => !header.includes(c));
  if (missing.length) return { rows: [], valid: [], headerError: `Missing column${missing.length > 1 ? "s" : ""}: ${missing.join(", ")}.` };
  const unknown = header.filter((h) => h && !(SPEND_CSV_COLUMNS as readonly string[]).includes(h));
  if (unknown.length) return { rows: [], valid: [], headerError: `Unknown column${unknown.length > 1 ? "s" : ""}: ${unknown.join(", ")}.` };
  if (table.length - 1 > maxRows) return { rows: [], valid: [], headerError: `Up to ${maxRows} rows per import.` };

  const seen = new Set<string>();
  const out: CsvPreview = { rows: [], valid: [] };
  table.slice(1).forEach((cells, i) => {
    const raw = Object.fromEntries(header.map((h, j) => [h, cells[j] ?? ""]));
    const v = validateSpend(raw);
    const line = i + 2;
    if (!v.ok) {
      out.rows.push({ line, error: v.error });
      return;
    }
    const key = spendKey(v.value);
    if (seen.has(key)) out.rows.push({ line, value: v.value, duplicate: "file" });
    else if (existingKeys.has(key)) out.rows.push({ line, value: v.value, duplicate: "existing" });
    else {
      out.rows.push({ line, value: v.value });
      out.valid.push(v.value);
    }
    seen.add(key);
  });
  return out;
}

/* ------------------------------------------------------- paid rollup */

export type PaidTotals = {
  spend: number | null;
  acquired: number;
  cac: number | null;
  firstOrderRoas: number | null;
  roas30: number | null;
  roas30Pending: boolean;
  lifetimeRoas: number | null;
  collectedRoas: number | null;
  campaignsWithSpend: number;
};

/**
 * Top-level CAC / ROAS use ONLY campaigns with recorded spend, so organic
 * acquisitions are never counted against ad spend.
 */
export function paidTotals(rows: CampaignRow[]): PaidTotals {
  const paid = rows.filter((r) => r.spend !== null);
  if (!paid.length) {
    return { spend: null, acquired: 0, cac: null, firstOrderRoas: null, roas30: null, roas30Pending: false, lifetimeRoas: null, collectedRoas: null, campaignsWithSpend: 0 };
  }
  const spend = paid.reduce((a, r) => a + (r.spend ?? 0), 0);
  const acquired = paid.reduce((a, r) => a + r.acquired, 0);
  const pending = paid.some((r) => r.billed30.pending > 0);
  const b30 = paid.reduce((a, r) => a + (r.billed30.value ?? 0), 0);
  return {
    spend,
    acquired,
    cac: acquired ? spend / acquired : null,
    firstOrderRoas: ratio(paid.reduce((a, r) => a + r.firstBilled, 0), spend),
    roas30: pending ? null : ratio(b30, spend),
    roas30Pending: pending,
    lifetimeRoas: ratio(paid.reduce((a, r) => a + r.lifetimeBilled, 0), spend),
    collectedRoas: ratio(paid.reduce((a, r) => a + r.lifetimeCollected, 0), spend),
    campaignsWithSpend: paid.length,
  };
}
