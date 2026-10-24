import { Badge } from "@/components/admin/ui";
import { closeCallbackAction } from "@/app/admin/callback-actions";
import type { Loaded } from "@/lib/admin/analytics-data";
import type { CallbackRow } from "@/lib/admin/callbacks";
import { requestDate } from "@/lib/admin/request-details";
import { callbackMessage, minutesLabel } from "@/lib/admin/request-flow";
import { whatsappLink } from "@/lib/admin/retention-messages";
import { CALLBACK_OUTCOMES } from "@/lib/booking-recovery";

const waitedMinutes = (iso: string) => Math.max(0, Math.floor((Date.now() - Date.parse(iso)) / 60_000));
const OUTCOME_LABEL: Record<string, string> = Object.fromEntries(CALLBACK_OUTCOMES.map((o) => [o.id, o.label]));

/**
 * "Get a call back" requests from the booking form (website_callbacks.sql): visitors who got stuck
 * and asked Velto to call. Call or WhatsApp once, then close with what happened. Hidden while empty.
 */
export function CallbacksPanel({ loaded, saved, error }: { loaded: Loaded<CallbackRow[]>; saved?: string; error?: string }) {
  if (loaded.state === "not_configured") return null;
  const rows = loaded.state === "ok" ? loaded.data : [];
  if (loaded.state === "ok" && !rows.length && !saved && !error) return null;
  const open = rows.filter((r) => r.status === "open");
  const handled = rows.filter((r) => r.status === "done");
  return (
    <section id="callbacks" aria-labelledby="callbacks-title" className="admin-card mt-6 scroll-mt-24 p-5 md:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="callbacks-title" className="text-[17px] font-semibold text-navy">
          Call-back requests {open.length ? <Badge tone="amber">{open.length} to call</Badge> : null}
        </h2>
        <p className="t-small text-secondary">Visitors who started a booking and asked us to call</p>
      </div>
      {loaded.state === "error" ? <p role="alert" className="mt-3 t-small text-error">{loaded.message}</p> : null}
      {saved ? (
        <p role="status" className="mt-3 rounded-md border border-success/30 bg-success-soft px-4 py-2 t-small font-medium text-success">
          Saved.
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="mt-3 rounded-md border border-error/30 bg-error-soft px-4 py-2 t-small font-medium text-error">
          {error}
        </p>
      ) : null}
      {open.length ? (
        <ul className="mt-4 divide-y divide-line border-t border-line">
          {open.map((r) => {
            const waited = waitedMinutes(r.created_at);
            const wa = { bn: whatsappLink(r.phone, callbackMessage({ name: r.name }, "bn")), en: whatsappLink(r.phone, callbackMessage({ name: r.name }, "en")) };
            const source = [r.utm_source, r.utm_medium].filter(Boolean).join(" / ") || r.referrer_host || "direct";
            return (
              <li key={r.id} className="py-4" data-callback-row>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <Badge tone={waited < 30 ? "blue" : "amber"}>{`Waiting ${minutesLabel(waited)}`}</Badge>
                  <span className="font-semibold text-navy">{r.name}</span>
                  <a href={`tel:${r.phone}`} className="t-small font-semibold text-navy underline underline-offset-4">
                    {r.phone}
                  </a>
                  <span className="t-small text-secondary">{r.orders ? `${r.orders} orders before` : "new customer"}</span>
                </div>
                <dl className="mt-2 grid gap-x-6 gap-y-1 t-small sm:grid-cols-2">
                  {r.what ? (
                    <div>
                      <dt className="inline text-secondary">Picking up: </dt>
                      <dd className="inline text-navy">{r.what}</dd>
                    </div>
                  ) : null}
                  {r.services ? (
                    <div>
                      <dt className="inline text-secondary">Service: </dt>
                      <dd className="inline text-navy">{r.services}</dd>
                    </div>
                  ) : null}
                  {r.area ? (
                    <div>
                      <dt className="inline text-secondary">Area: </dt>
                      <dd className="inline text-navy">{r.area}</dd>
                    </div>
                  ) : null}
                  {r.preferred ? (
                    <div>
                      <dt className="inline text-secondary">Wanted: </dt>
                      <dd className="inline text-navy">{r.preferred}</dd>
                    </div>
                  ) : null}
                  <div>
                    <dt className="inline text-secondary">Came from: </dt>
                    <dd className="inline text-navy">
                      {source}
                      {r.device ? ` · ${r.device}` : ""}
                    </dd>
                  </div>
                </dl>
                <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 t-small">
                  <a href={`tel:${r.phone}`} className="admin-btn !h-9 !px-3">
                    Call
                  </a>
                  {wa.bn && wa.en ? (
                    <>
                      <span className="font-semibold text-navy">WhatsApp:</span>
                      <a href={wa.bn} target="_blank" rel="noopener noreferrer" className="admin-btn-secondary !h-9 !px-3">
                        <span lang="bn">বাংলা</span>
                      </a>
                      <a href={wa.en} target="_blank" rel="noopener noreferrer" className="admin-btn-secondary !h-9 !px-3">
                        English
                      </a>
                    </>
                  ) : null}
                </div>
                <form action={closeCallbackAction} className="mt-3 flex flex-wrap items-end gap-3">
                  <input type="hidden" name="id" value={r.id} />
                  <input type="hidden" name="label" value={`${r.name} (${r.phone})`} />
                  <label className="block t-small font-semibold text-navy">
                    What happened
                    <select name="outcome" required defaultValue="" className="admin-input mt-1 w-56">
                      <option value="" disabled>
                        Choose…
                      </option>
                      {CALLBACK_OUTCOMES.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block min-w-[12rem] flex-1 t-small font-semibold text-navy">
                    Note (optional)
                    <input name="note" maxLength={300} className="admin-input mt-1 w-full" />
                  </label>
                  <button type="submit" className="admin-btn-secondary">
                    Close
                  </button>
                </form>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-3 t-small text-secondary">Nothing waiting. Handled requests from the last 14 days are below.</p>
      )}
      {handled.length ? (
        <details className="mt-3">
          <summary className="cursor-pointer t-small font-semibold text-secondary">Handled ({handled.length})</summary>
          <ul className="mt-2 divide-y divide-line">
            {handled.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2 t-small">
                <span className="font-semibold text-navy">{r.name}</span>
                <span className="text-secondary">{r.phone}</span>
                <Badge tone={r.outcome === "booked" ? "green" : "neutral"}>{OUTCOME_LABEL[r.outcome ?? ""] ?? r.outcome ?? "Closed"}</Badge>
                {r.note ? <span className="text-secondary">{r.note}</span> : null}
                <span className="ml-auto text-secondary">
                  {r.handled_by ?? ""}
                  {r.handled_at ? ` · ${requestDate(r.handled_at)}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </section>
  );
}
