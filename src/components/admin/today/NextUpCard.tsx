import Link from "next/link";
import { confirmAction, noAnswerAction } from "@/app/admin/today-actions";
import type { TodayText } from "@/content/i18n/admin-today";
import { addDays, SLOTS, type SlotId } from "@/lib/admin/dispatch-logic";
import { whatsappLink } from "@/lib/admin/retention-messages";
import { dayWord, waitText, type TodayLang } from "./format";
import { Icon } from "./icons";
import type { Badges, CallItem, ListItem, SheetData } from "./items";
import { RiderSheet } from "./RiderSheet";

/** Badges under the name: first website order · 10% off, Call-back, Weekly, Changed time. */
export function BadgeRow({ badges, t }: { badges: Badges; t: TodayText }) {
  const list = [
    badges.first ? { text: t.firstOrder, tone: "bg-success-soft text-success" } : null,
    badges.callback ? { text: t.callback, tone: "bg-soft text-navy" } : null,
    badges.weekly ? { text: t.weekly, tone: "bg-soft text-navy", icon: true } : null,
    badges.changed ? { text: t.changedTime, tone: "bg-soft text-navy" } : null,
  ].filter((b) => b !== null);
  if (!list.length) return null;
  return (
    <ul className="mt-2.5 flex flex-wrap gap-1.5">
      {list.map((b) => (
        <li key={b.text} className={`inline-flex items-center gap-1 rounded-[6px] px-2 py-0.5 text-[13px] font-semibold ${b.tone}`}>
          {"icon" in b ? <Icon name="repeat" className="size-3.5" /> : null}
          {b.text}
        </li>
      ))}
    </ul>
  );
}

export function WaitPill({ minutes, late, t }: { minutes: number; late: boolean; t: TodayText }) {
  return <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[13px] font-semibold tabular-nums whitespace-nowrap ${late ? "bg-error-soft text-error" : "bg-soft text-navy"}`}>{waitText(minutes, t)}</span>;
}

/** "Evening 4–8" never breaks at the dash. */
const keepHours = (s: string) => s.replace(/(\d)–(\d)/g, "$1\u2060–\u2060$2").replace(/([০-৯])–([০-৯])/g, "$1\u2060–\u2060$2");

const telHref = (phone: string) => `tel:${phone.replace(/[^\d+]/g, "")}`;

/** Call and WhatsApp, quiet (outlined): the call card's filled button is "Confirmed for …". */
function ContactButtons({ phone, t, filledCall = false }: { phone: string | null; t: TodayText; filledCall?: boolean }) {
  if (!phone) return null;
  const wa = whatsappLink(phone, "");
  const quiet = "flex min-h-[46px] flex-1 items-center justify-center gap-1.5 rounded-[12px] border border-line bg-white px-3 text-[15px] font-semibold text-navy hover:border-navy";
  return (
    <div className="mt-3 flex gap-2">
      <a href={telHref(phone)} className={filledCall ? "flex min-h-[52px] flex-1 items-center justify-center gap-2 rounded-[12px] bg-action px-3 text-[16px] font-semibold text-white hover:bg-action-hover" : quiet}>
        <Icon name="phone" />
        {t.call}
      </a>
      {wa ? (
        <a href={wa.replace(/\?text=$/, "")} target="_blank" rel="noopener noreferrer" className={filledCall ? `${quiet} min-h-[52px]` : quiet}>
          <Icon name="chat" />
          {t.whatsapp}
        </a>
      ) : null}
    </div>
  );
}

const Hidden = ({ fields }: { fields: Record<string, string> }) => (
  <>
    {Object.entries(fields).map(([k, v]) => (
      <input key={k} type="hidden" name={k} value={v} />
    ))}
  </>
);

/** A new booking: call, then "Confirmed for [window ▾]" or "No answer". */
function CallCard({ item, t, today, view }: { item: CallItem; t: TodayText; today: string; view: string }) {
  const base = { job: item.id, label: item.label, tab: "call", view };
  const days = [today, addDays(today, 1), addDays(today, 2), addDays(today, 3), addDays(today, 4), addDays(today, 5), addDays(today, 6)];
  return (
    <>
      <ContactButtons phone={item.phone} t={t} filledCall={item.source !== "job"} />
      {item.source === "job" && item.confirm ? (
        <>
          <div className="relative mt-3.5 flex">
            <form action={confirmAction} className="min-w-0 flex-1">
              <Hidden fields={{ ...base, date: item.confirm.date, slot: item.confirm.slot }} />
              <button type="submit" className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-l-[12px] bg-action px-3 py-2 text-[16px] leading-tight font-semibold text-white hover:bg-action-hover">
                <Icon name="check" />
                <span className="text-balance">{t.confirmFor(confirmWords(item.confirm, today, t))}</span>
              </button>
            </form>
            <details className="group">
              <summary aria-label={t.otherTime} className="grid h-full min-h-[52px] w-[52px] cursor-pointer list-none place-items-center rounded-r-[12px] border-l border-white/30 bg-action text-white hover:bg-action-hover [&::-webkit-details-marker]:hidden">
                <Icon name="down" className="size-5 transition-transform group-open:rotate-180" />
              </summary>
              <form action={confirmAction} className="absolute inset-x-0 top-full z-20 mt-2 rounded-[12px] border border-line bg-white p-3 shadow-[0_12px_32px_color-mix(in_srgb,var(--velto-navy)_16%,transparent)]">
                <Hidden fields={base} />
                <p className="text-[14px] font-semibold text-navy">{t.otherTime}</p>
                <label className="mt-2 block t-caption font-semibold text-secondary">
                  {t.day}
                  <select name="date" defaultValue={item.confirm.date} className="admin-input mt-1">
                    {days.map((d) => (
                      <option key={d} value={d}>
                        {d === today ? t.title : dayWord(d, today, t)}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="mt-2 grid grid-cols-3 gap-1.5">
                  {SLOTS.map((s) => (
                    <button key={s.id} type="submit" name="slot" value={s.id} className="min-h-11 rounded-[10px] border border-line px-1 text-[14px] font-semibold text-navy hover:border-navy">
                      {t.windowName[s.id]}
                    </button>
                  ))}
                </div>
              </form>
            </details>
          </div>
          <div className="mt-1 flex flex-wrap items-center justify-center gap-x-4">
            <form action={noAnswerAction}>
              <Hidden fields={base} />
              <button type="submit" className="min-h-11 px-2 text-[15px] font-semibold text-secondary underline underline-offset-[3px] hover:text-navy">
                {t.noAnswer}
              </button>
            </form>
            {item.attempts >= 3 ? (
              <Link href={`/admin/requests?${new URLSearchParams({ stage: "all", open: item.id })}#r-${item.id}`} className="inline-flex min-h-11 items-center px-2 text-[15px] font-semibold text-secondary underline underline-offset-[3px] hover:text-navy">
                {t.cancelBooking}
              </Link>
            ) : null}
          </div>
        </>
      ) : (
        <p className="mt-2 text-center">
          <Link href={`/admin/requests#${item.source === "callback" ? "callbacks" : "routines"}`} className="inline-flex min-h-11 items-center px-2 text-[15px] font-semibold text-secondary underline underline-offset-[3px] hover:text-navy">
            {t.finishOnRequests}
          </Link>
        </p>
      )}
    </>
  );
}

