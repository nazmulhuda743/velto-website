"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { assignAction } from "@/app/admin/today-actions";
import type { TodayLang } from "./format";
import { Icon, type IconName } from "./icons";
import type { SheetData } from "./items";

/** A time window id, taken from the sheet's own data (client code doesn't import the admin libraries). */
type SlotId = SheetData["defaultSlot"];
const WINDOWS: SlotId[] = ["morning", "afternoon", "evening"];
/** The query the server adds to ask again about a full rider; dropped once the question is shown. */
const ASK_PARAMS = ["error", "rider", "adate", "slot"];

/**
 * "Choose rider" / "Plan delivery": the rider sheet slides up (a native modal dialog, so focus stays
 * inside, Escape closes it and focus goes back to the button). Riders come best first (riderChoices):
 * the one with most room is "Most free", full riders are marked "Full" and ask once ("Bappy is full
 * in the morning. Assign anyway?"), riders who are off are greyed at the bottom and can't be chosen.
 * One tap on a rider assigns (assignAction); a delivery first picks a time window that isn't over.
 * All words come ready from the server. The page keys this by job, so another job starts fresh.
 */
export function RiderSheet({ lang, job, label, tab, view, sheet, icon }: { lang: TodayLang; job: string; label: string; tab: "assign" | "deliver"; view: string; sheet: SheetData; icon: IconName }) {
  const router = useRouter();
  const ref = useRef<HTMLDialogElement>(null);
  const shown = useRef("");
  const { text, pending } = sheet;
  const pendingKey = pending ? `${pending.rider}|${pending.slot}` : "";
  const [slot, setSlot] = useState<SlotId>(pending?.slot ?? sheet.slot ?? sheet.defaultSlot);
  const [confirm, setConfirm] = useState<string | null>(pending?.rider ?? null);
  // A new "that rider is full" answer from the server: go to its question (adjusting state while rendering).
  const [seen, setSeen] = useState(pendingKey);
  if (pendingKey !== seen) {
    setSeen(pendingKey);
    if (pending) {
      setSlot(pending.slot);
      setConfirm(pending.rider);
    }
  }

  // Open on that question once, then take the question out of the URL so the 60 s refresh doesn't ask again.
  useEffect(() => {
    if (!pendingKey) {
      shown.current = "";
      return;
    }
    if (shown.current === pendingKey) return;
    shown.current = pendingKey;
    if (ref.current && !ref.current.open) ref.current.showModal();
    const url = new URL(window.location.href);
    for (const k of ASK_PARAMS) url.searchParams.delete(k);
    router.replace(`${url.pathname}${url.search}`, { scroll: false });
  }, [pendingKey, router]);

  const close = () => ref.current?.close();
  const choices = sheet.choices[slot] ?? [];
  const asking = confirm ? choices.find((c) => c.id === confirm && !c.off) : undefined;
  const titleId = `sheet-title-${job}`;

  return (
    <>
      <button
        type="button"
        aria-haspopup="dialog"
        onClick={() => ref.current?.showModal()}
        className="mt-3.5 flex min-h-[52px] w-full items-center justify-center gap-2 rounded-[12px] bg-action px-4 text-[16px] font-semibold text-white hover:bg-action-hover"
      >
        <Icon name={icon} />
        {text.trigger}
      </button>
      <dialog
        ref={ref}
        data-today-sheet
        aria-labelledby={titleId}
        onClose={() => setConfirm(null)}
        onClick={(e) => {
          if (e.target === e.currentTarget) close();
        }}
        className="rounded-t-[18px] bg-white p-0 text-body"
      >
        <div data-today lang={lang} className="px-[18px] pt-2.5 pb-[calc(18px+env(safe-area-inset-bottom))]">
          <div aria-hidden="true" data-grab className="mx-auto mb-2 h-1 w-10 rounded-full bg-line" />
          <div className="flex items-start justify-between gap-3">
            <h2 id={titleId} className="pt-1.5 text-[19px] font-semibold leading-snug text-navy">
              {text.title}
            </h2>
            <button type="button" onClick={close} aria-label={text.close} className="-mr-2 grid size-11 shrink-0 place-items-center rounded-full text-secondary hover:bg-soft hover:text-navy">
              <Icon name="close" className="size-5" />
            </button>
          </div>
          <p className="mt-0.5 t-small text-secondary">{text.hint}</p>

          {sheet.slot && text.fixed ? (
            <p className="mt-2 text-[15px] font-semibold text-navy">{text.fixed}</p>
          ) : (
            <div role="group" aria-label={text.timeWindow} className="mt-3 flex gap-1.5">
              {WINDOWS.map((w) => {
                const over = sheet.closed.includes(w);
                return (
                  <button
                    key={w}
                    type="button"
                    aria-pressed={slot === w}
                    disabled={over}
                    onClick={() => {
                      setSlot(w);
                      setConfirm(null);
                    }}
                    className={`min-h-11 flex-1 rounded-[10px] border text-[14px] font-semibold ${
                      slot === w ? "border-navy bg-navy text-white" : over ? "cursor-not-allowed border-line bg-soft text-disabled-text line-through" : "border-line bg-white text-navy hover:border-navy"
                    }`}
                  >
                    {text.windows[w]}
                  </button>
                );
              })}
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
                <p className="text-[15px] font-semibold text-error">{asking.ask}</p>
                <p className="mt-1 t-small text-secondary">{asking.stops}</p>
                <input type="hidden" name="force" value="1" />
                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="submit" name="rider" value={asking.id} autoFocus className="admin-btn min-h-12 flex-1">
                    {text.assignAnyway}
                  </button>
                  <button type="button" onClick={() => setConfirm(null)} className="admin-btn-secondary min-h-12 flex-1">
                    {text.back}
                  </button>
                </div>
              </div>
            ) : (
              <ul>
                {choices.map((c) => {
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
                          {c.initial}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className={`block truncate text-[16px] font-semibold ${grey ? "text-secondary" : "text-navy"}`}>{c.name}</span>
                          <span aria-hidden="true" className="mt-1.5 block h-[5px] overflow-hidden rounded-full bg-soft">
                            <span className={`block h-full ${c.full ? "bg-error" : "bg-action"}`} style={{ width: `${c.off ? 0 : c.pct}%` }} />
                          </span>
                        </span>
                        <span className="shrink-0 text-right text-[14px] leading-tight">
                          {c.off ? (
                            <span className="font-semibold text-secondary">{c.tag}</span>
                          ) : c.tag ? (
                            <>
                              <span className={`block font-semibold ${c.full ? "text-error" : "text-success"}`}>{c.tag}</span>
                              <span className="block tabular-nums text-secondary">{c.stops}</span>
                            </>
                          ) : (
                            <span className="font-semibold tabular-nums text-secondary">{c.stops}</span>
                          )}
                        </span>
                      </button>
                    </li>
                  );
                })}
                {!choices.length ? <li className="py-4 t-small text-secondary">{text.noRiders}</li> : null}
              </ul>
            )}
          </form>
        </div>
      </dialog>
    </>
  );
}
