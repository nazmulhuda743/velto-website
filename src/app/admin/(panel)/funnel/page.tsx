import { FunnelChart, fmt } from "@/components/admin/charts";
import { ConversionTable, DataTable, Td } from "@/components/admin/tables";
import { AdminHeader, DataNotice, Panel, RangePicker, type SearchParams } from "@/components/admin/ui";
import { CHANNEL_LABELS, CHANNEL_ORDER, classifyChannel } from "@/lib/analytics/classify";
import { isAnalyticsWritesEnabled, outcomesFor, sessionsFor } from "@/lib/admin/analytics-data";
import { byChannel, byDevice, campaigns, filterSessions, funnel, pct, type SessionFilter } from "@/lib/admin/insights";
import { readDashboardParams, SERVICE_OPTIONS } from "@/lib/admin/page-helpers";
import { outcomeFunnel, outcomesByChannel, type OutcomeRow } from "@/lib/admin/request-outcomes";
import { requireSection } from "@/lib/admin/session";

export const metadata = { title: "Funnel · Velto Command Center" };

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

export default async function FunnelPage({ searchParams }: { searchParams: SearchParams }) {
  await requireSection("funnel");
  const { flat, range } = readDashboardParams(await searchParams);
  const [loaded, outcomes] = await Promise.all([sessionsFor(range), outcomesFor(range)]);
  const all = loaded.state === "ok" ? loaded.data.rows : [];
  const filter: SessionFilter = { service: flat.service, channel: flat.channel, campaign: flat.campaign, device: flat.device };
  const rows = filterSessions(all, filter);
  const f = funnel(rows);
  const active = Object.values(filter).filter(Boolean).length;
  const success = f.steps.at(-1);

  return (
    <>
      <AdminHeader
        title="Conversion funnel"
        intro={`From landing to a sent request · ${range.label}. Each session is counted at the furthest stage it reached, so every stage includes the ones after it.`}
        actions={<RangePicker basePath="/admin/funnel" params={flat} active={range.key} from={flat.from} to={flat.to} />}
      />
      {loaded.state === "not_configured" ? <DataNotice state="not_configured" /> : null}
      {loaded.state === "error" ? <DataNotice state="error" message={loaded.message} /> : null}
      {loaded.state === "ok" && !loaded.preview && !isAnalyticsWritesEnabled() ? <DataNotice state="off" /> : null}

      <form action="/admin/funnel" className="admin-card mt-6 grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-[repeat(4,minmax(0,1fr))_auto] lg:items-end">
        <input type="hidden" name="range" value={range.key} />
        {flat.from ? <input type="hidden" name="from" value={flat.from} /> : null}
        {flat.to ? <input type="hidden" name="to" value={flat.to} /> : null}
        <Select name="service" label="Service" value={flat.service} options={SERVICE_OPTIONS} />
        <Select name="channel" label="Source" value={flat.channel} options={CHANNEL_ORDER.map((c) => ({ value: c, label: CHANNEL_LABELS[c] }))} />
        <Select name="campaign" label="Campaign" value={flat.campaign} options={campaigns(all).map((c) => ({ value: c, label: c }))} />
        <Select
          name="device"
          label="Device"
          value={flat.device}
          options={[
            { value: "mobile", label: "Mobile" },
            { value: "tablet", label: "Tablet" },
            { value: "desktop", label: "Desktop" },
          ]}
        />
        <div className="flex gap-2 sm:col-span-2 lg:col-span-1">
          <button type="submit" className="admin-btn">
            Apply
          </button>
          {active ? (
            <a href={`/admin/funnel?${new URLSearchParams({ range: range.key, ...(flat.from ? { from: flat.from, to: flat.to ?? "" } : {}) })}`} className="admin-btn-secondary">
              Clear
            </a>
          ) : null}
        </div>
      </form>

      <section aria-labelledby="funnel-title" className="admin-card mt-6 p-5 md:p-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 id="funnel-title" className="text-[17px] font-semibold text-navy">
              {active ? `Filtered funnel · ${fmt(rows.length)} of ${fmt(all.length)} sessions` : "All sessions"}
            </h2>
            <p className="mt-1 t-small text-secondary">Bars are scaled to the sessions that landed.</p>
          </div>
          <div className="text-right">
            <p className="t-small text-secondary">Landing → request</p>
            <p className="text-[36px] font-semibold leading-none tabular-nums text-navy">{pct(success?.ofTotal ?? null)}</p>
          </div>
        </div>
        <div className="mt-8">
          <FunnelChart steps={f.steps} />
        </div>
        <div className="mt-6 grid gap-4 border-t border-line pt-5 md:grid-cols-2">
          <p className="t-small text-secondary">
            <span className="font-semibold text-navy">WhatsApp fallback:</span> {fmt(f.whatsappFallback)} sessions that didn&apos;t send a form tapped WhatsApp instead (
            {pct(f.whatsappFallbackRate)}). These conversations happen outside the website and aren&apos;t counted as requests.
          </p>
          <p className="t-small text-secondary">
            <span className="font-semibold text-navy">Biggest drop:</span>{" "}
            {(() => {
              const worst = f.steps.slice(1).filter((s) => s.dropOff !== null).sort((a, b) => (b.dropOff ?? 0) - (a.dropOff ?? 0))[0];
              return worst && rows.length ? `${pct(worst.dropOff)} leave before “${worst.label.toLowerCase()}”.` : "Not enough sessions yet.";
            })()}
          </p>
        </div>
      </section>

      <AfterTheRequest loaded={outcomes} filter={filter} />

      <div className="mt-6 grid gap-6 2xl:grid-cols-2">
        <Panel title="By device">
          <ConversionTable rows={byDevice(rows)} label="Device" caption="Conversion by device" />
        </Panel>
        <Panel title="By source">
          <ConversionTable rows={byChannel(rows)} label="Source" caption="Conversion by source" hideEmpty />
        </Panel>
      </div>
    </>
  );
}

