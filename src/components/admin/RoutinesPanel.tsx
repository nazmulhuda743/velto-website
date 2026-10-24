import { Badge } from "@/components/admin/ui";
import { activateRoutineAction, declineRoutineAction } from "@/app/admin/routine-actions";
import type { Loaded } from "@/lib/admin/analytics-data";
import { slotLabel } from "@/lib/admin/dispatch-logic";
import { requestDate } from "@/lib/admin/request-details";
import { routineMessage } from "@/lib/admin/request-flow";
import { whatsappLink } from "@/lib/admin/retention-messages";
import type { RoutineRow } from "@/lib/routine";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const ROUTINE_SERVICE: Record<string, string> = { "dry-cleaning": "Dry cleaning", "wash-and-iron": "Wash & iron", ironing: "Ironing" };
const ROUTINE_BADGE: Record<string, { tone: "amber" | "green" | "neutral" | "blue"; label: string }> = {
  requested: { tone: "amber", label: "To confirm" },
  active: { tone: "green", label: "Running" },
  paused: { tone: "neutral", label: "Paused" },
  declined: { tone: "neutral", label: "Declined" },
  stopped: { tone: "neutral", label: "Stopped" },
};

/**
 * Routine pickups (website_routines.sql): customers ask for a weekly day on their account; confirm it
 * with them on WhatsApp, then Activate: it becomes a Velto Ops weekly pickup and Ops' daily job makes
 * the pickup, delivery and day-before confirmation tasks. Hidden while there are none.
 */
export function RoutinesPanel({ loaded, saved, error }: { loaded: Loaded<RoutineRow[]>; saved?: string; error?: string }) {
  if (loaded.state === "not_configured") return null;
  const rows = loaded.state === "ok" ? loaded.data : [];
  if (loaded.state === "ok" && !rows.length && !saved && !error) return null;
  const waiting = rows.filter((r) => r.status === "requested");
  const running = rows.filter((r) => r.status === "active").length;
  return (
    <section id="routines" aria-labelledby="routines-title" className="admin-card mt-6 scroll-mt-24 p-5 md:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="routines-title" className="text-[17px] font-semibold text-navy">
          Routine pickups {waiting.length ? <Badge tone="amber">{waiting.length} to confirm</Badge> : null}
        </h2>
        <p className="t-small text-secondary">{running} running in Velto Ops weekly pickups</p>
      </div>
      {loaded.state === "error" ? <p role="alert" className="mt-3 t-small text-error">{loaded.message}</p> : null}
      {saved ? (
        <p role="status" className="mt-3 rounded-md border border-success/30 bg-success-soft px-4 py-2 t-small font-medium text-success">
          {saved === "activated" ? "Activated. It is now a weekly pickup in Velto Ops." : "Declined. The customer sees your reason on their account."}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="mt-3 rounded-md border border-error/30 bg-error-soft px-4 py-2 t-small font-medium text-error">
          {error}
        </p>
      ) : null}
      <ul className="mt-4 divide-y divide-line border-t border-line">
        {rows.map((r) => {
          const badge = ROUTINE_BADGE[r.status];
          const label = `${r.name} (${r.phone})`;
          const msg = { bn: whatsappLink(r.phone, routineMessage({ name: r.name, weekday: r.weekday, slot: r.window }, "bn")), en: whatsappLink(r.phone, routineMessage({ name: r.name, weekday: r.weekday, slot: r.window }, "en")) };
          return (
            <li key={r.id} className="py-4" data-routine-row={r.status}>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <Badge tone={badge.tone}>{r.change ? "Change to confirm" : badge.label}</Badge>
                <span className="font-semibold text-navy">{r.name}</span>
                <span className="t-small text-secondary">{r.phone}</span>
                <span className="t-small text-secondary">{r.orders ? `${r.orders} orders` : "no orders yet"}</span>
              </div>
              <p className="mt-1.5 text-[15px] text-navy">
                Every <strong>{DAYS[r.weekday]}</strong>, {slotLabel(r.window).toLowerCase()}
                {r.service ? ` · ${ROUTINE_SERVICE[r.service] ?? r.service}` : ""} · {r.address}, {r.area === "outside" ? "outside Uttara" : `Sector ${r.area}`}
              </p>
              {r.note ? <p className="mt-1 t-small text-secondary">Note: {r.note}</p> : null}
              {r.reason && r.status === "declined" ? <p className="mt-1 t-small text-secondary">Declined: {r.reason}</p> : null}
              {r.status === "requested" ? (
                <div className="mt-3 space-y-3">
                  {msg.bn && msg.en ? (
                    <p className="flex flex-wrap items-center gap-x-3 gap-y-2 t-small">
                      <span className="font-semibold text-navy">1. Confirm on WhatsApp:</span>
                      <a href={msg.bn} target="_blank" rel="noopener noreferrer" className="admin-btn-secondary !h-9 !px-3">
                        <span lang="bn">বাংলা</span>
                      </a>
                      <a href={msg.en} target="_blank" rel="noopener noreferrer" className="admin-btn-secondary !h-9 !px-3">
                        English
                      </a>
                    </p>
                  ) : null}
                  <form action={activateRoutineAction} className="flex flex-wrap items-end gap-3">
                    <input type="hidden" name="id" value={r.id} />
                    <input type="hidden" name="label" value={label} />
                    <label className="block t-small font-semibold text-navy">
                      Price per run (৳, optional)
                      <input name="price" inputMode="numeric" pattern="[0-9]*" maxLength={6} className="admin-input mt-1 w-40" placeholder="Leave empty" />
                    </label>
                    <button type="submit" className="admin-btn">
                      2. {r.change ? "Apply change" : "Activate weekly pickup"}
                    </button>
                  </form>
                  <details>
                    <summary className="cursor-pointer t-small font-semibold text-secondary underline underline-offset-4">Decline…</summary>
                    <form action={declineRoutineAction} className="mt-2 flex flex-wrap items-end gap-3">
                      <input type="hidden" name="id" value={r.id} />
                      <input type="hidden" name="label" value={label} />
                      <label className="block min-w-[16rem] flex-1 t-small font-semibold text-navy">
                        Reason (the customer sees it)
                        <input name="reason" required maxLength={300} className="admin-input mt-1 w-full" />
                      </label>
                      <button type="submit" className="admin-btn-secondary">
                        Decline
                      </button>
                    </form>
                  </details>
                </div>
              ) : r.decidedBy ? (
                <p className="mt-1 t-caption text-secondary">
                  {r.status === "active" || r.status === "paused" ? "Activated" : "Handled"} by {r.decidedBy}
                  {r.decidedAt ? ` · ${requestDate(r.decidedAt)}` : ""}
                </p>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
