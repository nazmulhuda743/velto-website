import Link from "next/link";
import { Delta, FunnelChart, Sparkline, fmt } from "@/components/admin/charts";
import { NotificationRefresher } from "@/components/admin/NotificationRefresher";
import { AdminHeader, Badge, DataNotice, Facts, Panel, RangePicker, type SearchParams } from "@/components/admin/ui";
import { IMAGE_SLOTS } from "@/content/mock";
import { SEO_ROUTES } from "@/content/seo-routes";
import { CHANNEL_LABELS } from "@/lib/analytics/classify";
import { getConsentSummary, getRequests, isAnalyticsWritesEnabled, sessionsFor } from "@/lib/admin/analytics-data";
import { consentRates, dailySeries, delta, funnel, overview, pageLabel, pct, type SessionRow } from "@/lib/admin/insights";
import { getNotifications } from "@/lib/admin/notifications";
import { dayLabel, readDashboardParams, serviceName } from "@/lib/admin/page-helpers";
import { requestDate, requestDetails } from "@/lib/admin/request-details";
import { formatAge, todaySummary } from "@/lib/admin/request-intel";
import { requireSection } from "@/lib/admin/session";
import { getSiteContent } from "@/lib/site-content";

/** Dhaka-time greeting for the person signed in. */
function greeting(name: string, now = new Date()) {
  const hour = (now.getUTCHours() + 6) % 24;
  const part = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const first = name.trim().split(/\s+/)[0];
  return first ? `${part}, ${first}` : part;
}

/** One "what needs doing" tile: big number, plain label, one clear next step. */
function TodayTile({ href, value, label, detail, cta, urgent = false }: { href: string; value: number; label: string; detail: string; cta: string; urgent?: boolean }) {
  return (
    <Link
      href={href}
      className={`group grid grid-cols-[3.25rem_1fr] items-start gap-x-3 rounded-lg border p-4 transition-colors sm:flex sm:flex-col md:p-5 ${
        urgent ? "border-error/40 bg-error-soft hover:border-error" : "border-line bg-white hover:border-navy"
      }`}
    >
      <span className={`row-span-3 text-[32px] font-semibold leading-none tracking-[-0.02em] tabular-nums sm:text-[36px] ${urgent ? "text-error" : "text-navy"}`}>{value}</span>
      <span className="text-[15px] font-semibold text-navy sm:mt-2">{label}</span>
      <span className="mt-0.5 t-small text-secondary">{detail}</span>
      <span className="mt-2 t-small font-semibold text-action-hover group-hover:underline group-hover:underline-offset-4 sm:mt-3">{cta} →</span>
    </Link>
  );
}

function Metric({ label, value, change, sub }: { label: string; value: string; change: number | null; sub?: string }) {
  return (
    <div className="border-t border-line py-4 first:border-t-0 sm:px-5 sm:py-5 sm:[&:nth-child(-n+3)]:border-t-0 sm:[&:not(:nth-child(3n+1))]:border-l">
      <p className="t-small text-secondary">{label}</p>
      <p className="mt-1 text-[28px] font-semibold leading-none tracking-[-0.02em] tabular-nums text-navy">{value}</p>
      <p className="mt-2">
        <Delta value={change} />
      </p>
      {sub ? <p className="mt-1 t-caption text-secondary">{sub}</p> : null}
    </div>
  );
}

