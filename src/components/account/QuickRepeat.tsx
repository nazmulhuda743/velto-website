"use client";

import { useEffect, useState } from "react";
import Link from "@/components/i18n/Link";
import { track } from "@/components/layout/Analytics";
import { fallbackDays, hoursText } from "@/components/forms/PickupWindows";
import { submitBooking, type BookingFormData } from "@/components/forms/submit";
import type { AccountText } from "@/content/i18n/account";
import { bookable, type AvailabilityDay, type WindowId } from "@/lib/capacity-logic";
import { fill, format } from "@/lib/i18n/config";
import { dayLabel, opsPickupWhen, type DateWords } from "@/lib/pickup-when";

type Text = AccountText["quick"];

/** Windows to offer: live capacity for the sector when it's on, otherwise the usual preference windows. */
type Load = { state: "loading" } | { state: "ready"; days: AvailabilityDay[]; live: boolean } | { state: "unavailable" };

/**
 * "Same pickup again" in one tap: the last order's items, the saved name, phone and address,
 * and only a day and a time to choose. It goes through /api/bookings exactly like the booking
 * form (same validation, estimate, Ops task, manager alert). With capacity booking on it offers
 * only open windows and books one; otherwise the time is a preference Velto confirms on WhatsApp.
 */
export function QuickRepeat({
  orderNumber,
  lines,
  data,
  sector,
  t,
  slotTaken,
  words,
  slotLabels,
  changeHref,
  placement,
}: {
  orderNumber: string;
  /** What the customer sees: "2 × Shirt", in their order. */
  lines: string[];
  /** Everything but the pickup time, in the Ops (English) form. */
  data: Omit<BookingFormData, "preferredPickup" | "slot">;
  /** Uttara sector 1–18 for live capacity; null outside Uttara. */
  sector: number | null;
  t: Text;
  /** The booking form's "that window was just booked" message. */
  slotTaken: string;
  words: DateWords;
  slotLabels: Record<string, string>;
  changeHref: string;
  placement: string;
}) {
  const [load, setLoad] = useState<Load>({ state: "loading" });
  const [reload, setReload] = useState(0);
  const [picked, setPicked] = useState<{ day?: string; window?: WindowId }>({});
  const [state, setState] = useState<{ kind: "idle" | "sending" } | { kind: "done"; reference?: string } | { kind: "error"; message: string }>({ kind: "idle" });

  // Days and windows depend on the clock and on live capacity, so they load in the browser.
  useEffect(() => {
    const controller = new AbortController();
    const preference = () => setLoad({ state: "ready", days: fallbackDays(), live: false });
    if (!sector) {
      preference();
      return () => controller.abort();
    }
    fetch(`/api/capacity?sector=${sector}`, { signal: controller.signal, cache: "no-store" })
      .then(async (res) => {
        const body = (await res.json().catch(() => null)) as { enabled?: boolean; zone?: string | null; days?: AvailabilityDay[] } | null;
        if (!body || body.enabled !== true || (res.ok && !body.zone)) return preference();
        if (!res.ok || !Array.isArray(body.days)) return setLoad({ state: "unavailable" });
        setLoad({ state: "ready", days: body.days, live: true });
      })
      .catch((e: unknown) => {
        if (!(e instanceof DOMException && e.name === "AbortError")) preference();
      });
    return () => controller.abort();
  }, [sector, reload]);

  const days = load.state === "ready" ? load.days.filter((d) => d.windows.some((w) => bookable(w.status))).slice(0, 3) : [];
  const day = days.find((d) => d.date === picked.day) ?? days[0];
  const windows = day ? day.windows.filter((w) => bookable(w.status)) : [];
  const chosen = windows.find((w) => w.id === picked.window) ?? null;

  async function book() {
    if (!day || !chosen || load.state !== "ready" || state.kind === "sending") return;
    setState({ kind: "sending" });
    track("booking_start", { section: "quick-repeat", placement });
    const result = await submitBooking({
      ...data,
      preferredPickup: opsPickupWhen(day.date, chosen, load.live),
      ...(load.live ? { slot: { date: day.date, window: chosen.id } } : {}),
    });
    if (result.ok) {
      track("booking_success", { section: "quick-repeat", placement, service: data.service });
      setState({ kind: "done", reference: result.reference });
    } else if (result.code === "slot_unavailable") {
      setPicked({ day: day.date });
      setReload((n) => n + 1);
      setState({ kind: "error", message: slotTaken });
    } else {
      setState({ kind: "error", message: result.code === "duplicate_submission" ? t.duplicate : t.failed });
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
    `inline-flex min-h-11 items-center justify-center rounded-md border px-4 py-1.5 text-[15px] font-semibold transition-colors ${
      active ? "border-navy bg-navy text-white" : "border-line-strong bg-white text-navy hover:border-navy"
    }`;

  return (
    <div className="rounded-md border border-line bg-soft/60 p-4 md:p-5" data-quick-repeat={load.state === "ready" && load.live ? "live" : ""}>
      <p className="t-small text-secondary">
        <span className="font-semibold text-navy">{format(t.same, { n: orderNumber })}</span>
        {lines.length ? <>: {lines.slice(0, 3).join(", ")}{lines.length > 3 ? ` ${fill(t.more, { n: lines.length - 3 }, words.locale)}` : ""}</> : null}
      </p>
      <p className="mt-0.5 t-small text-secondary">{format(t.from, { address: data.address })}</p>

      {load.state === "unavailable" || (load.state === "ready" && !days.length) ? (
        <p className="mt-4 t-small text-body">
          {t.noWindows}{" "}
          <Link href={changeHref} className="font-semibold text-navy underline decoration-blue/40 underline-offset-4">
            {t.change}
          </Link>
        </p>
      ) : (
        <>
          <fieldset className="mt-4">
            <legend className="t-caption font-semibold uppercase tracking-[0.04em] text-secondary">{t.day}</legend>
            <div className="mt-1.5 flex min-h-11 flex-wrap gap-2">
              {days.map((d) => (
                <button key={d.date} type="button" aria-pressed={day?.date === d.date} onClick={() => setPicked({ day: d.date })} className={chip(day?.date === d.date)}>
                  {dayLabel(d.date, words)}
                </button>
              ))}
            </div>
          </fieldset>
          <fieldset className="mt-3">
            <legend className="t-caption font-semibold uppercase tracking-[0.04em] text-secondary">{t.time}</legend>
            <div className="mt-1.5 flex min-h-11 flex-wrap gap-2">
              {windows.map((w) => (
                <button key={w.id} type="button" aria-pressed={chosen?.id === w.id} onClick={() => setPicked({ day: day?.date, window: w.id })} className={chip(chosen?.id === w.id)}>
                  <span>
                    {slotLabels[w.id] ?? w.id} <span className="font-normal opacity-80">{hoursText(w.starts, w.ends, words.locale)}</span>
                  </span>
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
        </>
      )}
      {state.kind === "error" ? (
        <p role="alert" className="mt-3 t-small font-semibold text-error">
          {state.message}
        </p>
      ) : null}
    </div>
  );
}
