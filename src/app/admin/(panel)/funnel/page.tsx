import { FunnelChart, fmt } from "@/components/admin/charts";
import { ConversionTable } from "@/components/admin/tables";
import { AdminHeader, DataNotice, Panel, RangePicker, type SearchParams } from "@/components/admin/ui";
import { CHANNEL_LABELS, CHANNEL_ORDER } from "@/lib/analytics/classify";
import { isAnalyticsWritesEnabled, sessionsFor } from "@/lib/admin/analytics-data";
import { byChannel, byDevice, campaigns, filterSessions, funnel, pct, type SessionFilter } from "@/lib/admin/insights";
import { readDashboardParams, SERVICE_OPTIONS } from "@/lib/admin/page-helpers";

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
  const { flat, range } = readDashboardParams(await searchParams);
  const loaded = await sessionsFor(range);
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
