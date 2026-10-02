import type { CareText } from "@/content/i18n/care";
import type { CareState } from "@/lib/customer/care";
import { careDecisionAction } from "@/lib/customer/care-actions";

/**
 * The customer's care decision on one order (order page, #care). Waiting: what was flagged, the
 * staff's photos, and two choices. Decided: what stands and where it was recorded. Nothing here
 * is decided by opening the page; only a tap on a choice changes anything.
 */
export function CareDecision({
  care,
  photos,
  t,
  whatsapp,
  result,
  when,
}: {
  care: CareState;
  /** Signed photo links, per garment, in the same order as care.risks. */
  photos: string[][];
  t: CareText;
  whatsapp: string;
  /** ?care= after a tap: approved, declined or failed. */
  result?: string;
  /** The decision time, formatted for the reader. */
  when?: string;
}) {
  const pending = care.status === "pending";
  return (
    <section
      id="care"
      aria-labelledby="care-title"
      className={`scroll-mt-32 rounded-lg border bg-white p-5 md:p-8 ${pending ? "border-warning/50 shadow-[0_12px_32px_-26px_rgba(138,83,0,0.45)]" : "border-line"}`}
      data-care={care.status}
    >
      <div className="flex items-start gap-3">
        <span aria-hidden="true" className={`inline-flex size-10 shrink-0 items-center justify-center rounded-[11px] ${pending ? "bg-warning-soft text-warning" : "bg-success-soft text-success"}`}>
          <svg viewBox="0 0 24 24" className="size-[21px]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            {pending ? (
              <>
                <circle cx="12" cy="12" r="9" />
                <path d="M12 7.5v5.5" />
                <circle cx="12" cy="16.5" r=".6" fill="currentColor" />
              </>
            ) : (
              <>
                <circle cx="12" cy="12" r="9" />
                <path d="M8 12.5l3 3 5-6" />
              </>
            )}
          </svg>
        </span>
        <div className="min-w-0">
          <h2 id="care-title" className="t-h3 text-navy">
            {pending ? t.title : care.status === "approved" ? t.approved : t.declined}
          </h2>
          {pending ? <p className="mt-1.5 text-body">{t.intro}</p> : null}
          {!pending ? (
            <p className="mt-1 t-small text-secondary">
              {care.decidedOnWebsite ? t.decidedWebsite : t.decidedVelto}
              {when ? ` · ${when}` : ""}
            </p>
          ) : null}
        </div>
      </div>

      {result === "failed" ? (
        <p role="alert" className="mt-4 rounded-md bg-error/10 px-4 py-3 t-small font-semibold text-error">
          {t.failed}
        </p>
      ) : null}

      <ul className="mt-5 divide-y divide-line border-y border-line" aria-label={t.garments(care.risks.length)}>
        {care.risks.map((r, i) => (
          <li key={`${r.item}-${i}`} className="py-4">
            <p className="font-semibold text-navy">{r.item}</p>
            {r.type ? <p className="mt-0.5 t-small font-semibold text-warning">{t.types[r.type] ?? r.type}</p> : null}
            {r.note ? <p className="mt-1 t-small text-body">{r.note}</p> : null}
            {photos[i]?.length ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {photos[i].map((src, k) => (
                  <a key={src} href={src} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-md border border-line focus-visible:outline-2 focus-visible:outline-action">
                    {/* eslint-disable-next-line @next/next/no-img-element -- short-lived signed links from private storage */}
                    <img src={src} alt={`${r.item}: ${t.photo(k + 1)}`} width={96} height={96} className="size-24 object-cover" loading="lazy" />
                  </a>
                ))}
              </div>
            ) : null}
          </li>
        ))}
      </ul>

      {pending ? (
        <form action={careDecisionAction} className="mt-5 grid gap-3 sm:grid-cols-2">
          <input type="hidden" name="order" value={care.orderNumber} />
          <button type="submit" name="decision" value="approved" className="flex min-h-14 flex-col items-start justify-center rounded-md bg-action px-5 py-3 text-left text-white hover:bg-action-hover">
            <span className="font-semibold">{t.approve}</span>
            <span className="mt-0.5 t-small text-white/85">{t.approveHint}</span>
          </button>
          <button type="submit" name="decision" value="declined" className="flex min-h-14 flex-col items-start justify-center rounded-md border border-line-strong bg-white px-5 py-3 text-left text-navy hover:border-navy">
            <span className="font-semibold">{t.decline}</span>
            <span className="mt-0.5 t-small text-secondary">{t.declineHint}</span>
          </button>
        </form>
      ) : null}

      <p className="mt-4 t-small text-secondary">
        <a href={whatsapp} className="font-semibold text-navy underline decoration-blue/50 underline-offset-4">
          {pending ? t.questions : t.change}
        </a>
      </p>
    </section>
  );
}
