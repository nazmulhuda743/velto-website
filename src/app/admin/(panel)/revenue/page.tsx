import { fmt } from "@/components/admin/charts";
import { RevenueTabs } from "@/components/admin/RevenueTabs";
import { DataTable, Td } from "@/components/admin/tables";
import { AdminHeader, DataNotice, Panel, RangePicker, one, type SearchParams } from "@/components/admin/ui";
import { CHANNEL_LABELS, CHANNEL_ORDER } from "@/lib/analytics/classify";
import { pct } from "@/lib/admin/insights";
import { SERVICE_OPTIONS, serviceName } from "@/lib/admin/page-helpers";
import {
  acquisitionTouch,
  campaignKey,
  campaignLabel,
  campaignTable,
  coverage,
  filterConversions,
  filterLeads,
  filterSpend,
  paidTotals,
  summarize,
  type CampaignRow,
  type RevenueFilter,
  type Windowed,
} from "@/lib/admin/revenue";
import { getRevenueData, getReviewQueue } from "@/lib/admin/revenue-data";
import { money, parseRevenueRange, roas } from "@/lib/admin/revenue-helpers";
import { runMatchingAction } from "../../revenue-actions";

export const metadata = { title: "Revenue · Velto Command Center" };

const RANGES = [
  { key: "30d", label: "30 days" },
  { key: "90d", label: "90 days" },
  { key: "365d", label: "12 months" },
] as const;

const windowed = (w: Windowed) =>
  w.value !== null ? money(w.value) : w.pending ? <span className="t-small text-secondary">pending ({w.pending})</span> : "—";

function Metric({ label, value, sub }: { label: string; value: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div className="border-t border-line px-5 py-4 first:border-t-0 sm:[&:nth-child(-n+2)]:border-t-0 lg:[&:nth-child(-n+4)]:border-t-0">
      <p className="t-small text-secondary">{label}</p>
      <p className="mt-1 text-[24px] font-semibold leading-tight tracking-[-0.01em] tabular-nums text-navy">{value}</p>
      {sub ? <p className="mt-1 t-caption text-secondary">{sub}</p> : null}
    </div>
  );
}

