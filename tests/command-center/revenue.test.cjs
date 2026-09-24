/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");
const test = require("node:test");

const build = "../../.command-center-test-build";
const rev = require(`${build}/lib/admin/revenue.js`);
const { readSubmissionAttribution, readAttribution } = require(`${build}/lib/attribution.js`);

const conv = (over) => ({
  link_id: "k", lead_id: "l", lead_kind: "booking", lead_created_at: "2026-08-01T00:00:00Z", service: "dry-cleaning", device: "mobile",
  consent: "analytics+marketing", link_method: "exact_phone", window_kind: "primary", link_status: "active", name_mismatch: false, conflict: null,
  customer_id: "c", customer_ref: "C-1", order_id: "o", order_number: "VEL-1", order_date: "2026-08-02", classification: "acquired",
  utm_source: "facebook", utm_medium: "paid_social", utm_campaign: "curtain_sep26", utm_content: null, source: null, campaign: null,
  landing_page: "/", referrer_host: null, click_id: null, ft_at: null, ft_utm_source: null, ft_utm_medium: null, ft_utm_campaign: null,
  ft_utm_content: null, ft_referrer_host: null, ft_click_id: null,
  first_billed: "1000.00", first_collected: "800.00", billed_30: "1500.00", billed_60: null, billed_90: null, billed_life: "1500.00",
  collected_30: "1300.00", collected_60: null, collected_90: null, collected_life: "1300.00",
  matured_30: true, matured_60: false, matured_90: false, order_count: 2, repeat_customer: true, days_to_second: 17,
  repeat_30: true, repeat_60: null, repeat_90: null, ...over,
});
const spend = (over) => ({ id: "s", spend_date: "2026-08-01", platform: "facebook", medium: "paid_social", campaign_name: "curtain_sep26", campaign_id: null,
  adset_name: null, adset_id: null, ad_name: null, ad_id: null, spend: "2000.00", currency: "BDT", spend_bdt: "2000.00", notes: null,
  import_source: "manual", created_at: "", created_by: "x", updated_at: null, updated_by: null, ...over });

test("canonical submission contract: allowlist + consent gates", () => {
  const full = readSubmissionAttribution({ utm_campaign: "a", fbclid: "IwAR", analytics_session: "5E551000-0000-4000-8000-000000000001", device: "mobile", consent: "analytics+marketing", referrer: "L.Facebook.com", evil: "x", landing_page: "/x" });
  assert.equal(full.fbclid, "IwAR");
  assert.equal(full.analytics_session, "5e551000-0000-4000-8000-000000000001");
  assert.equal(full.referrer, "l.facebook.com");
  assert.equal(full.device, "mobile");
  assert.equal(full.evil, undefined);
  const essential = readSubmissionAttribution({ utm_campaign: "a", fbclid: "IwAR", gclid: "g", analytics_session: "5e551000-0000-4000-8000-000000000001", consent: "essential" });
  assert.equal(essential.fbclid, undefined);
  assert.equal(essential.gclid, undefined);
  assert.equal(essential.analytics_session, undefined);
  assert.equal(essential.utm_campaign, "a", "campaign tags survive without optional consent");
  assert.equal(readSubmissionAttribution({ consent: "everything" }).consent, "none");
  assert.equal(readSubmissionAttribution({ consent: "analytics", analytics_session: "not-a-uuid" }).analytics_session, undefined);
  assert.equal(readSubmissionAttribution({ device: "phone" }).device, undefined);
  // Site keys can never come from a landing URL.
  const fromUrl = readAttribution(new URLSearchParams("utm_source=x&consent=analytics%2Bmarketing&analytics_session=5e551000-0000-4000-8000-000000000001&device=desktop"));
  assert.equal(fromUrl.consent, undefined);
  assert.equal(fromUrl.analytics_session, undefined);
  assert.equal(fromUrl.device, undefined);
});

test("acquisition touch prefers first touch, falls back to last touch", () => {
  assert.equal(rev.acquisitionTouch(conv({})).model, "last_touch");
  const ft = rev.acquisitionTouch(conv({ ft_at: "2026-07-20T00:00:00Z", ft_utm_source: "google", ft_utm_medium: "cpc", ft_utm_campaign: "uttara" }));
  assert.equal(ft.model, "first_touch");
  assert.equal(ft.campaign, "uttara");
  assert.equal(ft.channel, "google_ads");
});

test("CAC counts acquired customers only; ROAS uses billed revenue", () => {
  const rows = [conv({}), conv({ link_id: "2", classification: "reactivated" }), conv({ link_id: "3", classification: "existing" })];
  const s = rev.summarize(rows, [spend({})]);
  assert.equal(s.acquired, 1);
  assert.equal(s.cac, 2000);
  assert.equal(s.firstOrderRoas, 3000 / 2000);
  assert.equal(s.roas30, 4500 / 2000);
  assert.equal(s.roas60, null, "unmatured 60-day window is pending, not 0");
  assert.equal(s.billed60.pending, 3);
  assert.equal(s.collectedRoas, 3900 / 2000);
});

test("missing spend never becomes zero CAC", () => {
  const s = rev.summarize([conv({})], []);
  assert.equal(s.spend, null);
  assert.equal(s.cac, null);
  assert.equal(s.firstOrderRoas, null);
  const noAcq = rev.summarize([conv({ classification: "existing" })], [spend({})]);
  assert.equal(noAcq.cac, null, "spend with no acquisitions has no CAC");
});

