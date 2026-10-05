"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BottomSheet } from "@/components/app/BottomSheet";
import { ChipGroup } from "@/components/app/controls";
import { Card, Eyebrow, SummaryRow, buttonClass } from "@/components/app/ui";
import { fallbackDays, hoursText } from "@/components/forms/PickupWindows";
import { submitBooking, type BookingFormData } from "@/components/forms/submit";
import { track } from "@/components/layout/Analytics";
import { defaultSlot, isTomorrow, pickupDays, type SlotDay } from "@/lib/customer/app-logic";
import type { AvailabilityDay, WindowId } from "@/lib/capacity-logic";
import { fill, format, localDigits, type Locale } from "@/lib/i18n/config";
import { opsPickupWhen } from "@/lib/pickup-when";

export type RebookText = {
  eyebrow: string;
  title: string;
  /** Lapsed card: "Same address, {when}. Change anything before you book." */
  body?: string;
  pickupFrom: string;
  pickupWhen: string;
  change: string;
  bookThis: string;
  confirmNote: string;
  somethingElse?: string;
  tomorrow: string;
  whenTomorrow: string;
  whenDay: string;
  windows: Record<string, string>;
  windowWords: Record<string, string>;
  pickupTime: string;
  pickupDay: string;
  timeWindow: string;
  close: string;
  successTitle: string;
  successBody: string;
  successRef: string;
  sending: string;
  failed: string;
  duplicate: string;
  slotTaken: string;
  noWindows: string;
  weekdays: readonly string[];
  months: readonly string[];
  dayMonth: string;
};

type Load = { state: "loading" } | { state: "ready"; days: SlotDay[]; today: string; live: boolean } | { state: "unavailable" };

const dhakaToday = () => new Date(Date.now() + 6 * 3_600_000).toISOString().slice(0, 10);

/**
 * "Same as last time" / "Welcome back": the last order again in two taps. The slot starts on the
 * first day with capacity from tomorrow, in the same window as last time when it is open; "Change"
 * opens the day and window picker. It books through /api/bookings exactly like the booking form.
 */
