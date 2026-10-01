import Link from "next/link";

/**
 * Week 1 of Today (spec docs/superpowers/specs/2026-10-01-today-scheduling-design.md §10): the old
 * scheduling screens stay and point to the new one. Removed in week 2 with the redirects.
 */
export function TryTodayBanner() {
  return (
    <aside aria-label="New Today screen" className="mb-6 flex flex-col gap-3 rounded-md border border-line bg-soft px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="t-small text-navy">
        <span className="font-semibold">New: Today.</span> Call customers, choose riders and plan deliveries on one screen.
      </p>
      <Link href="/admin/today" className="admin-btn self-start sm:self-auto">
        Try the new Today screen
      </Link>
    </aside>
  );
}