export default async function CommandCenter({ searchParams }: { searchParams: SearchParams }) {
  const { flat, range } = readDashboardParams(await searchParams);
  const admin = await requireSection("overview");
  const [current, previous, consent, requests, content, notes] = await Promise.all([
    sessionsFor(range),
    sessionsFor({ from: range.prevFrom, to: range.prevTo }),
    getConsentSummary(range),
    getRequests(500),
    getSiteContent(),
    getNotifications(),
  ]);

  const rows: SessionRow[] = current.state === "ok" ? current.data.rows : [];
  const prevRows: SessionRow[] = previous.state === "ok" ? previous.data.rows : [];
  const o = overview(rows);
  const p = overview(prevRows);
  const f = funnel(rows);
  const series = dailySeries(rows, range).map((d) => d.count);
  const rates = consent.state === "ok" ? consentRates(consent.data) : null;
  const preview = current.state === "ok" && current.preview;

  const inRange = requests.state === "ok" ? requests.data.filter((r) => r.created_at >= range.from.toISOString() && r.created_at < range.to.toISOString()) : [];
  const opsBookings = inRange.filter((r) => r.source === "website_booking").length;
  const opsQuotes = inRange.length - opsBookings;

  // "Today" strip: independent of the date range above, always about right now.
  const req = todaySummary(requests.state === "ok" ? requests.data : []);
  const newOpen = req.newOpen;
  const alerts = notes.items.filter((n) => n.tone === "error" || n.tone === "warning").length;

  return (
    <>
      <NotificationRefresher />
      <p className="t-small font-medium text-secondary">{greeting(admin.name)}</p>
      <h1 className="mt-1 t-h3 text-navy">Here&apos;s what needs you today</h1>

      {requests.state === "ok" ? (
        <section aria-label="Today" className="mt-5 grid gap-3 sm:grid-cols-3">
          <TodayTile
            href="/admin/requests?filter=new"
            value={newOpen}
            label={newOpen === 1 ? "New request" : "New requests"}
            detail="Sent in the last 24 hours and still open in Ops."
            cta={newOpen ? "Review them" : "See all requests"}
          />
          <TodayTile
            href="/admin/requests?filter=open"
            value={req.openOver24h}
            label="Waiting over 24 hours"
            detail={req.oldestOpenHours !== null ? `Oldest open request: ${formatAge(req.oldestOpenHours)}.` : "Nothing is open right now."}
            cta={req.openOver24h ? "Follow up" : "See open requests"}
            urgent={req.openOver24h > 0}
          />
          <TodayTile
            href="/admin/notifications"
            value={alerts}
            label={alerts === 1 ? "Website alert" : "Website alerts"}
            detail={alerts ? "Errors or warnings to check." : "No errors or warnings."}
            cta={alerts ? "Check alerts" : "All notifications"}
            urgent={notes.items.some((n) => n.tone === "error")}
          />
        </section>
      ) : null}

      <div className="mt-10 border-t border-line pt-8">
        <AdminHeader
          title="Website performance"
          level={2}
          intro={`Visitors, conversions, campaigns and website health · ${range.label} (Dhaka time)`}
          actions={<RangePicker basePath="/admin" params={flat} active={range.key} from={flat.from} to={flat.to} />}
        />
      </div>

      {current.state === "not_configured" ? <DataNotice state="not_configured" /> : null}
      {current.state === "error" ? <DataNotice state="error" message={current.message} /> : null}
      {!preview && current.state === "ok" && !isAnalyticsWritesEnabled() ? <DataNotice state="off" /> : null}

      {/* Primary business signals */}
      <section aria-labelledby="signals" className="admin-card mt-6 grid overflow-hidden lg:grid-cols-[minmax(0,5fr)_minmax(0,9fr)]">
        <h2 id="signals" className="sr-only">
          Primary business signals
        </h2>
        <div className="border-b border-line bg-navy p-6 text-white lg:border-b-0 lg:border-r">
          <p className="t-small text-white/70">Website conversion rate</p>
          <p className="mt-2 text-[52px] font-semibold leading-none tracking-[-0.03em] tabular-nums">{pct(o.conversionRate)}</p>
          <p className="mt-3 t-small text-white/75">
            {fmt(o.conversions)} of {fmt(o.sessions)} sessions sent a booking or quote.
          </p>
          <div className="mt-6 text-cyan">
            <Sparkline values={series} width={280} height={48} label={`Sessions per day: ${series.join(", ")}`} className="w-full" />
          </div>
          <p className="mt-2 t-caption text-white/60">Sessions per day</p>
        </div>
        <div className="grid px-5 sm:grid-cols-3 sm:px-0">
          <Metric label="Visitors" value={fmt(o.visitors)} change={delta(o.visitors, p.visitors)} />
          <Metric label="Sessions" value={fmt(o.sessions)} change={delta(o.sessions, p.sessions)} />
          <Metric label="Booking starts" value={fmt(o.bookingStarts)} change={delta(o.bookingStarts, p.bookingStarts)} />
          <Metric label="Successful bookings" value={fmt(o.bookings)} change={delta(o.bookings, p.bookings)} sub={requests.state === "ok" ? `Velto Ops received ${fmt(opsBookings)}` : undefined} />
          <Metric label="Quote requests" value={fmt(o.quotes)} change={delta(o.quotes, p.quotes)} sub={requests.state === "ok" ? `Velto Ops received ${fmt(opsQuotes)}` : undefined} />
          <Metric label="WhatsApp clicks" value={fmt(o.whatsapp)} change={delta(o.whatsapp, p.whatsapp)} sub="sessions with a WhatsApp tap" />
        </div>
      </section>
      <p className="mt-2 t-caption text-secondary">
        Counted from visitors who allowed analytics. Velto Ops counts include every request. Revenue isn&apos;t shown: orders are not yet linked to
        website sessions.
      </p>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        <Panel
          title="Conversion funnel"
          intro="Sessions by the furthest stage reached."
          action={
            <Link href={`/admin/funnel?${new URLSearchParams({ range: range.key, ...(flat.from ? { from: flat.from, to: flat.to ?? "" } : {}) })}`} className="font-semibold text-navy underline underline-offset-4">
              Filter the funnel
            </Link>
          }
        >
          <FunnelChart steps={f.steps} compact />
          <p className="mt-4 border-t border-line pt-3 t-small text-secondary">
            WhatsApp fallback: <span className="font-semibold text-navy">{fmt(f.whatsappFallback)}</span> sessions tapped WhatsApp without sending a form (
            {pct(f.whatsappFallbackRate)} of those who didn&apos;t convert).
          </p>
        </Panel>

        <Panel title="Secondary signals">
          <Facts
            items={[
              { label: "New visitors", value: fmt(o.newVisitors), sub: `${fmt(o.returningVisitors)} returning` },
              { label: "Pages per session", value: o.pagesPerSession === null ? "—" : o.pagesPerSession.toFixed(1) },
              { label: "Top service", value: o.topService ? serviceName(o.topService.key) : "—", sub: o.topService ? `${fmt(o.topService.count)} views` : undefined },
              { label: "Top landing page", value: o.topLanding ? pageLabel(o.topLanding.key) : "—", sub: o.topLanding ? `${pct(o.topLanding.share)} of sessions` : undefined },
              { label: "Top source", value: o.topChannel ? CHANNEL_LABELS[o.topChannel.channel] : "—", sub: o.topChannel ? `${fmt(o.topChannel.count)} sessions` : undefined },
              { label: "Analytics consent", value: pct(rates?.analytics ?? null), sub: consent.state === "ok" ? `${fmt(consent.data.decisions)} decisions` : "no data" },
              { label: "Marketing consent", value: pct(rates?.marketing ?? null) },
            ]}
          />
        </Panel>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Panel
          title="Needs attention"
          action={
            <Link href="/admin/notifications" className="font-semibold text-navy underline underline-offset-4">
              All notifications
            </Link>
          }
        >
          {notes.items.filter((n) => n.tone !== "info").length === 0 ? (
            <p className="t-small text-secondary">Nothing needs attention right now.</p>
          ) : (
            <ul className="divide-y divide-line">
              {notes.items
                .filter((n) => n.tone !== "info")
                .slice(0, 5)
                .map((n) => (
                  <li key={n.id} className="flex items-start justify-between gap-4 py-2.5">
                    <div className="min-w-0">
                      <p className="font-semibold text-navy">{n.title}</p>
                      <p className="t-small text-secondary">{n.body}</p>
                    </div>
                    <Link href={n.href} className="shrink-0 t-small font-semibold text-action underline underline-offset-4">
                      {n.action}
                    </Link>
                  </li>
                ))}
            </ul>
          )}
        </Panel>

        <Panel
          title="Latest requests"
          intro="From the Velto Ops task list."
          action={
            <Link href="/admin/requests" className="font-semibold text-navy underline underline-offset-4">
              See all
            </Link>
          }
        >
          {requests.state !== "ok" ? (
            <p className="t-small text-error">{requests.state === "error" ? requests.message : "Velto Ops is not connected on this server."}</p>
          ) : requests.data.length === 0 ? (
            <p className="t-small text-secondary">No website bookings or quotes yet.</p>
          ) : (
            <ul className="divide-y divide-line">
              {requests.data.slice(0, 6).map((r) => {
                const d = requestDetails(r.description);
                return (
                  <li key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5">
                    <Badge tone={r.source === "website_booking" ? "blue" : "amber"}>{r.source === "website_booking" ? "Booking" : "Quote"}</Badge>
                    <span className="font-semibold text-navy">{d.Name ?? r.title}</span>
                    <span className="t-small text-secondary">{d.Service ?? ""}</span>
                    {/* Date and status stay together so a long name never splits them across lines. */}
                    <span className="ml-auto flex items-center gap-3">
                      <span className="t-small text-secondary">{requestDate(r.created_at)}</span>
                      <Badge tone={r.status === "done" ? "green" : "neutral"}>{r.status}</Badge>
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
      </div>

      <Panel title="Website content" className="mt-6">
        <Facts
          columns={2}
          items={[
            { label: "Pages with custom SEO", value: `${SEO_ROUTES.filter((r) => content.seo[r.path]).length} / ${SEO_ROUTES.length}` },
            { label: "Photos replaced", value: `${IMAGE_SLOTS.filter((s) => content.images[s.id]).length} / ${IMAGE_SLOTS.length}` },
            { label: "Reviews", value: fmt(content.reviews.length), sub: `${content.reviews.filter((r) => r.showOnHome).length} on the homepage` },
            { label: "Announcement bar", value: content.settings.announcement.enabled ? "On" : "Off", sub: `WhatsApp +${content.settings.whatsappNumber}` },
          ]}
        />
        <p className="mt-3 t-caption text-secondary">Data checked {dayLabel(new Date().toISOString())}.</p>
      </Panel>
    </>
  );
}
