import "server-only";

/**
 * Synthetic revenue-attribution data for the local dashboard preview ONLY
 * (VELTO_ADMIN_PREVIEW=1 under `next dev`, see ./preview.ts). Deterministic.
 * Never used on a deployed site.
 */
import type { ReviewItem } from "./revenue-data";
import type { ConversionRow, LeadRow, SpendRow, Totals } from "./revenue";
import { dhakaDay } from "./insights";

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
const pick = <T,>(r: () => number, xs: readonly T[]) => xs[Math.floor(r() * xs.length)];

const CAMPAIGNS = [
  { source: "facebook", medium: "paid_social", campaign: "curtain_sep26", weight: 5 },
  { source: "instagram", medium: "paid_social", campaign: "drycleaning_puja26", weight: 4 },
  { source: "google", medium: "cpc", campaign: "uttara_laundry", weight: 3 },
  { source: "whatsapp", medium: "share", campaign: "regulars_sep26", weight: 2 },
  { source: null, medium: null, campaign: null, weight: 6 },
] as const;
const SERVICES = ["dry-cleaning", "wash-and-iron", "ironing", "curtain-cleaning", "carpet-cleaning", "blanket-comforter-cleaning"];

type Fixture = { conversions: ConversionRow[]; leads: LeadRow[]; spend: SpendRow[]; review: ReviewItem[] };
let cache: Fixture | undefined;

