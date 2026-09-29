"use client";

import { useState, useSyncExternalStore } from "react";
import Link from "@/components/i18n/Link";
import { track } from "@/components/layout/Analytics";
import { submitBooking, type BookingFormData } from "@/components/forms/submit";
import type { AccountText } from "@/content/i18n/account";
import { fill, format } from "@/lib/i18n/config";
import { isoDate, niceDate, pickupWhen, SLOTS, slotOpenToday, type DateWords, type SlotId } from "@/lib/pickup-when";

type Text = AccountText["quick"];

const noop = () => () => {};
/** Days and times depend on the customer's clock, so they render in the browser only. */
const useClient = () => useSyncExternalStore(noop, () => true, () => false);

/**
 * "Same pickup again" in one tap: the last order's items, the saved name, phone and address,
 * and only a day and a time to choose. It goes through /api/bookings exactly like the booking
 * form (same validation, estimate, Ops task and manager alert); Velto still confirms on WhatsApp.
 */
export function QuickRepeat({
  orderNumber,
  lines,
  data,
  t,
  words,
  slotLabels,
  changeHref,
  placement,
}: {
  orderNumber: string;
  /** What the customer sees: "2 × Shirt", in their order. */
  lines: string[];
  /** Everything but the pickup time, in the Ops (English) form. */
  data: Omit<BookingFormData, "preferredPickup">;
  t: Text;
  words: DateWords;
  slotLabels: Record<SlotId, string>;
  changeHref: string;
  placement: string;
}) {
  const client = useClient();
  const todayOpen = client && SLOTS.some((s) => slotOpenToday(s.end));
  const days = client ? [...(todayOpen ? [0] : []), 1, 2].map((offset) => isoDate(offset)) : [];
  const [picked, setDay] = useState<string | null>(null);
  const day = picked && days.includes(picked) ? picked : (days[0] ?? "");
  const openSlots = client ? SLOTS.filter((s) => day !== isoDate(0) || slotOpenToday(s.end)) : [];
  const [slot, setSlot] = useState<SlotId | null>(null);
  const [state, setState] = useState<{ kind: "idle" | "sending" } | { kind: "done"; reference?: string } | { kind: "error"; duplicate: boolean }>({ kind: "idle" });
  const chosen = slot && openSlots.some((s) => s.id === slot) ? slot : null;

  const dayLabel = (iso: string) => (iso === isoDate(0) ? words.today : iso === isoDate(1) ? words.tomorrow : niceDate(iso, words));

  async function book() {
    if (!chosen || state.kind === "sending") return;
    setState({ kind: "sending" });
    track("booking_start", { section: "quick-repeat", placement });
    const result = await submitBooking({ ...data, preferredPickup: pickupWhen(day, chosen) });
    if (result.ok) {
      track("booking_success", { section: "quick-repeat", placement, service: data.service });
      setState({ kind: "done", reference: result.reference });
    } else {
      setState({ kind: "error", duplicate: result.code === "duplicate_submission" });
    }
  }

  if (state.kind === "done") {
    return (
      <div role="status" className="rounded-md border border-success/40 bg-success/5 p-4" data-quick-repeat="done">
        <p className="font-semibold text-navy">{t.doneTitle}</p>
        <p className="mt-1 t-small text-body">{state.reference ? format(t.doneBody, { ref: state.reference }) : t.doneBodyNoRef}</p>
      </div>
    );
  }

  const chip = (active: boolean) =>
    `inline-flex h-11 items-center justify-center rounded-md border px-4 text-[15px] font-semibold transition-colors ${
      active ? "border-navy bg-navy text-white" : "border-line-strong bg-white text-navy hover:border-navy"
    }`;

  return (
    <div className="rounded-md border border-line bg-soft/60 p-4 md:p-5" data-quick-repeat>
      <p className="t-small text-secondary">
        <span className="font-semibold text-navy">{format(t.same, { n: orderNumber })}</span>
        {lines.length ? <>: {lines.slice(0, 3).join(", ")}{lines.length > 3 ? ` ${fill(t.more, { n: lines.length - 3 }, words.locale)}` : ""}</> : null}
      </p>
      <p className="mt-0.5 t-small text-secondary">{format(t.from, { address: data.address })}</p>

      <fieldset className="mt-4">
        <legend className="t-caption font-semibold uppercase tracking-[0.04em] text-secondary">{t.day}</legend>
        <div className="mt-1.5 flex min-h-11 flex-wrap gap-2">
          {days.map((d) => (
            <button key={d} type="button" aria-pressed={day === d} onClick={() => setDay(d)} className={chip(day === d)}>
              {dayLabel(d)}
            </button>
          ))}
        </div>
      </fieldset>
      <fieldset className="mt-3">
        <legend className="t-caption font-semibold uppercase tracking-[0.04em] text-secondary">{t.time}</legend>
        <div className="mt-1.5 flex min-h-11 flex-wrap gap-2">
          {openSlots.map((s) => (
            <button key={s.id} type="button" aria-pressed={chosen === s.id} onClick={() => setSlot(s.id)} className={chip(chosen === s.id)}>
              {slotLabels[s.id]}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <button
          type="button"
          onClick={book}
          disabled={!chosen || state.kind === "sending"}
          data-analytics="book_pickup_click"
          data-placement={placement}
          className="inline-flex h-12 items-center justify-center rounded-md bg-action px-8 font-semibold text-white hover:bg-action-hover disabled:cursor-not-allowed disabled:opacity-50"
        >
          {state.kind === "sending" ? t.sending : t.button}
        </button>
        <Link href={changeHref} className="t-small font-semibold text-navy underline decoration-blue/40 underline-offset-4 hover:decoration-blue">
          {t.change}
        </Link>
      </div>
      {state.kind === "error" ? (
        <p role="alert" className={`mt-3 t-small font-semibold ${state.duplicate ? "text-navy" : "text-error"}`}>
          {state.duplicate ? t.duplicate : t.failed}
        </p>
      ) : null}
    </div>
  );
}