function Select({ name, label, value, options }: { name: string; label: string; value?: string; options: { value: string; label: string }[] }) {
  return (
    <label className="block min-w-0">
      <span className="block t-caption font-semibold uppercase tracking-[0.04em] text-secondary">{label}</span>
      <select name={name} defaultValue={value ?? ""} className="admin-input mt-1">
        <option value="">All</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export default async function RevenuePage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const flat = Object.fromEntries(Object.entries(params).map(([k, v]) => [k, one(v)?.slice(0, 120)])) as Record<string, string | undefined>;
  const range = parseRevenueRange(flat);
  const filter: RevenueFilter = { source: flat.source, campaign: flat.campaign, service: flat.service, type: flat.type };
  const [loaded, review] = await Promise.all([getRevenueData(range.from, range.to), getReviewQueue()]);
  const data = loaded.state === "ok" ? loaded.data : null;

  const conversions = data ? filterConversions(data.conversions, filter) : [];
  const leads = data ? filterLeads(data.leads, { ...filter, type: undefined }) : [];
  const spend = data ? filterSpend(data.spend, filter) : [];
  const s = summarize(conversions, []);
  const rows = campaignTable(conversions, leads, spend);
  const paid = paidTotals(rows);
  const cov = data ? coverage(data.totals) : null;
  const active = Object.values(filter).filter(Boolean).length;

  const campaignOptions = data
    ? [...new Map([...data.conversions.map((c) => acquisitionTouch(c)), ...data.leads.map((l) => acquisitionTouch({ ...l, utm_content: null, ft_utm_content: null }))].map((t) => [campaignKey(t), campaignLabel(t)])).entries()]
        .concat(data.spend.map((sp) => [`c:${sp.campaign_name.trim().toLowerCase()}`, sp.campaign_name] as [string, string]))
        .filter((e, i, all) => all.findIndex((x) => x[0] === e[0]) === i)
        .sort((a, b) => a[1].localeCompare(b[1]))
        .map(([value, label]) => ({ value, label }))
    : [];
  const sourceOptions = CHANNEL_ORDER.map((c) => ({ value: c, label: CHANNEL_LABELS[c] }));
  const matched = flat.matched?.split(".").map(Number);

  return (
    <>
      <AdminHeader
        title="Revenue attribution"
        intro={`Which campaigns bring customers, what they cost and what they are worth · ${range.label}. Billed revenue from Velto Ops orders.`}
        actions={
          <RangePicker
            basePath="/admin/revenue"
            params={flat}
            active={range.key}
            from={flat.from}
            to={flat.to}
            options={RANGES}
            maxNote="Up to two years of Velto Ops orders."
          />
        }
      />
      <RevenueTabs active="/admin/revenue" reviewCount={review.state === "ok" ? review.data.length : undefined} />

      {loaded.state === "not_configured" ? <DataNotice state="not_configured" /> : null}
      {loaded.state === "error" ? <DataNotice state="error" message={loaded.message} /> : null}
      {flat.error ? <DataNotice state="error" message={flat.error} /> : null}
      {matched && matched.length === 3 ? (
        <p role="status" className="mt-6 rounded-md border border-success/30 bg-success-soft px-4 py-3 t-small font-medium text-success">
          Matching finished: {matched[0]} new links, {matched[1]} updated, {matched[2]} superseded by staff links.
        </p>
      ) : null}

      <form action="/admin/revenue" className="admin-card mt-6 grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-[repeat(4,minmax(0,1fr))_auto] lg:items-end">
        <input type="hidden" name="range" value={range.key} />
        {range.key === "custom" ? (
          <>
            <input type="hidden" name="from" value={range.from} />
            <input type="hidden" name="to" value={range.to} />
          </>
        ) : null}
        <Select name="source" label="Source" value={flat.source} options={sourceOptions} />
        <Select name="campaign" label="Campaign" value={flat.campaign} options={campaignOptions} />
        <Select name="service" label="Service" value={flat.service} options={SERVICE_OPTIONS} />
        <Select
          name="type"
          label="Customer type"
          value={flat.type}
          options={[
            { value: "acquired", label: "Acquired" },
            { value: "reactivated", label: "Reactivated" },
            { value: "existing", label: "Existing" },
          ]}
        />
        <div className="flex gap-2">
          <button type="submit" className="admin-btn">
            Apply
          </button>
          {active ? (
            <a href={`/admin/revenue?range=${range.key}`} className="admin-btn-secondary">
              Clear
            </a>
          ) : null}
        </div>
      </form>

      {/* Top metrics */}
      <section aria-labelledby="rev-top" className="admin-card mt-6 grid overflow-hidden lg:grid-cols-[minmax(0,4fr)_minmax(0,8fr)]">
        <h2 id="rev-top" className="sr-only">
          Top revenue metrics
        </h2>
        <div className="border-b border-line bg-navy p-6 text-white lg:border-b-0 lg:border-r">
          <p className="t-small text-white/70">Attributed billed revenue</p>
          <p className="mt-2 text-[44px] font-semibold leading-none tracking-[-0.03em] tabular-nums">{money(s.lifetimeBilled)}</p>
          <p className="mt-3 t-small text-white/75">
            Lifetime billed revenue of {fmt(s.conversions)} attributed customers whose attributed order falls in this period.
          </p>
          <dl className="mt-5 grid grid-cols-2 gap-4 border-t border-white/15 pt-4">
            <div>
              <dt className="t-caption text-white/60">Collected</dt>
              <dd className="text-[18px] font-semibold tabular-nums">{money(s.lifetimeCollected)}</dd>
            </div>
            <div>
              <dt className="t-caption text-white/60">Collection rate</dt>
              <dd className="text-[18px] font-semibold tabular-nums">{pct(s.lifetimeBilled ? s.lifetimeCollected / s.lifetimeBilled : null)}</dd>
            </div>
            <div>
              <dt className="t-caption text-white/60">Outstanding</dt>
              <dd className="text-[18px] font-semibold tabular-nums">{money(s.lifetimeBilled - s.lifetimeCollected)}</dd>
            </div>
            <div>
              <dt className="t-caption text-white/60">Attribution coverage</dt>
              <dd className="text-[18px] font-semibold tabular-nums">{pct(cov?.revenueCoverage ?? null)}</dd>
            </div>
          </dl>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4">
          <Metric label="New customers acquired" value={fmt(s.acquired)} sub="first qualifying order" />
          <Metric label="Reactivated" value={fmt(s.reactivated)} sub="no order in prior 90 days" />
          <Metric label="Repeat customers" value={fmt(s.repeatCustomers)} sub={`${pct(s.repeatRate)} of attributed`} />
          <Metric label="Existing (not acquisitions)" value={fmt(s.existing)} sub="ordered in prior 90 days" />
          <Metric label="Spend" value={paid.spend === null ? <span className="text-[17px] text-secondary">Spend not recorded</span> : money(paid.spend)} sub={paid.spend === null ? undefined : `${paid.campaignsWithSpend} campaigns`} />
          <Metric label="CAC" value={paid.cac === null ? "—" : money(paid.cac)} sub={paid.spend === null ? "needs spend" : `${fmt(paid.acquired)} acquired by paid campaigns`} />
          <Metric label="First-order ROAS" value={roas(paid.firstOrderRoas)} sub="first-order billed ÷ spend" />
          <Metric
            label="30-day ROAS"
            value={paid.roas30Pending ? <span className="text-[17px] text-secondary">pending</span> : roas(paid.roas30)}
            sub={paid.roas30Pending ? "some customers < 30 days old" : "matured 30-day billed ÷ spend"}
          />
        </div>
      </section>
      <p className="mt-2 t-caption text-secondary">
        Primary attribution only: booking orders within 7 days, quote orders within 14 days, or orders staff linked to the website request.
        {s.late ? ` ${s.late} late booking conversion${s.late === 1 ? "" : "s"} (day 8–14) are listed separately below.` : ""} Collected ROAS (cash):{" "}
        {roas(paid.collectedRoas)}. Lifetime revenue ÷ spend: {roas(paid.lifetimeRoas)}.
      </p>

      {/* Coverage — mandatory */}
      {cov ? (
        <Panel
          className="mt-6"
          title="Attribution coverage"
          intro={`Every qualifying Velto Ops order dated in this period (not cancelled, value > 0), whatever the filters above.`}
          action={
            <span className={`t-small font-semibold ${cov.reconciles ? "text-success" : "text-error"}`}>
              {cov.reconciles ? "✓ Reconciles with Ops totals" : "✗ Does not reconcile — report this"}
            </span>
          }
        >
          <DataTable minWidth="min-w-[520px]" caption="Attribution coverage" head={["", "Orders", "Billed revenue", "Share"]}>
            <tr>
              <Td first wrap>Website-attributed (conversions + their later orders)</Td>
              <Td>{fmt(cov.attributedOrders)}</Td>
              <Td>{money(cov.attributedBilled)}</Td>
              <Td className="font-semibold">{pct(cov.revenueCoverage)}</Td>
            </tr>
            <tr>
              <Td first wrap>Late / assisted booking conversions (day 8–14)</Td>
              <Td>{fmt(cov.lateOrders)}</Td>
              <Td>{money(cov.lateBilled)}</Td>
              <Td>{pct(cov.billed ? cov.lateBilled / cov.billed : null)}</Td>
            </tr>
            <tr>
              <Td first wrap>Unattributed (no website evidence)</Td>
              <Td>{fmt(cov.unattributedOrders)}</Td>
              <Td>{money(cov.unattributedBilled)}</Td>
              <Td>{pct(cov.billed ? cov.unattributedBilled / cov.billed : null)}</Td>
            </tr>
            <tr className="bg-soft">
              <Td first wrap>All qualifying Ops orders</Td>
              <Td className="font-semibold">{fmt(cov.orders)}</Td>
              <Td className="font-semibold">{money(cov.billed)}</Td>
              <Td>100%</Td>
            </tr>
          </DataTable>
          <p className="mt-4 t-small text-secondary">
            New customers in this period: <span className="font-semibold text-navy">{fmt(cov.newCustomers)}</span>, of which{" "}
            <span className="font-semibold text-navy">{fmt(cov.attributedNewCustomers)}</span> ({pct(cov.newCustomerCoverage)}) have a known website source.
            {cov.ordersWithoutCustomer ? ` ${cov.ordersWithoutCustomer} orders have no customer record and can't be attributed.` : ""} Historical
            customers with no website evidence stay unknown — nothing is backfilled.
          </p>
        </Panel>
      ) : null}

      {/* Campaign table */}
      <Panel
        className="mt-6"
        title="By campaign"
        intro="Campaign = the visitor's first website session when known (Analytics consent), otherwise the campaign sent with the booking or quote."
        action={
          <form action={runMatchingAction}>
            <button type="submit" className="admin-btn-secondary">
              Run matching now
            </button>
          </form>
        }
      >
        {rows.length === 0 ? (
          <p className="t-small text-secondary">No leads, conversions or spend in this period.</p>
        ) : (
          <DataTable
            leftCols={2}
            caption="Revenue by campaign"
            head={["Campaign", "Source", "Spend", "Leads", "Acquired", "Reactivated", "Existing", "First-order", "30d", "60d", "90d", "Repeat", "CAC", "ROAS", "Coverage"]}
          >
            {rows.map((r: CampaignRow) => (
              <tr key={r.key}>
                <Td first className="max-w-[16rem] truncate">
                  {r.label}
                </Td>
                <Td left>{r.sources.join(", ") || "—"}</Td>
                <Td>{r.spend === null ? <span className="text-secondary">not recorded</span> : money(r.spend)}</Td>
                <Td>{fmt(r.leads)}</Td>
                <Td className="font-semibold">{fmt(r.acquired)}</Td>
                <Td>{fmt(r.reactivated)}</Td>
                <Td>{fmt(r.existing)}</Td>
                <Td>{money(r.firstBilled)}</Td>
                <Td>{windowed(r.billed30)}</Td>
                <Td>{windowed(r.billed60)}</Td>
                <Td>{windowed(r.billed90)}</Td>
                <Td>{pct(r.repeatRate)}</Td>
                <Td>{r.spend === null ? "—" : r.cac === null ? <span className="text-secondary">no acquisitions</span> : money(r.cac)}</Td>
                <Td>{roas(r.firstOrderRoas)}</Td>
                <Td>{pct(r.coverage)}</Td>
              </tr>
            ))}
          </DataTable>
        )}
        <p className="mt-4 t-caption text-secondary">
          Spend is matched to leads by campaign name (utm_campaign), case-insensitively. ROAS here is first-order billed revenue ÷ spend. Pending = at
          least one customer in the row hasn&apos;t reached that many days yet, so the value isn&apos;t shown as 0. Coverage = share of the
          row&apos;s leads matched to a Velto Ops customer.
        </p>
      </Panel>

      {s.late ? (
        <Panel className="mt-6" title="Late / assisted booking conversions" intro="Booking leads whose first order came on day 8–14. Not included in primary attribution, CAC or ROAS above.">
          <DataTable leftCols={2} caption="Late conversions" head={["Customer", "Campaign", "Order", "Order date", "First-order billed"]}>
            {conversions
              .filter((c) => c.window_kind === "late")
              .slice(0, 50)
              .map((c) => (
                <tr key={c.link_id}>
                  <Td first>{c.customer_ref ?? "—"}</Td>
                  <Td left>{campaignLabel(acquisitionTouch(c))}</Td>
                  <Td>{c.order_number}</Td>
                  <Td>{c.order_date}</Td>
                  <Td>{money(Number(c.first_billed))}</Td>
                </tr>
              ))}
          </DataTable>
        </Panel>
      ) : null}

      <p className="mt-6 t-caption text-secondary">
        Filters: {filter.service ? serviceName(filter.service) : "all services"} · WhatsApp conversations are not attributed to revenue yet (no
        reference is saved in Ops). Revenue is billed order value; costs of service are not included.
      </p>
    </>
  );
}
