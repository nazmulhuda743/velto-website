import Link from "next/link";
import { cookies } from "next/headers";
import { TODAY_LANG_COOKIE } from "@/content/i18n/admin-today";
import { schedulerBoard } from "@/lib/admin/scheduler";
import { requireSection } from "@/lib/admin/session";
import { dhakaDate, validDay } from "@/lib/admin/scheduler-logic";
import { isAdminPreview } from "@/lib/admin/preview";
import { Scheduler } from "./Scheduler";
export async function SchedulerPage({ date }: { date?: string }) {
  const lang =
    (await cookies()).get(TODAY_LANG_COOKIE)?.value === "bn" ? "bn" : "en";
  const admin = await requireSection("dispatch");
  const day = date && validDay(date) ? date : dhakaDate();
  const board = await schedulerBoard(admin.id, day);
  if (!board.ok)
    return (
      <div className="admin-card p-6">
        <h1 className="t-h3">Today</h1>
        <p role="alert" className="my-4">
          The scheduler could not be loaded. Your existing requests and routes
          are available.
        </p>
        <Link className="admin-btn-primary" href="/admin/today?tab=call">
          Open requests &amp; routes
        </Link>
        <p className="mt-4">
          <Link href="/admin/today">Retry scheduler</Link>
        </p>
      </div>
    );
  return (
    <Scheduler
      lang={lang}
      initial={board}
      initialDay={day}
      preview={isAdminPreview()}
      canOverride={["owner", "manager"].includes(admin.role)}
    />
  );
}
