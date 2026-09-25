import { fmt } from "@/components/admin/charts";
import { RevenueTabs } from "@/components/admin/RevenueTabs";
import { DataTable, Td } from "@/components/admin/tables";
import { AdminHeader, Badge, DataNotice, Panel, RangePicker, one, type SearchParams } from "@/components/admin/ui";
import { CHANNEL_LABELS } from "@/lib/analytics/classify";
import { acquisitionTouch, campaignLabel, filterConversions, type ConversionRow } from "@/lib/admin/revenue";
import { getRevenueData } from "@/lib/admin/revenue-data";
import { CLASSIFICATION_LABELS, METHOD_LABELS, money, parseRevenueRange } from "@/lib/admin/revenue-helpers";

export const metadata = { title: "Attributed customers · Velto Command Center" };

const RANGES = [
  { key: "30d", label: "30 days" },
  { key: "90d", label: "90 days" },
  { key: "365d", label: "12 months" },
] as const;

const PAGE = 100;

const windowCell = (value: ConversionRow["billed_30"], matured: boolean) =>
  matured ? money(Number(value)) : <span className="t-small text-secondary">pending</span>;

/**
 * Privacy-safe attributed-customer report: Ops customer code, attribution and
 * revenue only. No phone, name, address or browsing history is shown here.
 */
export default async function RevenueCustomersPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const flat = Object.fromEntries(Object.entries(params).map(([k, v]) => [k, one(v)?.slice(0, 120)])) as Record<string, string | undefined>;
  const range = parseRevenueRange(flat);
  const loaded = await getRevenueData(range.from, range.to);
  const all = loaded.state === "ok" ? filterConversions(loaded.data.conversions, { type: flat.type, service: flat.service, campaign: flat.campaign }).sort((a, b) => b.order_date.localeCompare(a.order_date) || a.link_id.localeCompare(b.link_id)) : [];
  const page = Math.max(1, Number(flat.page) || 1);
  const rows = all.slice((page - 1) * PAGE, page * PAGE);
  const pages = Math.max(1, Math.ceil(all.length / PAGE));
  const qs = (p: number) => new URLSearchParams({ ...(Object.fromEntries(Object.entries(flat).filter(([, v]) => v)) as Record<string, string>), page: String(p) });

  return (
    <>
      <AdminHeader
        title="Attributed customers"
        intro={`Customers linked to a website booking or quote, by attributed order date · ${range.label}. Identified by their Velto Ops customer code only.`}
        actions={
          <RangePicker basePath="/admin/revenue/customers" params={flat} active={range.key} from={flat.from} to={flat.to} options={RANGES} maxNote="Up to two years of Velto Ops orders." />
        }
      />
      <RevenueTabs active="/admin/revenue/customers" />
      {loaded.state === "not_configured" ? <DataNotice state="not_configured" /> : null}
      {loaded.state === "error" ? <DataNotice state="error" message={loaded.message} /> : null}

      <div className="mt-6 flex flex-wrap gap-2" role="group" aria-label="Customer type">
        {[{ key: "", label: "All" }, ...Object.entries(CLASSIFICATION_LABELS).map(([key, label]) => ({ key, label }))].map((t) => (
          <a
            key={t.key}
            href={`/admin/revenue/customers?${new URLSearchParams({ range: range.key, ...(range.key === "custom" ? { from: range.from, to: range.to } : {}), ...(t.key ? { type: t.key } : {}) })}`}
            aria-current={(flat.type ?? "") === t.key ? "page" : undefined}
            className={`rounded-full border px-3 py-1.5 t-small font-semibold ${(flat.type ?? "") === t.key ? "border-navy bg-navy text-white" : "border-line bg-white text-navy hover:border-navy"}`}
          >
            {t.label}
          </a>
        ))}
      </div>

      <Panel className="mt-6" title={`${fmt(all.length)} attributed conversion${all.length === 1 ? "" : "s"}`} intro="30/60/90-day values show “pending” until the customer is that many days past their attributed order.">
        {rows.length === 0 ? (
          <p className="t-small text-secondary">No attributed customers in this period.</p>
        ) : (
          <DataTable
            leftCols={4}
            caption="Attributed customers"
            head={["Customer", "Type", "Source", "Campaign", "First attributed order", "First order", "30d", "60d", "90d", "Lifetime", "Orders", "Repeat", "Link"]}
          >
            {rows.map((r) => {
              const t = acquisitionTouch(r);
              return (
                <tr key={r.link_id}>
                  <Td first>{r.customer_ref ?? "—"}</Td>
                  <Td left>
                    <Badge tone={r.classification === "acquired" ? "green" : r.classification === "reactivated" ? "blue" : "neutral"}>{CLASSIFICATION_LABELS[r.classification]}</Badge>
                    {r.window_kind === "late" ? (
                      <span className="ml-1">
                        <Badge tone="amber">late</Badge>
                      </span>
                    ) : null}
                  </Td>
                  <Td left>{CHANNEL_LABELS[t.channel]}</Td>
                  <Td left className="max-w-[12rem] truncate">
                    {campaignLabel(t)}
                  </Td>
                  <Td>
                    {r.order_number} · {r.order_date}
                  </Td>
                  <Td>{money(Number(r.first_billed))}</Td>
                  <Td>{windowCell(r.billed_30, r.matured_30)}</Td>
                  <Td>{windowCell(r.billed_60, r.matured_60)}</Td>
                  <Td>{windowCell(r.billed_90, r.matured_90)}</Td>
                  <Td className="font-semibold">{money(Number(r.billed_life))}</Td>
                  <Td>{fmt(r.order_count)}</Td>
                  <Td>{r.repeat_customer ? `yes · ${r.days_to_second} d` : "no"}</Td>
                  <Td left>
                    {METHOD_LABELS[r.link_method] ?? r.link_method}
                    {r.name_mismatch ? (
                      <span className="ml-1">
                        <Badge tone="amber">name differs</Badge>
                      </span>
                    ) : null}
                    {r.conflict ? (
                      <span className="ml-1">
                        <Badge tone="amber">conflict</Badge>
                      </span>
                    ) : null}
                  </Td>
                </tr>
              );
            })}
          </DataTable>
        )}
        {pages > 1 ? (
          <nav aria-label="Pages" className="mt-4 flex items-center gap-3 t-small">
            {page > 1 ? <a href={`/admin/revenue/customers?${qs(page - 1)}`} className="font-semibold text-navy underline underline-offset-4">Previous</a> : null}
            <span className="text-secondary">
              Page {page} of {pages}
            </span>
            {page < pages ? <a href={`/admin/revenue/customers?${qs(page + 1)}`} className="font-semibold text-navy underline underline-offset-4">Next</a> : null}
          </nav>
        ) : null}
      </Panel>
    </>
  );
}
