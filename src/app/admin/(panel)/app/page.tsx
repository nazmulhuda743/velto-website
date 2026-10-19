import Link from "next/link";
import { AdminHeader, DataNotice, Facts, Panel, RangePicker, type SearchParams } from "@/components/admin/ui";
import { isAnalyticsWritesEnabled } from "@/lib/admin/analytics-data";
import { appMetrics, OPEN_BUCKETS, REBOOK_SOURCES } from "@/lib/admin/app-metrics";
import { getAppEvents } from "@/lib/admin/app-metrics-data";
import { readDashboardParams } from "@/lib/admin/page-helpers";
import { requireSection } from "@/lib/admin/session";

export const metadata = { title: "Velto app · Velto Command Center" };

const pct = (v: number | null) => (v === null ? "Not enough data yet" : `${Math.round(v * 100)}%`);
const n = (v: number) => v.toLocaleString("en-GB");

const SOURCE_NAMES: Record<string, string> = {
  app_home_card: "Home card, one tap",
  app_home_change: "Home card → Change",
  app_book_again: "Order → Book this again",
  app_book_tab: "Book tab",
  app_home_first: "Home, first pickup",
  app_home_other: "Home → Book something else",
  app_orders: "Orders (empty)",
  app_prices: "Prices → Book",
  app_book: "Book screen (other link)",
};
const BUCKET_NAMES: Record<string, string> = { "0-30": "Under 30 s", "30-60": "30 to 60 s", "60-120": "1 to 2 min", "120-plus": "Over 2 min" };

/**
 * The design's "Metrics that prove it works" for the installed app (docs/technical/APP-METRICS.md).
 * From the app's own events, which exist only with Analytics consent and never from staff browsers.
 */