export function RebookCard({
  data,
  sector,
  lastWindow,
  address,
  changeHref,
  otherHref,
  phone,
  t,
  locale,
  placement,
}: {
  data: Omit<BookingFormData, "preferredPickup" | "slot">;
  sector: number | null;
  lastWindow: string | null;
  address: string;
  /** The booking form, prefilled with this order (to change the address, items or service). */
  changeHref: string;
  otherHref?: string;
  phone: string;
  t: RebookText;
  locale: Locale;
  placement: string;
}) {
  const [load, setLoad] = useState<Load>({ state: "loading" });
  const [reload, setReload] = useState(0);
  const [picked, setPicked] = useState<{ date: string; window: string } | null>(null);
  const [sheet, setSheet] = useState(false);
  const [state, setState] = useState<{ kind: "idle" | "sending" } | { kind: "done"; reference?: string; when: string } | { kind: "error"; message: string }>({ kind: "idle" });

  // Days depend on the clock and on live capacity, so they load in the browser.
  useEffect(() => {
    const controller = new AbortController();
    // Capacity booking off: the usual preference windows (Velto confirms the time on a call).
    const preference = () =>
      setLoad({ state: "ready", today: dhakaToday(), live: false, days: fallbackDays().map((d) => ({ date: d.date, windows: d.windows.map((w) => ({ ...w, left: w.status === "open" ? 1 : 0 })) })) });
    if (!sector) {
      preference();
      return () => controller.abort();
    }
    fetch(`/api/capacity?sector=${sector}`, { signal: controller.signal, cache: "no-store" })
      .then(async (res) => {
        const body = (await res.json().catch(() => null)) as { enabled?: boolean; zone?: string | null; today?: string; days?: AvailabilityDay[] } | null;
        if (!body || body.enabled !== true || (res.ok && !body.zone)) return preference();
        if (!res.ok || !Array.isArray(body.days)) return setLoad({ state: "unavailable" });
        setLoad({ state: "ready", days: body.days, today: body.today ?? dhakaToday(), live: true });
      })
      .catch((e: unknown) => {
        if (!(e instanceof DOMException && e.name === "AbortError")) preference();
      });
    return () => controller.abort();
  }, [sector, reload]);

  const days = useMemo(() => (load.state === "ready" ? pickupDays(load.days, load.today) : []), [load]);
  const today = load.state === "ready" ? load.today : dhakaToday();
  const fallback = load.state === "ready" ? defaultSlot(load.days, load.today, lastWindow) : null;
  const slot = picked && days.some((d) => d.date === picked.date && d.windows.some((w) => w.id === picked.window)) ? picked : fallback;
  const day = slot ? days.find((d) => d.date === slot.date) : undefined;
  const win = slot && day ? day.windows.find((w) => w.id === slot.window) : undefined;

  const dateText = (date: string) => {
    const d = new Date(`${date}T00:00:00Z`);
    return fill(t.dayMonth, { weekday: t.weekdays[d.getUTCDay()], day: d.getUTCDate(), month: t.months[d.getUTCMonth()] }, locale);
  };
  const windowText = (w: { id: string; starts: string; ends: string }) => t.windows[w.id] ?? hoursText(w.starts, w.ends, locale);
  const slotText = (withTomorrow: boolean) =>
    slot && win ? `${withTomorrow && isTomorrow(slot.date, today) ? `${t.tomorrow}, ` : ""}${dateText(slot.date)}, ${windowText(win)}` : "";

  async function book() {
    if (!slot || !win || load.state !== "ready" || state.kind === "sending") return;
    setState({ kind: "sending" });
    track("booking_start", { section: "app-rebook", placement });
    const result = await submitBooking({
      ...data,
      preferredPickup: opsPickupWhen(slot.date, { id: win.id as WindowId, starts: win.starts, ends: win.ends }, load.live),
      ...(load.live ? { slot: { date: slot.date, window: win.id as WindowId } } : {}),
    });
    if (result.ok) {
      track("booking_success", { section: "app-rebook", placement, service: data.service });
      setState({ kind: "done", reference: result.reference, when: slotText(false) });
    } else if (result.code === "slot_unavailable") {
      setPicked(null);
      setReload((n) => n + 1);
      setState({ kind: "error", message: t.slotTaken });
    } else {
      setState({ kind: "error", message: result.code === "duplicate_submission" ? t.duplicate : t.failed });
    }
  }

  if (state.kind === "done") {
    return (
      <Card className="space-y-2" data-app-rebook="done">
        <h2 role="status" className="a-card text-navy">
          {t.successTitle}
        </h2>
        <p className="a-body text-secondary">{format(t.successBody, { when: state.when, phone })}</p>
        {state.reference ? <p className="a-sec text-muted">{format(t.successRef, { ref: state.reference })}</p> : null}
      </Card>
    );
  }

  const nothingOpen = load.state === "unavailable" || (load.state === "ready" && !slot);
  const lapsedWhen = slot && win ? (isTomorrow(slot.date, today) ? fill(t.whenTomorrow, { window: t.windowWords[win.id] ?? "" }, locale) : fill(t.whenDay, { day: dateText(slot.date), window: t.windowWords[win.id] ?? "" }, locale)) : null;

  return (
    <Card className="space-y-3.5" data-app-rebook={placement}>
      <Eyebrow>{t.eyebrow}</Eyebrow>
      <h2 className="a-card text-navy">{t.title}</h2>
      {t.body && lapsedWhen ? <p className="a-body text-secondary">{format(t.body, { when: lapsedWhen })}</p> : null}
      <div className="border-t border-line">
        <SummaryRow label={t.pickupFrom} value={address} action={t.change} href={changeHref} />
        {nothingOpen ? (
          <p className="border-b border-line py-3 a-sec text-body">
            {t.noWindows}{" "}
            <Link href={changeHref} className="font-semibold text-action">
              {t.change}
            </Link>
          </p>
        ) : (
          <SummaryRow label={t.pickupWhen} value={load.state === "loading" ? "…" : slotText(true)} action={t.change} onClick={() => setSheet(true)} />
        )}
      </div>
      <button type="button" onClick={book} className={buttonClass("primary")} aria-disabled={!slot || state.kind === "sending"} data-analytics="book_pickup_click" data-placement={placement}>
        {state.kind === "sending" ? t.sending : t.bookThis}
      </button>
      {state.kind === "error" ? (
        <p role="alert" className="a-sec font-semibold text-app-red">
          {state.message}
        </p>
      ) : null}
      {otherHref && t.somethingElse ? (
        <Link href={otherHref} className={buttonClass("text", "w-full")}>
          {t.somethingElse}
        </Link>
      ) : (
        <p className="a-cap text-muted">{t.confirmNote}</p>
      )}

      <BottomSheet open={sheet} onClose={() => setSheet(false)} title={t.pickupTime} closeLabel={t.close}>
        <div className="space-y-5 pt-1">
          <ChipGroup
            legend={t.pickupDay}
            name="rebook-day"
            variant="day"
            value={slot?.date ?? null}
            onChange={(date) => {
              const d = days.find((x) => x.date === date);
              const keep = d?.windows.find((w) => w.id === slot?.window) ?? d?.windows[0];
              if (keep) setPicked({ date, window: keep.id });
            }}
            options={days.map((d) => {
              const x = new Date(`${d.date}T00:00:00Z`);
              return {
                value: d.date,
                label: isTomorrow(d.date, today) ? t.tomorrow : t.weekdays[x.getUTCDay()],
                sub: `${localDigits(x.getUTCDate(), locale)} ${t.months[x.getUTCMonth()]}`,
              };
            })}
          />
          {day ? (
            <ChipGroup
              legend={t.timeWindow}
              name="rebook-window"
              value={slot?.window ?? null}
              onChange={(w) => setPicked({ date: day.date, window: w })}
              options={day.windows.map((w) => ({ value: w.id, label: windowText(w) }))}
            />
          ) : null}
        </div>
      </BottomSheet>
    </Card>
  );
}
