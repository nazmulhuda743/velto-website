import { SplitBar, StatusDot, fmt } from "@/components/admin/charts";
import { AdminHeader, DataNotice, Facts, Panel, RangePicker, type SearchParams } from "@/components/admin/ui";
import { CONSENT_COOKIE, CONSENT_POLICY_VERSION } from "@/lib/consent";
import { configuredGtmId } from "@/lib/gtm";
import { getAnalyticsHealth, getConsentSummary, isAnalyticsWritesEnabled } from "@/lib/admin/analytics-data";
import { consentRates, pct } from "@/lib/admin/insights";
import { isAdminPreview } from "@/lib/admin/preview";
import { dayLabel, hoursSince, readDashboardParams, timeAgo } from "@/lib/admin/page-helpers";
import { requireSection } from "@/lib/admin/session";

export const metadata = { title: "Consent & tracking · Velto Command Center" };

type Row = { label: string; status: "healthy" | "warning" | "error"; detail: string };

export default async function ConsentPage({ searchParams }: { searchParams: SearchParams }) {
  await requireSection("consent");
  const { flat, range } = readDashboardParams(await searchParams);
  const [summary, health] = await Promise.all([getConsentSummary(range), getAnalyticsHealth()]);
  const c = summary.state === "ok" ? summary.data : null;
  const r = c ? consentRates(c) : null;
  const h = health.state === "ok" ? health.data : null;
  const gtm = configuredGtmId();
  const writes = isAnalyticsWritesEnabled() || isAdminPreview();
  const hoursSinceEvent = hoursSince(h?.last_event_at);

  const rows: Row[] = [
    {
      label: "Google Tag Manager",
      status: gtm ? "healthy" : "warning",
      detail: gtm ? `Container ${gtm} is configured. It loads only after a visitor allows Analytics or Marketing.` : "GTM container ID is missing (NEXT_PUBLIC_GTM_ID). GA4 and Meta Pixel cannot run.",
    },
    {
      label: "GA4",
      status: gtm ? "warning" : "error",
      detail: gtm
        ? "Managed inside GTM, so the website can't see it directly. Confirm in GTM that the GA4 tag requires analytics_storage consent."
        : "Not detectable: no GTM container.",
    },
    {
      label: "Meta Pixel",
      status: gtm ? "warning" : "error",
      detail: gtm
        ? "Managed inside GTM. Confirm it requires ad_storage consent (or fires on the velto_consent event with marketing = true)."
        : "Not detectable: no GTM container.",
    },
    {
      label: "First-party analytics ingestion",
      status: !writes ? "warning" : hoursSinceEvent === null || hoursSinceEvent > 6 ? "warning" : "healthy",
      detail: !writes
        ? "Storage is switched off (WEBSITE_ANALYTICS_WRITES_ENABLED)."
        : hoursSinceEvent === null
          ? "No event has been received yet."
          : `Last event ${timeAgo(h?.last_event_at)}. ${fmt(h?.events_24h ?? 0)} events in 24 h.`,
    },
  ];

  const warnings: string[] = [];
  warnings.push("Meta marketing events are blocked until a visitor allows Marketing. Visitors who choose Essential only never load the Meta Pixel.");
  if (!gtm) warnings.push("GTM container ID is missing.");
  if (writes && hoursSinceEvent !== null && hoursSinceEvent > 6) warnings.push(`Analytics ingestion has not received an event in ${Math.round(hoursSinceEvent)} hours.`);
  if (writes && hoursSinceEvent === null) warnings.push("Analytics ingestion has not received any event yet.");
  if (r?.analytics !== null && r?.analytics !== undefined && r.analytics < 0.4)
    warnings.push(`Only ${pct(r.analytics)} of visitors allow analytics, so dashboard numbers cover a minority of traffic.`);

  return (
    <>
      <AdminHeader
        title="Consent & tracking"
        intro={`What visitors allowed, and whether measurement is working · ${range.label}.`}
        actions={<RangePicker basePath="/admin/consent" params={flat} active={range.key} from={flat.from} to={flat.to} />}
      />
      {summary.state === "not_configured" ? <DataNotice state="not_configured" /> : null}
      {summary.state === "error" ? <DataNotice state="error" message={summary.message} /> : null}

      <section aria-labelledby="decisions" className="admin-card mt-6 grid overflow-hidden md:grid-cols-[minmax(0,4fr)_minmax(0,8fr)]">
        <div className="border-b border-line p-6 md:border-b-0 md:border-r">
          <h2 id="decisions" className="t-small text-secondary">
            Consent decisions
          </h2>
          <p className="mt-2 text-[44px] font-semibold leading-none tabular-nums text-navy">{fmt(c?.decisions ?? 0)}</p>
          <p className="mt-2 t-small text-secondary">
            from {fmt(c?.banner_views ?? 0)} banner views ({pct(r?.decisionRate ?? null)} chose)
          </p>
        </div>
        <div className="p-6">
          <SplitBar
            parts={[
              { label: "Accept all", value: c?.accept_all ?? 0, tone: "bg-navy" },
              { label: "Reject non-essential", value: c?.reject_nonessential ?? 0, tone: "bg-line-strong" },
              { label: "Custom", value: c?.custom ?? 0, tone: "bg-cyan" },
            ]}
          />
          <div className="mt-5 grid grid-cols-2 gap-4 border-t border-line pt-4">
            <div>
              <p className="t-small text-secondary">Analytics allowed</p>
              <p className="text-[28px] font-semibold tabular-nums text-navy">{pct(r?.analytics ?? null)}</p>
            </div>
            <div>
              <p className="t-small text-secondary">Marketing allowed</p>
              <p className="text-[28px] font-semibold tabular-nums text-navy">{pct(r?.marketing ?? null)}</p>
            </div>
          </div>
        </div>
      </section>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        <Panel title="Tracking health" intro="No IDs or secrets are shown beyond the public GTM container ID.">
          <ul className="divide-y divide-line">
            {rows.map((row) => (
              <li key={row.label} className="grid gap-1 py-3 sm:grid-cols-[12rem_1fr] sm:gap-4">
                <div>
                  <p className="font-semibold text-navy">{row.label}</p>
                  <StatusDot status={row.status} />
                </div>
                <p className="t-small text-body">{row.detail}</p>
              </li>
            ))}
          </ul>
        </Panel>
        <div className="space-y-6">
          <Panel title="Signals">
            <Facts
              items={[
                { label: "Last event received", value: timeAgo(h?.last_event_at), sub: dayLabel(h?.last_event_at) },
                { label: "Last booking_success", value: timeAgo(h?.last_booking_success_at), sub: dayLabel(h?.last_booking_success_at) },
                { label: "Last quote_success", value: timeAgo(h?.last_quote_success_at), sub: dayLabel(h?.last_quote_success_at) },
                { label: "Last consent decision", value: timeAgo(h?.last_consent_at) },
                { label: "Consent policy version", value: `v${CONSENT_POLICY_VERSION}`, sub: CONSENT_COOKIE },
              ]}
            />
          </Panel>
          <Panel title="Warnings">
            <ul className="space-y-2">
              {warnings.map((w) => (
                <li key={w} className="flex gap-2.5 t-small text-body">
                  <span aria-hidden="true" className="mt-1.5 size-2 shrink-0 rounded-full bg-[#c77c02]" />
                  {w}
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      </div>
    </>
  );
}