/**
 * Request → picked up → first order delivered → ordered again, from Velto Ops. Every request counts
 * (not only consented sessions), so it follows the Source and Service filters but not Campaign or Device.
 */
function AfterTheRequest({ loaded, filter }: { loaded: Awaited<ReturnType<typeof outcomesFor>>; filter: SessionFilter }) {
  if (loaded.state === "not_configured") return null;
  const all = loaded.state === "ok" ? loaded.data : [];
  const rows = all.filter((o: OutcomeRow) => (!filter.service || o.service === filter.service) && (!filter.channel || classifyChannel(o) === filter.channel));
  const o = outcomeFunnel(rows);
  const sources = outcomesByChannel(rows);
  const again = o.steps.at(-1);
  return (
    <section aria-labelledby="after-title" className="admin-card mt-6 p-5 md:p-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 id="after-title" className="text-[17px] font-semibold text-navy">
            After the request
          </h2>
          <p className="mt-1 max-w-[60ch] t-small text-secondary">
            What happened to every booking and quote sent in this period, from Velto Ops. All requests count here, not only sessions that allowed analytics.
          </p>
        </div>
        <div className="text-right">
          <p className="t-small text-secondary">Request → ordered again</p>
          <p className="text-[36px] font-semibold leading-none tabular-nums text-navy">{pct(again?.ofTotal ?? null)}</p>
        </div>
      </div>
      {loaded.state === "error" ? (
        <div className="mt-6">
          <DataNotice state="error" message={loaded.message} />
        </div>
      ) : !rows.length ? (
        <p className="mt-6 t-small text-secondary">No requests in this period.</p>
      ) : (
        <>
          <div className="mt-8">
            <FunnelChart steps={o.steps} unit="requests" />
          </div>
          <p className="mt-6 border-t border-line pt-5 t-small text-secondary">
            <span className="font-semibold text-navy">{fmt(o.open)}</span> still waiting for pickup · <span className="font-semibold text-navy">{fmt(o.cancelled)}</span> cancelled ·{" "}
            <span className="font-semibold text-navy">{fmt(o.newCustomers)}</span> new and <span className="font-semibold text-navy">{fmt(o.returning)}</span> returning customers
            (where the customer is known). Recent requests haven&apos;t had time to be delivered or reordered yet.
          </p>
          <div className="mt-6">
            <DataTable caption="Request outcomes by source" head={["Source", "Requests", "Picked up", "Delivered", "Ordered again", "Cancelled", "Pickup rate", "Reorder rate"]}>
              {sources.map((r) => (
                <tr key={r.key}>
                  <Td first>{r.label}</Td>
                  <Td>{fmt(r.requests)}</Td>
                  <Td>{fmt(r.picked)}</Td>
                  <Td>{fmt(r.delivered)}</Td>
                  <Td>{fmt(r.again)}</Td>
                  <Td>{fmt(r.cancelled)}</Td>
                  <Td className="font-semibold">{pct(r.pickupRate)}</Td>
                  <Td className="font-semibold">{pct(r.repeatRate)}</Td>
                </tr>
              ))}
            </DataTable>
            <p className="mt-3 t-caption text-secondary">Reorder rate is out of delivered first orders.</p>
          </div>
        </>
      )}
    </section>
  );
}
