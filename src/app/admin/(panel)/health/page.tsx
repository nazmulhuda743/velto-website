import Link from "next/link";
import { StatusDot, fmt } from "@/components/admin/charts";
import { DataTable, Td } from "@/components/admin/tables";
import { AdminHeader, Panel } from "@/components/admin/ui";
import { getServerEvents, recordHealthChecks } from "@/lib/admin/analytics-data";
import { contentIssues, runHealthChecks } from "@/lib/admin/health";
import { dayLabel, timeAgo } from "@/lib/admin/page-helpers";

export const metadata = { title: "Website health · Velto Command Center" };

const KIND_LABELS: Record<string, string> = {
  booking_error: "Booking API error",
  quote_error: "Quote API error",
  pricing_error: "Pricing API error",
  tracking_error: "Tracking API error",
  not_found: "Page not found (404)",
  media_upload_error: "Media upload failed",
  content_save_error: "Content save failed",
};

export default async function HealthPage() {
  const [checks, events, issues] = await Promise.all([runHealthChecks(), getServerEvents(7), contentIssues()]);
  const memory = await recordHealthChecks(checks.map((c) => ({ id: c.id, status: c.status })));
  const checkedAt = new Date().toISOString();
  const counts = { healthy: 0, warning: 0, error: 0 };
  for (const c of checks) counts[c.status] += 1;
  const groups = [...new Set(checks.map((c) => c.group))];
  const list = events.state === "ok" ? events.data : [];
  const errors = list.filter((e) => e.kind !== "not_found");
  const notFound = new Map<string, number>();
  for (const e of list.filter((e) => e.kind === "not_found")) notFound.set(e.path ?? "?", (notFound.get(e.path ?? "?") ?? 0) + 1);

  return (
    <>
      <AdminHeader
        title="Website health"
        intro={`Live checks, run when this page loads. Checked ${dayLabel(checkedAt)} (Dhaka time).`}
        actions={
          <Link href="/admin/health" className="admin-btn-secondary">
            Run checks again
          </Link>
        }
      />

      <div className="admin-card mt-6 flex flex-wrap items-center gap-x-8 gap-y-3 px-5 py-4" role="status">
        <p className="text-[17px] font-semibold text-navy">
          {counts.error ? `${counts.error} problem${counts.error === 1 ? " needs" : "s need"} attention` : counts.warning ? "Working, with warnings" : "Everything is healthy"}
        </p>
        <p className="flex gap-5 t-small text-secondary">
          <span>
            <span className="font-semibold text-success">{counts.healthy}</span> healthy
          </span>
          <span>
            <span className="font-semibold text-[#8a5300]">{counts.warning}</span> warning
          </span>
          <span>
            <span className="font-semibold text-error">{counts.error}</span> error
          </span>
        </p>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        {groups.map((group) => (
          <Panel key={group} title={group}>
            <ul className="divide-y divide-line">
              {checks
                .filter((c) => c.group === group)
                .map((c) => (
                  <li key={c.id} className="grid gap-1 py-3 sm:grid-cols-[11rem_1fr] sm:gap-4">
                    <div>
                      <p className="font-semibold text-navy">{c.label}</p>
                      <StatusDot status={c.status} />
                    </div>
                    <div>
                      <p className="t-small text-body">{c.detail}</p>
                      <p className="mt-1 t-caption text-secondary">
                        Last successful check: {c.status === "healthy" ? "now" : memory[c.id]?.last_ok_at ? timeAgo(memory[c.id].last_ok_at) : "not recorded"}
                      </p>
                    </div>
                  </li>
                ))}
            </ul>
          </Panel>
        ))}
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        <Panel title="Recent errors" intro="Last 7 days. Only the kind, route and a safe error code are stored.">
          {events.state !== "ok" ? (
            <p className="t-small text-secondary">{events.state === "error" ? events.message : "Error logging needs the analytics tables and WEBSITE_ANALYTICS_WRITES_ENABLED."}</p>
          ) : errors.length === 0 ? (
            <p className="t-small text-secondary">No booking, quote, pricing, tracking or dashboard errors recorded.</p>
          ) : (
            <DataTable leftCols={3} caption="Recent website errors" head={["What", "Where", "Code", "When"]}>
              {errors.slice(0, 30).map((e) => (
                <tr key={e.id}>
                  <Td first>{KIND_LABELS[e.kind] ?? e.kind}</Td>
                  <Td left>{e.route ?? "—"}</Td>
                  <Td left>{e.code ?? "—"}</Td>
                  <Td>{dayLabel(e.occurred_at)}</Td>
                </tr>
              ))}
            </DataTable>
          )}
        </Panel>
        <Panel title="Pages not found" intro="404s in the last 7 days (long numbers in links are redacted).">
          {notFound.size === 0 ? (
            <p className="t-small text-secondary">No 404s recorded.</p>
          ) : (
            <ul className="divide-y divide-line">
              {[...notFound.entries()]
                .sort((a, b) => b[1] - a[1])
                .slice(0, 12)
                .map(([path, n]) => (
                  <li key={path} className="flex justify-between gap-4 py-2 t-small">
                    <span className="min-w-0 truncate font-mono text-navy">{path}</span>
                    <span className="shrink-0 font-semibold tabular-nums text-navy">{fmt(n)}</span>
                  </li>
                ))}
            </ul>
          )}
        </Panel>
      </div>

      <Panel className="mt-6" title="Content configuration">
        <ul className="divide-y divide-line">
          <li className="grid gap-1 py-3 sm:grid-cols-[14rem_1fr] sm:gap-4">
            <p className="font-semibold text-navy">Pages hidden from Google</p>
            <p className="t-small text-body">
              {issues.noindexed.length ? (
                <>
                  {issues.noindexed.map((r) => r.label).join(", ")}.{" "}
                  <Link href="/admin/seo?view=noindex" className="font-semibold text-action underline underline-offset-4">
                    Review
                  </Link>
                </>
              ) : (
                "None set from the dashboard. /book, /quote, /privacy, /terms and /cookies are intentionally noindex and outside the sitemap."
              )}
            </p>
          </li>
          <li className="grid gap-1 py-3 sm:grid-cols-[14rem_1fr] sm:gap-4">
            <p className="font-semibold text-navy">Missing SEO descriptions</p>
            <p className="t-small text-body">{issues.missingDescription.length ? issues.missingDescription.map((r) => r.label).join(", ") : "Every page has a description."}</p>
          </li>
          <li className="grid gap-1 py-3 sm:grid-cols-[14rem_1fr] sm:gap-4">
            <p className="font-semibold text-navy">Images</p>
            <p className="t-small text-body">
              {issues.missingImages.length} slot{issues.missingImages.length === 1 ? "" : "s"} without any photo, {issues.stockImages.length} still using licensed stock
              photography, {issues.missingAlt.length} without alt text.{" "}
              <Link href="/admin/images" className="font-semibold text-action underline underline-offset-4">
                Manage images
              </Link>
            </p>
          </li>
        </ul>
      </Panel>
    </>
  );
}