function build(): Fixture {
  const r = prng(99);
  const today = new Date();
  const dayStr = (ago: number) => dhakaDay(new Date(today.getTime() - ago * 86_400_000));
  const conversions: ConversionRow[] = [];
  const leads: LeadRow[] = [];
  const spend: SpendRow[] = [];
  let n = 0;
  for (let ago = 150; ago >= 0; ago--) {
    const perDay = 1 + Math.floor(r() * 3);
    for (let i = 0; i < perDay; i++) {
      const total = CAMPAIGNS.reduce((a, c) => a + c.weight, 0);
      let x = r() * total;
      const c = CAMPAIGNS.find((cc) => (x -= cc.weight) <= 0) ?? CAMPAIGNS[4];
      const organicRef = c.campaign ? null : pick(r, [null, "www.google.com", "l.facebook.com"]);
      const kind = r() < 0.3 ? "quote" : "booking";
      const service = kind === "quote" ? pick(r, SERVICES.slice(3)) : pick(r, SERVICES.slice(0, 3));
      const id = `lead-${++n}`;
      const identified = r() < 0.72;
      const converted = identified && r() < 0.78;
      const late = converted && kind === "booking" && r() < 0.08;
      const created = new Date(today.getTime() - ago * 86_400_000).toISOString();
      const mismatch = identified && r() < 0.05;
      leads.push({
        lead_id: id, created_at: created, kind, service,
        utm_source: c.source, utm_medium: c.medium, utm_campaign: c.campaign, source: null, campaign: null,
        referrer_host: organicRef, click_id: c.source === "facebook" ? "fbclid" : c.source === "google" ? "gclid" : null,
        ft_at: null, ft_utm_source: null, ft_utm_medium: null, ft_utm_campaign: null, ft_referrer_host: null, ft_click_id: null,
        link_method: identified ? "exact_phone" : null, window_kind: identified ? (converted ? (late ? "late" : "primary") : ago > 14 ? "none" : "pending") : null,
        link_status: identified ? "active" : null, name_mismatch: mismatch, conflict: null, has_order: converted,
      });
      if (!converted) continue;
      const orderAgo = Math.max(0, ago - Math.floor(r() * (late ? 12 : 5)) - (late ? 8 : 0));
      const cls = r() < 0.64 ? "acquired" : r() < 0.5 ? "reactivated" : "existing";
      const first = Math.round((kind === "quote" ? 1800 + r() * 3500 : 450 + r() * 1400) / 10) * 10;
      const repeats = r() < 0.46 ? 1 + Math.floor(r() * 4) : 0;
      const gaps = Array.from({ length: repeats }, (_, j) => (j + 1) * (9 + Math.floor(r() * 20)));
      const amount = (d: number) => gaps.filter((g) => g < d).length * Math.round((350 + r() * 900) / 10) * 10;
      const age = orderAgo;
      const within = (d: number) => (age >= d ? first + amount(d) : null);
      const life = first + gaps.filter((g) => g <= age).length * 700;
      const paidShare = 0.85 + r() * 0.15;
      conversions.push({
        link_id: `link-${n}`, lead_id: id, lead_kind: kind, lead_created_at: created, service, device: r() < 0.75 ? "mobile" : "desktop",
        consent: "analytics+marketing", link_method: r() < 0.15 ? "staff_order_link" : "exact_phone", window_kind: late ? "late" : "primary",
        link_status: "active", name_mismatch: mismatch, conflict: null, customer_id: `cust-${n}`, customer_ref: `C-${1000 + n}`,
        order_id: `order-${n}`, order_number: `VEL-${String(20000 + n)}`, order_date: dayStr(orderAgo), classification: cls,
        utm_source: c.source, utm_medium: c.medium, utm_campaign: c.campaign, utm_content: null, source: null, campaign: null,
        landing_page: c.campaign ? `/services/${service}` : "/", referrer_host: organicRef, click_id: null,
        ft_at: null, ft_utm_source: null, ft_utm_medium: null, ft_utm_campaign: null, ft_utm_content: null, ft_referrer_host: null, ft_click_id: null,
        first_billed: first, first_collected: Math.round(first * paidShare),
        billed_30: within(30), billed_60: within(60), billed_90: within(90), billed_life: life,
        collected_30: within(30) === null ? null : Math.round((within(30) ?? 0) * paidShare),
        collected_60: within(60) === null ? null : Math.round((within(60) ?? 0) * paidShare),
        collected_90: within(90) === null ? null : Math.round((within(90) ?? 0) * paidShare),
        collected_life: Math.round(life * paidShare),
        matured_30: age >= 30, matured_60: age >= 60, matured_90: age >= 90,
        order_count: 1 + gaps.filter((g) => g <= age).length, repeat_customer: gaps.some((g) => g <= age),
        days_to_second: gaps[0] !== undefined && gaps[0] <= age ? gaps[0] : null,
        repeat_30: age >= 30 ? gaps.some((g) => g < 30) : null,
        repeat_60: age >= 60 ? gaps.some((g) => g < 60) : null,
        repeat_90: age >= 90 ? gaps.some((g) => g < 90) : null,
      });
    }
  }
  const spendPlan: [string, string, string, number][] = [
    ["facebook", "paid_social", "curtain_sep26", 900],
    ["instagram", "paid_social", "drycleaning_puja26", 650],
    ["google", "cpc", "uttara_laundry", 520],
    ["facebook", "paid_social", "brand_awareness_sep", 300],
  ];
  let s = 0;
  for (let ago = 150; ago >= 0; ago -= 1) {
    for (const [platform, medium, campaign, daily] of spendPlan) {
      if (campaign === "brand_awareness_sep" && ago > 40) continue;
      spend.push({
        id: `00000000-0000-4000-8000-${String(++s).padStart(12, "0")}`, spend_date: dayStr(ago), platform, medium, campaign_name: campaign,
        campaign_id: null, adset_name: null, adset_id: null, ad_name: null, ad_id: null,
        spend: Math.round(daily * (0.7 + r() * 0.6)), currency: "BDT", spend_bdt: 0, notes: null, import_source: ago % 7 === 0 ? "csv" : "manual",
        created_at: new Date().toISOString(), created_by: "Preview admin", updated_at: null, updated_by: null,
      });
      spend[spend.length - 1].spend_bdt = spend[spend.length - 1].spend;
    }
  }
  const review: ReviewItem[] = [
    { issue: "name_mismatch", link_id: "00000000-0000-4000-8000-00000000a001", lead_id: "lead-3", lead_reference: "WEB-3F9A21C0", lead_kind: "booking", lead_created_at: new Date(today.getTime() - 3 * 86_400_000).toISOString(), link_method: "exact_phone", link_status: "active", customer_ref: "C-1003", order_number: "VEL-20003", staff_order_number: null, detail: null },
    { issue: "staff_link_other_customer", link_id: "00000000-0000-4000-8000-00000000a002", lead_id: "lead-8", lead_reference: "WEB-9C01D7E2", lead_kind: "quote", lead_created_at: new Date(today.getTime() - 9 * 86_400_000).toISOString(), link_method: "staff_order_link", link_status: "active", customer_ref: "C-1008", order_number: "VEL-20008", staff_order_number: "VEL-20008", detail: null },
    { issue: "staff_order_not_found", link_id: null, lead_id: "lead-12", lead_reference: "WEB-11AB44F9", lead_kind: "booking", lead_created_at: new Date(today.getTime() - 12 * 86_400_000).toISOString(), link_method: null, link_status: null, customer_ref: null, order_number: null, staff_order_number: "VEL-2O011", detail: null },
    { issue: "unresolved_lead", link_id: null, lead_id: "lead-20", lead_reference: "WEB-7E2C90B1", lead_kind: "booking", lead_created_at: new Date(today.getTime() - 22 * 86_400_000).toISOString(), link_method: null, link_status: null, customer_ref: null, order_number: null, staff_order_number: null, detail: "no_customer_with_this_phone" },
  ];
  return { conversions, leads, spend, review };
}

