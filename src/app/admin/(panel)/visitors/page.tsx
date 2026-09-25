import { BarList, HourStrip, SplitBar, fmt } from "@/components/admin/charts";
import { AdminHeader, DataNotice, Panel, RangePicker, type SearchParams } from "@/components/admin/ui";
import { isAnalyticsWritesEnabled, sessionsFor } from "@/lib/admin/analytics-data";
import {
  devices,
  exitPages,
  hourOfDay,
  journeys,
  landingPages,
  overview,
  pageLabel,
  pricingSearches,
  serviceInterest,
  topPages,
  type Ranked,
} from "@/lib/admin/insights";
import { readDashboardParams, serviceName } from "@/lib/admin/page-helpers";

export const metadata = { title: "Visitors · Velto Command Center" };

const pageItems = (list: Ranked[]) => list.map((r) => ({ key: r.key, label: `${pageLabel(r.key)}`, value: r.count, sub: r.key !== pageLabel(r.key) ? r.key : undefined }));
const searchLabel = (slug: string) => slug.replace(/-/g, " ");

export default async function VisitorsPage({ searchParams }: { searchParams: SearchParams }) {
  const { flat, range } = readDashboardParams(await searchParams);
  const loaded = await sessionsFor(range);
  const rows = loaded.state === "ok" ? loaded.data.rows : [];
  const o = overview(rows);
  const d = devices(rows);
  const count = (k: string) => d.find((x) => x.key === k)?.count ?? 0;
  const paths = journeys(rows);

  return (
    <>
      <AdminHeader
        title="Visitor insights"
        intro={`Aggregated behaviour of visitors who allowed analytics · ${range.label}. No names, phone numbers, IP addresses or individual timelines.`}
        actions={<RangePicker basePath="/admin/visitors" params={flat} active={range.key} from={flat.from} to={flat.to} />}
      />
      {loaded.state === "not_configured" ? <DataNotice state="not_configured" /> : null}
      {loaded.state === "error" ? <DataNotice state="error" message={loaded.message} /> : null}
      {loaded.state === "ok" && !loaded.preview && !isAnalyticsWritesEnabled() ? <DataNotice state="off" /> : null}

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Panel title="New vs returning" intro={`${fmt(o.visitors)} visitors in ${fmt(o.sessions)} sessions.`}>
          <SplitBar
            parts={[
              { label: "New", value: o.newVisitors, tone: "bg-navy" },
              { label: "Returning", value: o.returningVisitors, tone: "bg-cyan" },
            ]}
          />
        </Panel>
        <Panel title="Device" intro={`Average ${o.pagesPerSession === null ? "—" : o.pagesPerSession.toFixed(1)} pages per session.`}>
          <SplitBar
            parts={[
              { label: "Mobile", value: count("mobile"), tone: "bg-navy" },
              { label: "Desktop", value: count("desktop"), tone: "bg-blue" },
              { label: "Tablet", value: count("tablet"), tone: "bg-cyan" },
            ]}
          />
        </Panel>
      </div>

      <Panel className="mt-6" title="Common journeys" intro="The most frequent paths, grouped. Journeys ending in a request are listed first.">
        {paths.length === 0 ? (
          <p className="t-small text-secondary">No sessions in this period.</p>
        ) : (
          <ol className="divide-y divide-line">
            {paths.map((j) => (
              <li key={j.steps.join(">")} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3">
                <span className="flex min-w-0 flex-1 flex-wrap items-center gap-x-1.5 gap-y-1 text-[15px]">
                  {j.steps.map((step, i) => (
                    <span key={i} className="inline-flex items-center gap-1.5">
                      {i ? (
                        <span aria-hidden="true" className="text-muted">
                          →
                        </span>
                      ) : null}
                      <span
                        className={
                          i === 0
                            ? "font-semibold text-secondary"
                            : i === j.steps.length - 1
                              ? `rounded px-1.5 py-0.5 t-small font-semibold ${j.converted ? "bg-success-soft text-success" : "bg-soft text-secondary"}`
                              : "text-navy"
                        }
                      >
                        {step}
                      </span>
                    </span>
                  ))}
                </span>
                <span className="shrink-0 tabular-nums t-small font-semibold text-navy">
                  {fmt(j.count)} session{j.count === 1 ? "" : "s"}
                </span>
              </li>
            ))}
          </ol>
        )}
      </Panel>

      <div className="mt-6 grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
        <Panel title="Top pages" intro="Page views.">
          <BarList items={pageItems(topPages(rows))} />
        </Panel>
        <Panel title="Landing pages" intro="Where sessions start.">
          <BarList items={pageItems(landingPages(rows))} total={rows.length} />
        </Panel>
        <Panel title="Exit pages" intro="The last page viewed in a session.">
          <BarList items={pageItems(exitPages(rows))} total={rows.length} />
        </Panel>
        <Panel title="Service interest" intro="Sessions that viewed or chose each service.">
          <BarList items={serviceInterest(rows).map((r) => ({ key: r.key, label: serviceName(r.key), value: r.count }))} total={rows.length} />
        </Panel>
        <Panel title="Price searches" intro="Items chosen in Find a Price (never free text).">
          <BarList items={pricingSearches(rows).map((r) => ({ key: r.key, label: searchLabel(r.key), value: r.count }))} />
        </Panel>
        <Panel title="Time of day" intro="Session starts by hour.">
          <HourStrip hours={hourOfDay(rows)} />
        </Panel>
      </div>
      <p className="mt-4 t-caption text-secondary">
        Percentages are shares of the {fmt(rows.length)} sessions in this period. Only visitors who allowed analytics are counted.
      </p>
    </>
  );
}
