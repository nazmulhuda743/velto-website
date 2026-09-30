"use client";

import { useEffect, useRef, useState } from "react";
import { assignAction } from "@/app/admin/today-actions";
import { todayText } from "@/content/i18n/admin-today";
import { SLOTS, type SlotId } from "@/lib/admin/dispatch-logic";
import { initials, windowText, type TodayLang } from "./format";
import { Icon, type IconName } from "./icons";
import type { SheetData } from "./items";

/**
 * "Choose rider" / "Plan delivery": the rider sheet slides up (a native modal dialog, so focus stays
 * inside, Escape closes it and focus goes back to the button). Riders come best first (riderChoices):
 * the emptiest is "Most free", full riders are marked "Full" and ask once ("Bappy is full in the
 * morning. Assign anyway?"), riders who are off are greyed at the bottom and can't be chosen. One tap
 * on a rider assigns (assignAction); a delivery first picks its time window.
 */
export function RiderSheet({
  lang,
  job,
  name,
  place,
  label,
  tab,
  view,
  today,
  sheet,
  trigger,
}: {
  lang: TodayLang;
  job: string;
  name: string;
  place: string;
  label: string;
  tab: "assign" | "deliver";
  view: string;
  today: string;
  sheet: SheetData;
  trigger: { text: string; icon: IconName };
}) {
  const t = todayText(lang);
  const ref = useRef<HTMLDialogElement>(null);
  const [slot, setSlot] = useState<SlotId>(sheet.pending?.slot ?? sheet.slot ?? sheet.defaultSlot);
  const [confirm, setConfirm] = useState<string | null>(sheet.pending?.rider ?? null);
  const pending = sheet.pending;

  // The server said "that rider is full": open straight on the question.
  useEffect(() => {
    if (pending && ref.current && !ref.current.open) ref.current.showModal();
  }, [pending]);

  const close = () => ref.current?.close();
  const choices = sheet.choices[slot] ?? [];
  const asking = confirm ? choices.find((c) => c.id === confirm && !c.off) : undefined;
  const windowWord = lang === "en" ? t.windowName[slot].toLowerCase() : t.windowName[slot];
  const titleId = `sheet-title-${job}`;

  return (
    <>
      <button
        type="button"
        aria-haspopup="dialog"
        onClick={() => ref.current?.showModal()}
        className="mt-3.5 flex min-h-[52px] w-full items-center justify-center gap-2 rounded-[12px] bg-action px-4 text-[16px] font-semibold text-white hover:bg-action-hover"
      >
        <Icon name={trigger.icon} />
        {trigger.text}
      </button>
      <dialog
        ref={ref}
        data-today-sheet
        aria-labelledby={titleId}
        onClose={() => setConfirm(null)}
        onClick={(e) => {
          if (e.target === e.currentTarget) close();
        }}
        className="rounded-t-[18px] bg-white p-0 text-body shadow-[0_-12px_40px_rgb(0_43_78/0.18)]"
      >
        <div data-today lang={lang} className="px-[18px] pt-2.5 pb-[calc(18px+env(safe-area-inset-bottom))]">
          <div aria-hidden="true" data-grab className="mx-auto mb-2 h-1 w-10 rounded-full bg-line" />
          <div className="flex items-start justify-between gap-3">
            <h2 id={titleId} className="pt-1.5 text-[19px] font-semibold leading-snug text-navy">
              {t.assignTo(name)}
            </h2>
            <button type="button" onClick={close} aria-label={t.close} className="-mr-2 grid size-11 shrink-0 place-items-center rounded-full text-secondary hover:bg-soft hover:text-navy">
              <Icon name="close" className="size-5" />
            </button>
          </div>
          <p className="mt-0.5 t-small text-secondary">
            {place ? `${place} · ` : ""}
            {t.assignHint}
          </p>

          {sheet.slot ? (
            <p className="mt-2 text-[15px] font-semibold text-navy">{windowText(sheet.slot, sheet.date, today, t)}</p>
          ) : (
            <div role="group" aria-label={t.timeWindow} className="mt-3 flex gap-1.5">
              {SLOTS.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  aria-pressed={slot === s.id}
                  onClick={() => {
                    setSlot(s.id);
                    setConfirm(null);
                  }}
                  className={`min-h-11 flex-1 rounded-[10px] border text-[14px] font-semibold ${slot === s.id ? "border-navy bg-navy text-white" : "border-line bg-white text-navy hover:border-navy"}`}
                >
                  {t.windowName[s.id]}
                </button>
              ))}
            </div>
          )}

          <form action={assignAction} className="mt-2">
            <input type="hidden" name="job" value={job} />
            <input type="hidden" name="date" value={sheet.date} />
            <input type="hidden" name="slot" value={slot} />
            <input type="hidden" name="label" value={label} />
            <input type="hidden" name="tab" value={tab} />
            <input type="hidden" name="view" value={view} />
            {asking ? (
              <div role="alert" className="mt-3 rounded-[12px] border border-error/30 bg-error-soft p-4">
                <p className="text-[15px] font-semibold text-error">{t.fullAsk(asking.name, windowWord)}</p>
                <p className="mt-1 t-small text-secondary">{t.stopsOf(asking.load, asking.stopsPerWindow)}</p>
                <input type="hidden" name="force" value="1" />
                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="submit" name="rider" value={asking.id} autoFocus className="admin-btn min-h-12 flex-1">
                    {t.assignAnyway}
                  </button>
                  <button type="button" onClick={() => setConfirm(null)} className="admin-btn-secondary min-h-12 flex-1">
                    {t.back}
                  </button>
                </div>
              </div>
            ) : (
              <ul>
                {choices.map((c) => {
                  const cap = c.stopsPerWindow;
                  const pct = cap ? Math.min(100, Math.round((c.load / cap) * 100)) : 0;
                  const grey = c.off || c.full;
                  return (
                    <li key={c.id} className="border-b border-line last:border-b-0">
                      <button
                        type={c.full ? "button" : "submit"}
                        name={c.full ? undefined : "rider"}
                        value={c.full ? undefined : c.id}
                        disabled={c.off}
                        onClick={c.full ? () => setConfirm(c.id) : undefined}
                        className={`flex min-h-[60px] w-full items-center gap-3 rounded-[10px] px-1 py-2.5 text-left ${c.off ? "cursor-not-allowed opacity-60" : "hover:bg-soft"}`}
                      >
                        <span aria-hidden="true" className={`grid size-[34px] shrink-0 place-items-center rounded-full text-[14px] font-semibold text-white ${grey ? "bg-disabled-text" : "bg-navy"}`}>
                          {initials(c.name)}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className={`block truncate text-[16px] font-semibold ${grey ? "text-secondary" : "text-navy"}`}>{c.name}</span>
                          <span aria-hidden="true" className="mt-1.5 block h-[5px] overflow-hidden rounded-full bg-soft">
                            <span className={`block h-full ${c.full ? "bg-error" : "bg-action"}`} style={{ width: `${c.off ? 0 : pct}%` }} />
                          </span>
                        </span>
                        <span className="shrink-0 text-right text-[14px] leading-tight">
                          {c.off ? (
                            <span className="font-semibold text-secondary">{sheet.date === today ? t.offToday : t.offDay}</span>
                          ) : c.full ? (
                            <>
                              <span className="block font-semibold text-error">{t.full}</span>
                              <span className="block tabular-nums text-secondary">{t.stopsOf(c.load, cap)}</span>
                            </>
                          ) : c.best ? (
                            <>
                              <span className="block font-semibold text-success">{t.mostFree}</span>
                              <span className="block tabular-nums text-secondary">{t.stopsOf(c.load, cap)}</span>
                            </>
                          ) : (
                            <span className="font-semibold tabular-nums text-secondary">{t.stopsOf(c.load, cap)}</span>
                          )}
                        </span>
                      </button>
                    </li>
                  );
                })}
                {!choices.length ? <li className="py-4 t-small text-secondary">{t.noRiders}</li> : null}
              </ul>
            )}
          </form>
        </div>
      </dialog>
    </>
  );
}
