import Link from "next/link";
import { AdminNav } from "@/components/admin/AdminNav";
import { Logo } from "@/components/ui/Logo";
import { getRequests } from "@/lib/admin/analytics-data";
import { getNotifications } from "@/lib/admin/notifications";
import { isAdminPreview } from "@/lib/admin/preview";
import { requireAdmin } from "@/lib/admin/session";
import { logoutAction } from "../actions";

function Bell({ unread }: { unread: number }) {
  return (
    <Link
      href="/admin/notifications"
      className="relative inline-flex size-10 items-center justify-center rounded-md text-white/80 hover:bg-white/10 hover:text-white"
      aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15L6 16Z" />
        <path d="M10 20.5a2.2 2.2 0 0 0 4 0" />
      </svg>
      {unread ? (
        <span className="absolute right-1 top-1 inline-flex min-w-[18px] items-center justify-center rounded-full bg-cyan px-1 text-[11px] font-bold leading-[18px] text-navy">
          {unread > 9 ? "9+" : unread}
        </span>
      ) : null}
    </Link>
  );
}

export default async function AdminPanelLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();
  const [{ unread }, requests] = await Promise.all([getNotifications(), getRequests(500)]);
  // Live count next to "Bookings & quotes": requests still open in Velto Ops.
  const openRequests = requests.state === "ok" ? requests.data.filter((r) => r.status !== "done").length : 0;
  return (
    <div className="lg:grid lg:min-h-dvh lg:grid-cols-[280px_1fr]">
      <aside className="bg-navy px-4 py-3 text-white lg:sticky lg:top-0 lg:flex lg:h-dvh lg:flex-col lg:overflow-y-auto lg:px-5 lg:py-6">
        <div className="flex items-center justify-between gap-3">
          <Link href="/admin" aria-label="Command center home" className="inline-flex">
            <Logo inverse className="h-8" />
          </Link>
          <div className="flex items-center gap-1">
            <Bell unread={unread} />
          </div>
        </div>
        <p className="mt-3 hidden t-caption uppercase tracking-[0.08em] text-white/50 lg:block">Website Command Center</p>
        <div className="mt-3 lg:mt-7">
          <AdminNav badges={{ "/admin/requests": openRequests }} />
        </div>
        <div className="mt-4 hidden border-t border-white/15 pt-4 lg:mt-auto lg:block">
          <Link href="/" target="_blank" className="t-small text-white/70 underline underline-offset-4 hover:text-white">
            View website ↗
          </Link>
          <p className="mt-4 t-small font-semibold">{admin.name}</p>
          <p className="t-caption text-white/60">{admin.email}</p>
          <form action={logoutAction} className="mt-3">
            <button type="submit" className="t-small text-white/80 underline underline-offset-4 hover:text-white">
              Sign out
            </button>
          </form>
        </div>
      </aside>
      <main className="min-w-0 px-4 py-6 md:px-8 md:py-9 xl:px-12">
        <div className="mx-auto max-w-[1200px]">
          {isAdminPreview() ? (
            <p className="mb-6 rounded-md border border-purple/30 bg-[#f3f0f8] px-4 py-2.5 t-small font-medium text-purple">
              Local preview — synthetic data, not real visitors or customers.
            </p>
          ) : null}
          {children}
        </div>
        <Link href="/" target="_blank" className="mt-10 block t-small text-secondary underline underline-offset-4 lg:hidden">
          View website ↗
        </Link>
        <form action={logoutAction} className="mt-3 lg:hidden">
          <button type="submit" className="t-small text-secondary underline underline-offset-4">
            Sign out ({admin.name})
          </button>
        </form>
      </main>
    </div>
  );
}