/** "Afternoon", "Tomorrow, Evening", "3 October, Morning". */
function confirmWords(c: { date: string; slot: SlotId }, today: string, t: TodayText) {
  const day = dayWord(c.date, today, t);
  return day ? `${day}, ${t.windowName[c.slot]}` : t.windowName[c.slot];
}

/** The most urgent job, large, with its one filled button. */
export function NextUpCard({ item, t, lang, today, view, sheet }: { item: ListItem; t: TodayText; lang: TodayLang; today: string; view: string; sheet: SheetData | null }) {
  const late = item.tab === "call" && item.late;
  const pill =
    item.tab === "call" ? (
      <WaitPill minutes={item.minutes} late={item.late} t={t} />
    ) : item.tab === "assign" && item.slot ? (
      <span className="shrink-0 rounded-full bg-soft px-2.5 py-0.5 text-[13px] font-semibold whitespace-nowrap text-navy">{t.windows[item.slot]}</span>
    ) : item.tab === "deliver" && item.order ? (
      <span className="shrink-0 rounded-full bg-soft px-2.5 py-0.5 text-[13px] font-semibold whitespace-nowrap text-navy">{item.order}</span>
    ) : null;
  const facts =
    item.tab === "call"
      ? [item.place, item.asked ? `${t.asked} ${item.asked}` : ""]
      : item.tab === "assign"
        ? [item.place, dayWord(item.date, today, t)]
        : [item.place, item.readySince ? t.readySince(item.readySince) : ""];
  return (
    <article aria-labelledby={`next-${item.id}`} className={`rounded-[14px] border-[1.5px] bg-white p-4 ${late ? "border-error" : "border-navy"}`}>
      <div className="flex items-baseline justify-between gap-3">
        <h3 id={`next-${item.id}`} className="min-w-0 text-[21px] leading-tight font-semibold tracking-[-0.01em] text-navy [overflow-wrap:anywhere]">
          {item.name}
        </h3>
        {pill}
      </div>
      <p className="mt-1.5 text-[15px] leading-snug text-body">
        {facts.filter(Boolean).map((f, i) => (
          <span key={i} className={i ? "text-secondary" : undefined}>
            {i ? " · " : ""}
            {keepHours(f)}
          </span>
        ))}
      </p>
      {item.tab === "call" && item.attempts > 0 && item.source === "job" ? <p className="mt-1 t-small font-semibold text-secondary">{t.noAnswerTimes(item.attempts)}</p> : null}
      <BadgeRow badges={item.badges} t={t} />
      {item.note ? <p className="mt-2.5 border-l-[3px] border-line pl-2.5 text-[14px] text-secondary [overflow-wrap:anywhere]">{item.note}</p> : null}
      {item.tab === "call" ? <CallCard item={item} t={t} today={today} view={view} /> : null}
      {item.tab !== "call" && sheet ? (
        <RiderSheet key={item.id} lang={lang} job={item.id} label={item.label} tab={item.tab} view={view} sheet={sheet} icon={item.tab === "assign" ? "bike" : "bag"} />
      ) : null}
    </article>
  );
}

