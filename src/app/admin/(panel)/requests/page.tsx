import Link from "next/link";
import { BarList, fmt } from "@/components/admin/charts";
import { NotificationRefresher } from "@/components/admin/NotificationRefresher";
import { AdminHeader, Badge, one, type SearchParams } from "@/components/admin/ui";
import { CHANNEL_LABELS } from "@/lib/analytics/classify";
import { getRequests } from "@/lib/admin/analytics-data";
import { pageLabel } from "@/lib/admin/insights";
import { requestDate } from "@/lib/admin/request-details";
import { QUICK_FILTERS, analyseRequest, formatAge, matchesQuickFilter, requestSummary } from "@/lib/admin/request-intel";

export const metadata = { title: "Bookings & quotes · Velto Command Center" };

const waLink = (phone: string) => {
  const d = phone.replace(/\D/g, "");
  const intl = d.startsWith("880") ? d : d.startsWith("0") ? `88${d}` : d;
  return `https://wa.me/${intl}`;
};

function Breakdown({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="t-caption font-semibold uppercase tracking-[0.04em] text-secondary">{title}</h3>
      <div className="mt-1">{children}</div>
    </div>
  );
}

const bars = (list: { label: string; count: number }[], limit = 6) => list.slice(0, limit).map((x) => ({ key: x.label, label: x.label, value: x.count }));

