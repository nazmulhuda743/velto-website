import Link from "next/link";
import { NotificationRefresher } from "@/components/admin/NotificationRefresher";
import { AdminHeader } from "@/components/admin/ui";
import { getNotifications } from "@/lib/admin/notifications";
import { timeAgo } from "@/lib/admin/page-helpers";
import { markNotificationsReadAction } from "../../actions";

export const metadata = { title: "Notifications · Velto Command Center" };

const TONES = {
  error: { label: "Problem", dot: "bg-error" },
  action: { label: "New", dot: "bg-blue" },
  warning: { label: "Warning", dot: "bg-[#c77c02]" },
  info: { label: "Setup", dot: "bg-line-strong" },
} as const;

export default async function NotificationsPage() {
  const { items, unread } = await getNotifications();
  return (
    <>
      <NotificationRefresher />
      <AdminHeader
        title="Notifications"
        intro="New requests, failures and configuration problems. Refreshes every two minutes while this tab is open."
        actions={
          unread ? (
            <form action={markNotificationsReadAction}>
              <button type="submit" className="admin-btn-secondary">
                Mark all as read
              </button>
            </form>
          ) : null
        }
      />
      {items.length === 0 ? (
        <p className="admin-card mt-6 p-6 t-small text-secondary">Nothing to report. New website requests and problems will appear here.</p>
      ) : (
        <ul className="admin-card mt-6 divide-y divide-line">
          {items.map((n) => (
            <li key={n.id} className="grid gap-2 px-5 py-4 sm:grid-cols-[1fr_auto] sm:items-center sm:gap-6">
              <div className="flex gap-3">
                <span aria-hidden="true" className={`mt-2 size-2.5 shrink-0 rounded-full ${TONES[n.tone].dot}`} />
                <div className="min-w-0">
                  <p className="font-semibold text-navy">
                    <span className="sr-only">{TONES[n.tone].label}: </span>
                    {n.title}
                  </p>
                  <p className="t-small text-secondary">
                    {n.body}
                    {n.at ? ` · ${timeAgo(n.at)}` : ""}
                  </p>
                </div>
              </div>
              <Link href={n.href} className="admin-btn-secondary justify-self-start sm:justify-self-end">
                {n.action}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