export default async function AppMetricsPage({ searchParams }: { searchParams: SearchParams }) {
  await requireSection("funnel");
  const { flat, range } = readDashboardParams(await searchParams);
  const loaded = await getAppEvents(range.from, range.to);
  const m = appMetrics(loaded.state === "ok" ? loaded.data.rows : [], range.days);

  return (
    <>
      <AdminHeader
        title="Velto app"
        intro={`How the installed app is used · ${range.label}. Counts only people who allowed analytics in the app; staff phones are never counted. No names, numbers or order numbers are stored.`}
        actions={<RangePicker basePath="/admin/app" params={flat} active={range.key} from={flat.from} to={flat.to} />}
      />
      {loaded.state === "not_configured" ? <DataNotice state="not_configured" /> : null}
      {loaded.state === "error" ? <DataNotice state="error" message={loaded.message} /> : null}
      {loaded.state === "ok" && loaded.preview ? <DataNotice state="preview" /> : null}
      {loaded.state === "ok" && !loaded.preview && !isAnalyticsWritesEnabled() ? <DataNotice state="off" /> : null}

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Panel title="Second order within 30 days" intro="The one that matters. It comes from Velto Ops orders, so it lives with the other repeat-customer numbers.">
          <Link href="/admin/retention" className="admin-btn-secondary">
            Open Bring customers back
          </Link>
        </Panel>

        <Panel title="App opens" intro="Each time the app is opened, or comes back to the screen after five minutes away.">
          <Facts
            items={[
              { label: "Opens", value: n(m.opens.total) },
              { label: "People", value: n(m.opens.visitors) },
              { label: "From the home screen (installed)", value: n(m.opens.installed) },
              { label: "In a browser", value: n(m.opens.browser) },
            ]}
          />
        </Panel>

        <Panel title="Rebook share" intro="App bookings that repeated the last order (Home card or Book this again), out of all app bookings.">
          <p className="text-[28px] font-semibold text-navy" data-metric="rebook">
            {pct(m.rebook.share)}
          </p>
          <p className="t-small text-secondary">
            {n(m.rebook.rebooks)} of {n(m.rebook.bookings)} bookings
          </p>
          {m.rebook.bySource.length ? (
            <div className="mt-3">
              <Facts items={m.rebook.bySource.map((s) => ({ label: SOURCE_NAMES[s.source] ?? s.source, value: n(s.count), sub: (REBOOK_SOURCES as readonly string[]).includes(s.source) ? "Rebook" : undefined }))} />
            </div>
          ) : null}
        </Panel>

        <Panel title="Open to booked" intro="Time from opening the app to the booking being sent. Target: under 30 seconds for returning customers.">
          <p className="text-[28px] font-semibold text-navy" data-metric="open-to-booked">
            {pct(m.openToBooked.under30)}
          </p>
          <p className="t-small text-secondary">booked in under 30 seconds ({n(m.openToBooked.timed)} timed bookings)</p>
          <div className="mt-3">
            <Facts items={OPEN_BUCKETS.map((b, i) => ({ label: BUCKET_NAMES[b], value: n(m.openToBooked.buckets[i].count) }))} />
          </div>
        </Panel>

        <Panel title="Lapsed reactivation" intro="People who opened the app on the welcome-back card (no order for 60+ days) and booked within 14 days.">
          <p className="text-[28px] font-semibold text-navy" data-metric="lapsed">
            {pct(m.lapsed.share)}
          </p>
          <p className="t-small text-secondary">
            {n(m.lapsed.booked)} of {n(m.lapsed.visitors)} people
          </p>
        </Panel>

        <Panel title="Order tracking" intro="Order screens opened in the app, and WhatsApp taps from an order's help. The first should rise and the second fall. Messages sent to WhatsApp directly are not counted here.">
          <Facts
            items={[
              { label: "Order views", value: n(m.tracking.orderViews) },
              ...m.tracking.byStep.map((s) => ({ label: `  at "${s.step}"`, value: n(s.count) })),
              { label: "WhatsApp from an order", value: n(m.tracking.helpWhatsapp), sub: m.tracking.perWeek === null ? undefined : `${m.tracking.perWeek.toFixed(1)} a week` },
            ]}
          />
        </Panel>

        <Panel title="Weekly pickup" intro="Requests and changes made in the app. Survival over 8 weeks comes from the weekly pickups Velto Ops runs (Bring customers back).">
          <Facts
            items={[
              { label: "Requested", value: n(m.weekly.requests) },
              { label: "Changed", value: n(m.weekly.changes) },
              { label: "Paused or withdrawn", value: n(m.weekly.pauses) },
              { label: "Resumed", value: n(m.weekly.resumes) },
              { label: "Stopped", value: n(m.weekly.stops) },
            ]}
          />
        </Panel>

        <Panel title="Notifications" intro="After the first booking, and from Profile → Notifications. Phones that receive them are on the Reminders page.">
          <Facts
            items={[
              { label: "Asked (Turn on tapped)", value: n(m.notifications.prompts) },
              { label: "Turned on", value: n(m.notifications.on), sub: m.notifications.optIn === null ? undefined : `${pct(m.notifications.optIn)} of asks` },
              { label: "Blocked on the phone", value: n(m.notifications.denied) },
              { label: "A kind turned off", value: n(m.notifications.off) },
            ]}
          />
        </Panel>

        <Panel title="Bangla" intro="Share of app sessions in Bangla, and whether Bangla sessions book as often as English ones (sessions that opened the app and booked).">
          <Facts
            items={[
              { label: "Bangla share of sessions", value: pct(m.language.share), sub: `${n(m.language.bangla)} of ${n(m.language.sessions)}` },
              { label: "Booked, Bangla sessions", value: pct(m.language.completion.bn) },
              { label: "Booked, English sessions", value: pct(m.language.completion.en) },
            ]}
          />
        </Panel>
      </div>
      {loaded.state === "ok" && loaded.data.truncated ? <p className="mt-4 t-small text-secondary">Showing the newest 20,000 app events in this range.</p> : null}
    </>
  );
}