export function previewRevenue(from: string, to: string): Fixture & { totals: Totals } {
  cache ??= build();
  const inRange = (d: string) => d >= from && d <= to;
  const conversions = cache.conversions.filter((c) => inRange(c.order_date));
  const leads = cache.leads.filter((l) => inRange(dhakaDay(new Date(l.created_at))));
  const spend = cache.spend.filter((s) => inRange(s.spend_date));
  const primary = conversions.filter((c) => c.window_kind !== "late");
  const late = conversions.filter((c) => c.window_kind === "late");
  const conversionBilled = primary.reduce((a, c) => a + Number(c.first_billed), 0);
  const followOnOrders = primary.reduce((a, c) => a + Math.max(0, c.order_count - 1), 0);
  const followOnBilled = primary.reduce((a, c) => a + Number(c.billed_life) - Number(c.first_billed), 0);
  const unattributedOrders = Math.round((primary.length + followOnOrders) * 3.1) + 12;
  const unattributedBilled = unattributedOrders * 780;
  const lateBilled = late.reduce((a, c) => a + Number(c.first_billed), 0);
  const orders = primary.length + followOnOrders + late.length + unattributedOrders;
  const billed = conversionBilled + followOnBilled + lateBilled + unattributedBilled;
  const acquired = primary.filter((c) => c.classification === "acquired").length;
  return {
    ...cache,
    conversions,
    leads,
    spend,
    totals: {
      orders, billed, collected: Math.round(billed * 0.93), customers: Math.round(orders * 0.62), orders_without_customer: 2,
      conversion_orders: primary.length, conversion_billed: conversionBilled, late_orders: late.length, late_billed: lateBilled,
      follow_on_orders: followOnOrders, follow_on_billed: followOnBilled, unattributed_orders: unattributedOrders, unattributed_billed: unattributedBilled,
      attributed_collected: Math.round((conversionBilled + followOnBilled) * 0.92), attributed_customers: primary.length,
      new_customers: acquired + Math.round(unattributedOrders * 0.3), attributed_new_customers: acquired,
      new_customer_billed: 0, attributed_new_customer_billed: 0,
    },
  };
}