test("late booking conversions are kept out of primary totals", () => {
  const s = rev.summarize([conv({}), conv({ link_id: "late", window_kind: "late" })], []);
  assert.equal(s.conversions, 1);
  assert.equal(s.late, 1);
});

test("30-day window is pending if any conversion is immature", () => {
  const w = rev.windowSum([conv({}), conv({ link_id: "2", matured_30: false, billed_30: null })], "billed_30");
  assert.equal(w.value, null);
  assert.equal(w.pending, 1);
});

test("campaign table joins spend by campaign name and computes lead coverage", () => {
  const leads = [
    { lead_id: "l1", created_at: "", kind: "booking", service: null, utm_source: "facebook", utm_medium: "paid_social", utm_campaign: "Curtain_Sep26", source: null, campaign: null, referrer_host: null, click_id: null, ft_at: null, ft_utm_source: null, ft_utm_medium: null, ft_utm_campaign: null, ft_referrer_host: null, ft_click_id: null, link_method: "exact_phone", window_kind: "primary", link_status: "active", name_mismatch: false, conflict: null, has_order: true },
    { lead_id: "l2", created_at: "", kind: "booking", service: null, utm_source: "facebook", utm_medium: "paid_social", utm_campaign: "curtain_sep26", source: null, campaign: null, referrer_host: null, click_id: null, ft_at: null, ft_utm_source: null, ft_utm_medium: null, ft_utm_campaign: null, ft_referrer_host: null, ft_click_id: null, link_method: null, window_kind: null, link_status: null, name_mismatch: false, conflict: null, has_order: false },
  ];
  const rows = rev.campaignTable([conv({})], leads, [spend({}), spend({ id: "s2", campaign_name: "brand_awareness", spend: "500", spend_bdt: "500" })]);
  const curtain = rows.find((r) => r.key === "c:curtain_sep26");
  assert.equal(curtain.leads, 2);
  assert.equal(curtain.coverage, 0.5);
  assert.equal(curtain.cac, 2000);
  const brand = rows.find((r) => r.key === "c:brand_awareness");
  assert.equal(brand.acquired, 0);
  assert.equal(brand.cac, null);
  const paid = rev.paidTotals(rows);
  assert.equal(paid.spend, 2500);
  assert.equal(paid.acquired, 1);
  assert.equal(paid.cac, 2500);
});

test("paid rollup ignores organic acquisitions", () => {
  const rows = rev.campaignTable([conv({}), conv({ link_id: "org", utm_source: null, utm_medium: null, utm_campaign: null, referrer_host: "www.google.com" })], [], [spend({})]);
  assert.equal(rev.paidTotals(rows).acquired, 1);
});

test("coverage reconciles attributed + late + unattributed to Ops totals", () => {
  const t = { orders: 10, billed: 1000, collected: 900, customers: 8, orders_without_customer: 1, conversion_orders: 2, conversion_billed: 300,
    late_orders: 1, late_billed: 50, follow_on_orders: 1, follow_on_billed: 100, unattributed_orders: 6, unattributed_billed: 550,
    attributed_collected: 350, attributed_customers: 2, new_customers: 4, attributed_new_customers: 1, new_customer_billed: 400, attributed_new_customer_billed: 150 };
  const c = rev.coverage(t);
  assert.equal(c.reconciles, true);
  assert.equal(c.attributedBilled, 400);
  assert.equal(c.revenueCoverage, 0.4);
  assert.equal(c.newCustomerCoverage, 0.25);
  assert.equal(rev.coverage({ ...t, unattributed_billed: 500 }).reconciles, false);
});

test("spend validation and CSV preview with dedupe", () => {
  assert.equal(rev.validateSpend({ date: "2026-09-01", platform: "Facebook", campaign_name: "x", spend: "1,200" }).value.spend_bdt, 1200);
  assert.equal(rev.validateSpend({ date: "2026-09-01", platform: "facebook", campaign_name: "x", spend: "10", currency: "USD" }).ok, false);
  assert.equal(rev.validateSpend({ date: "09/01/2026", platform: "facebook", campaign_name: "x", spend: "10" }).ok, false);
  const existing = new Set([rev.spendKey({ spend_date: "2026-09-02", platform: "facebook", campaign_name: "a", adset_id: null, adset_name: null, ad_id: null, ad_name: null })]);
  const csv = 'date,platform,campaign_name,spend,notes\n2026-09-01,facebook,a,100,"hello, world"\n2026-09-01,Facebook,A,100,\n2026-09-02,facebook,a,50,\nbad,facebook,a,1,\n';
  const p = rev.previewSpendCsv(csv, existing);
  assert.equal(p.valid.length, 1);
  assert.equal(p.valid[0].notes, "hello, world");
  assert.deepEqual(p.rows.map((r) => r.duplicate ?? (r.error ? "error" : "ok")), ["ok", "file", "existing", "error"]);
  assert.match(rev.previewSpendCsv("date,platform\n", new Set()).headerError, /Missing/);
  assert.match(rev.previewSpendCsv("date,platform,campaign_name,spend,password\n", new Set()).headerError, /Unknown/);
});