export default async function RequestsPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const filter = one(params.filter) ?? "all";
  const q = (one(params.q) ?? "").trim().toLowerCase().slice(0, 60);

  const loaded = await getRequests(500);
  const all = loaded.state === "ok" ? loaded.data.map((r) => analyseRequest(r)) : [];
  const summary = requestSummary(all);
  const rows = all.filter((i) => matchesQuickFilter(i, filter) && (!q || `${i.request.title} ${i.request.description ?? ""}`.toLowerCase().includes(q)));

  return (
    <>
      <NotificationRefresher />
      <AdminHeader
        title="Bookings & quotes"
        intro="Every pickup booking and household quote sent from the website. They live in the Velto Ops task list, where staff assign and complete them. Status here is read from Ops."
      />

      {loaded.state !== "ok" ? (
        <p role="alert" className="mt-6 t-small text-error">
          {loaded.state === "error" ? loaded.message : "Velto Ops is not connected on this server."}
        </p>
      ) : null}

      <section aria-label="Request totals" className="admin-card mt-6 grid grid-cols-2 divide-line md:grid-cols-5 md:divide-x">
        {[
          { label: "Today", value: summary.today },
          { label: "Last 7 days", value: summary.last7 },
          { label: "Last 30 days", value: summary.last30 },
          { label: "Bookings / quotes", value: `${fmt(summary.bookings)} / ${fmt(summary.quotes)}` },
          {
            label: "Open in Ops",
            value: summary.open,
            sub: summary.openOver24h ? `${summary.openOver24h} older than 24 h` : summary.oldestOpenHours !== null ? `oldest ${formatAge(summary.oldestOpenHours)}` : "none open",
          },
        ].map((s, i) => (
          <div key={s.label} className={`p-5 ${i > 1 ? "border-t border-line md:border-t-0" : ""} ${i === 4 ? "col-span-2 md:col-span-1" : ""}`}>
            <p className="t-small text-secondary">{s.label}</p>
            <p className="mt-1 text-[28px] font-semibold leading-none tabular-nums text-navy">{typeof s.value === "number" ? fmt(s.value) : s.value}</p>
            {"sub" in s && s.sub ? <p className={`mt-2 t-caption ${summary.openOver24h ? "font-semibold text-error" : "text-secondary"}`}>{s.sub}</p> : null}
          </div>
        ))}
      </section>

      <details className="admin-card group mt-4">
        <summary className="flex cursor-pointer list-none items-center justify-between px-5 py-4 font-semibold text-navy">
          Breakdown by service, area, source, landing page and device
          <span aria-hidden="true" className="text-secondary transition-transform group-open:rotate-180">
            ⌄
          </span>
        </summary>
        <div className="grid gap-6 border-t border-line p-5 md:grid-cols-2 xl:grid-cols-3">
          <Breakdown title="Service">
            <BarList items={bars(summary.byService)} total={all.length} />
          </Breakdown>
          <Breakdown title="Area">
            <BarList items={bars(summary.byArea)} total={all.length} />
          </Breakdown>
          <Breakdown title="Source">
            <BarList items={bars(summary.byChannel)} total={all.length} />
          </Breakdown>
          <Breakdown title="Landing page">
            <BarList items={bars(summary.byLanding.map((l) => ({ ...l, label: l.label.startsWith("/") ? pageLabel(l.label) : l.label })))} total={all.length} />
          </Breakdown>
          <Breakdown title="Device">
            <BarList items={bars(summary.byDevice)} total={all.length} />
          </Breakdown>
        </div>
        <p className="border-t border-line px-5 py-3 t-caption text-secondary">
          Source, landing page and device come from the campaign context sent with each request. Requests sent before this was added show “Not recorded”.
        </p>
      </details>

      <div className="mt-6 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Quick filters">
          {QUICK_FILTERS.map((f) => {
            const n = f.key === "all" ? all.length : all.filter((i) => matchesQuickFilter(i, f.key)).length;
            return (
              <Link
                key={f.key}
                href={`/admin/requests?${new URLSearchParams({ filter: f.key, ...(q ? { q } : {}) })}`}
                aria-current={filter === f.key ? "page" : undefined}
                className={`rounded-full border px-3 py-1.5 t-small font-semibold ${
                  filter === f.key ? "border-navy bg-navy text-white" : "border-line bg-white text-navy hover:border-navy"
                }`}
              >
                {f.label} <span className={filter === f.key ? "text-white/70" : "text-secondary"}>{n}</span>
              </Link>
            );
          })}
        </div>
        <form className="flex shrink-0 gap-2">
          <input type="hidden" name="filter" value={filter} />
          <input name="q" defaultValue={q} placeholder="Search name, phone, area" className="admin-input lg:w-64" aria-label="Search requests" />
          <button className="admin-btn-secondary" type="submit">
            Search
          </button>
        </form>
      </div>

      <p className="mt-6 t-small text-secondary">
        {rows.length} request{rows.length === 1 ? "" : "s"}
      </p>
      <ul className="mt-2 space-y-2">
        {rows.map((i) => {
          const r = i.request;
          const d = i.details;
          return (
            <li key={r.id} className="admin-card">
              <details className="group">
                <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-4 gap-y-1 px-5 py-4">
                  <Badge tone={i.kind === "booking" ? "blue" : "amber"}>{i.kind === "booking" ? "Booking" : "Quote"}</Badge>
                  <span className="font-semibold text-navy">{d.Name ?? r.title}</span>
                  <span className="t-small text-secondary">{d.Phone}</span>
                  <span className="t-small text-secondary">{i.service ?? ""}</span>
                  <span className="t-small text-secondary">{i.area ?? ""}</span>
                  <span className="ml-auto t-small text-secondary">
                    {requestDate(r.created_at)}
                    {i.open ? <span className={i.ageHours >= 24 ? "font-semibold text-error" : ""}> · open {formatAge(i.ageHours)}</span> : null}
                  </span>
                  <Badge tone={r.status === "done" ? "green" : "neutral"}>{r.status}</Badge>
                </summary>
                <div className="border-t border-line px-5 py-4">
                  <dl className="grid gap-x-8 gap-y-2 md:grid-cols-2 xl:grid-cols-3">
                    {Object.entries(d)
                      .filter(([k]) => k !== "Campaign")
                      .map(([k, v]) => (
                        <div key={k}>
                          <dt className="t-caption uppercase tracking-[0.04em] text-secondary">{k}</dt>
                          <dd className="text-navy [overflow-wrap:anywhere]">{v}</dd>
                        </div>
                      ))}
                    <div>
                      <dt className="t-caption uppercase tracking-[0.04em] text-secondary">Outlet</dt>
                      <dd className="text-navy">{r.outlet_code ?? "—"}</dd>
                    </div>
                    <div>
                      <dt className="t-caption uppercase tracking-[0.04em] text-secondary">Source</dt>
                      <dd className="text-navy">
                        {CHANNEL_LABELS[i.channel]}
                        {i.campaign.utm_campaign ? ` · ${i.campaign.utm_campaign}` : ""}
                      </dd>
                    </div>
                    <div>
                      <dt className="t-caption uppercase tracking-[0.04em] text-secondary">Landing page</dt>
                      <dd className="text-navy">{i.landing ? pageLabel(i.landing) : "Not recorded"}</dd>
                    </div>
                    <div>
                      <dt className="t-caption uppercase tracking-[0.04em] text-secondary">Device</dt>
                      <dd className="text-navy">{i.device ?? "Not recorded"}</dd>
                    </div>
                    {r.done_by_name ? (
                      <div>
                        <dt className="t-caption uppercase tracking-[0.04em] text-secondary">Done by</dt>
                        <dd className="text-navy">{r.done_by_name}</dd>
                      </div>
                    ) : null}
                  </dl>
                  {d.Phone ? (
                    <div className="mt-4 flex flex-wrap gap-2">
                      <a href={`tel:${d.Phone.replace(/[^\d+]/g, "")}`} className="admin-btn-secondary">
                        Call
                      </a>
                      <a href={waLink(d.Phone)} target="_blank" rel="noopener noreferrer" className="admin-btn-secondary">
                        WhatsApp
                      </a>
                    </div>
                  ) : null}
                </div>
              </details>
            </li>
          );
        })}
      </ul>
    </>
  );
}
