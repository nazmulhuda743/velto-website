"use client";

import { useEffect, useMemo, useState } from "react";
import type { FormText } from "@/content/i18n/forms/en";
import { fill, localDigits, type Locale } from "@/lib/i18n/config";
import {
  addDaysIso,
  bookable,
  parseAvailability,
  type AvailabilityDay,
  type AvailabilityWindow,
  type WindowId,
} from "@/lib/capacity-logic";

type Text = FormText["booking"];
type Common = FormText["common"];

/** The chosen window: `booked` when it comes from live capacity (the server reserves it). */
export type PickedWindow = { date: string; window: WindowId; starts: string; ends: string; booked: boolean };

/** Windows shown when capacity booking is off or can't load: a preference Velto confirms by phone. */
const FALLBACK: Omit<AvailabilityWindow, "status" | "left">[] = [
  { id: "morning", starts: "09:00", ends: "12:00" },
  { id: "afternoon", starts: "12:00", ends: "16:00" },
  { id: "evening", starts: "16:00", ends: "20:00" },
];

const dhakaNow = () => new Date(Date.now() + 6 * 3_600_000);
const minutes = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

/** Seven days of preference windows; today's close an hour before they end. */
export function fallbackDays(): AvailabilityDay[] {
  const now = dhakaNow();
  const today = now.toISOString().slice(0, 10);
  const nowMin = now.getUTCHours() * 60 + now.getUTCMinutes();
  return Array.from({ length: 7 }, (_, i) => ({
    date: addDaysIso(today, i),
    windows: FALLBACK.map((w) => ({ ...w, left: 0, status: i === 0 && minutes(w.ends) - 60 <= nowMin ? ("past" as const) : ("open" as const) })),
  }));
}

/** "9–12টা" in Bangla digits, "9 AM–12 PM" in English. */
export function hoursText(starts: string, ends: string, locale: Locale) {
  const h = (x: string) => {
    const n = Number(x.slice(0, 2)) % 12 || 12;
    const m = Number(x.slice(3, 5));
    return `${n}${m ? `:${String(m).padStart(2, "0")}` : ""}`;
  };
  if (locale === "bn") return `${localDigits(h(starts), locale)}টা–${localDigits(h(ends), locale)}টা`;
  const ap = (x: string) => (Number(x.slice(0, 2)) < 12 ? "AM" : "PM");
  return ap(starts) === ap(ends) ? `${h(starts)}–${h(ends)} ${ap(ends)}` : `${h(starts)} ${ap(starts)}–${h(ends)} ${ap(ends)}`;
}

type Load =
  | { state: "idle" }
  | { state: "loading" }
  | { state: "live"; days: AvailabilityDay[] }
  | { state: "preference"; days: AvailabilityDay[]; reason: "off" | "error" | "outside" };

/**
 * Pickup day and window, from the live capacity for the customer's sector. A full window can't
 * be chosen; "2 left" shows when places are scarce. When capacity booking is off (or can't load),
 * the same picker offers the usual windows as a preference Velto confirms by phone.
 */
export function PickupWindows({
  sector,
  outside,
  value,
  onChange,
  refresh,
  t,
  c,
  locale,
  errorDate,
  errorSlot,
  endpoint = "/api/capacity",
}: {
  /** Staff booking reads the admin-only availability, which is live even while the website switch is off. */
  endpoint?: string;
  sector: string;
  outside: boolean;
  value: PickedWindow | null;
  onChange: (v: PickedWindow | null) => void;
  /** Bumped after "that window was just taken" so the picker reloads. */
  refresh: number;
  t: Text;
  c: Common;
  locale: Locale;
  errorDate?: string;
  errorSlot?: string;
}) {
  const [day, setDay] = useState<string | null>(value?.date ?? null);
  // Preference windows (capacity off, unreachable, or outside Uttara) are worked out once.
  const [fallback] = useState(fallbackDays);
  // The last answer from /api/capacity, for the sector and refresh it was asked for.
  const [result, setResult] = useState<{ key: string; load: Load } | null>(null);
  const key = `${sector}|${refresh}`;

  useEffect(() => {
    if (outside || !sector) return;
    const controller = new AbortController();
    const done = (load: Load) => setResult({ key, load });
    fetch(`${endpoint}?sector=${encodeURIComponent(sector)}`, { signal: controller.signal, cache: "no-store" })
      .then(async (res) => {
        const body = (await res.json().catch(() => null)) as Record<string, unknown> | null;
        if (!body || body.enabled !== true) return done({ state: "preference", days: fallback, reason: "off" });
        const a = parseAvailability({ ...body, ok: true });
        if (!res.ok || !a || !a.zone || !a.days.length) return done({ state: "preference", days: fallback, reason: "error" });
        done({ state: "live", days: a.days });
      })
      .catch((e: Error) => {
        if (e.name !== "AbortError") done({ state: "preference", days: fallback, reason: "error" });
      });
    return () => controller.abort();
  }, [sector, outside, key, fallback, endpoint]);

  const load = useMemo<Load>(
    () =>
      outside
        ? { state: "preference", days: fallback, reason: "outside" }
        : !sector
          ? { state: "idle" }
          : result?.key === key
            ? result.load
            : { state: "loading" },
    [outside, sector, result, key, fallback],
  );
  const days = useMemo(() => (load.state === "live" || load.state === "preference" ? load.days : []), [load]);
  const live = load.state === "live";

  // Keep a day chosen: the customer's, else the first day with an open window.
  const firstOpen = useMemo(() => days.find((d) => d.windows.some((w) => bookable(w.status)))?.date ?? null, [days]);
  const shownDay = day && days.some((d) => d.date === day) ? day : firstOpen;
  const current = days.find((d) => d.date === shownDay) ?? null;

  // A chosen window that is no longer bookable (reloaded as full, or the mode changed) is cleared.
  useEffect(() => {
    if (!value || !days.length) return;
    const w = days.find((d) => d.date === value.date)?.windows.find((x) => x.id === value.window);
    if (!w || !bookable(w.status) || value.booked !== live) onChange(null);
  }, [days, live, value, onChange]);

  const today = days[0]?.date;
  const dayLabel = (iso: string) => {
    const d = new Date(`${iso}T00:00:00Z`);
    const words = iso === today ? t.today : iso === (today && addDaysIso(today, 1)) ? t.tomorrow : c.weekdays[d.getUTCDay()];
    return { top: words, bottom: fill(c.dayMonthShort, { day: d.getUTCDate(), month: c.months[d.getUTCMonth()] }, locale) };
  };

  if (load.state === "idle") {
    return <p className="rounded-md border border-dashed border-line-strong bg-soft/60 px-4 py-4 t-small text-secondary" data-pickup-needs-sector>{t.chooseSectorFirst}</p>;
  }
  if (load.state === "loading") {
    return (
      <div role="status" aria-label={t.loadingWindows} className="space-y-3">
        <div className="flex gap-2">
          {[0, 1, 2, 3].map((i) => <span key={i} className="skeleton h-16 w-20 rounded-md" />)}
        </div>
        <span className="skeleton block h-14 w-full rounded-md" />
        <span className="skeleton block h-14 w-full rounded-md" />
      </div>
    );
  }

  return (
    <div className="space-y-4" data-pickup-windows={live ? "live" : "preference"}>
      <p className="t-small text-secondary">{live ? t.pickupHintBooked : t.pickupHintPreference}</p>
      {load.state === "preference" && load.reason === "error" ? <p className="t-small text-navy">{t.windowsError}</p> : null}

      <fieldset className="min-w-0">
        <legend className="text-[15px] font-semibold text-navy">{t.dayLabel}</legend>
        <div className="-mx-1 mt-2 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
          {days.map((d, i) => {
            const open = d.windows.some((w) => bookable(w.status));
            const l = dayLabel(d.date);
            const chosen = d.date === shownDay;
            return (
              <label
                key={d.date}
                data-day
                className={`relative flex min-h-16 w-[4.75rem] shrink-0 cursor-pointer flex-col items-center justify-center rounded-md border px-1 text-center has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-blue ${
                  chosen ? "border-action bg-[#e8f3fb]" : open ? "border-line-strong bg-white hover:border-navy/60" : "border-line bg-soft"
                }`}
              >
                <input
                  id={i === 0 ? "booking-date" : undefined}
                  type="radio"
                  name="pickup-day"
                  value={d.date}
                  checked={chosen}
                  onChange={() => setDay(d.date)}
                  aria-describedby={errorDate ? "booking-date-error" : undefined}
                  className="sr-only"
                />
                <span className={`t-small font-semibold ${open ? "text-navy" : "text-secondary"}`}>{l.top}</span>
                <span className={`text-[13px] ${open ? "text-body" : "text-secondary"}`}>{l.bottom}</span>
                {!open ? <span className="text-[11px] font-semibold uppercase tracking-[0.04em] text-secondary">{live ? t.windowStatus.full : t.windowStatus.past}</span> : null}
              </label>
            );
          })}
        </div>
        {errorDate ? <p id="booking-date-error" className="mt-2 t-small font-medium text-error">{errorDate}</p> : null}
      </fieldset>

      <fieldset className="min-w-0">
        <legend className="text-[15px] font-semibold text-navy">{t.slotLabel}</legend>
        {current && current.windows.some((w) => bookable(w.status)) ? null : <p className="mt-2 t-small text-navy">{t.noWindowsDay}</p>}
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {(current?.windows ?? []).map((w, i) => {
            const ok = bookable(w.status);
            const chosen = value?.date === current?.date && value?.window === w.id;
            const status =
              !live && ok
                ? ""
                : w.status === "few"
                  ? w.left === 1
                    ? t.windowStatus.fewOne
                    : fill(t.windowStatus.few, { n: w.left }, locale)
                  : t.windowStatus[w.status];
            return (
              <label
                key={w.id}
                className={`flex min-h-14 items-center justify-between gap-3 rounded-md border px-4 py-3 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-blue ${
                  !ok ? "cursor-not-allowed border-line bg-soft" : chosen ? "cursor-pointer border-action bg-[#e8f3fb]" : "cursor-pointer border-line-strong bg-white hover:border-navy/60"
                }`}
                data-window={w.id}
                data-status={w.status}
              >
                <input
                  id={i === 0 ? "booking-slot" : undefined}
                  type="radio"
                  name="pickup-window"
                  value={w.id}
                  checked={chosen}
                  disabled={!ok}
                  onChange={() => current && onChange({ date: current.date, window: w.id, starts: w.starts, ends: w.ends, booked: live })}
                  aria-describedby={errorSlot ? "booking-slot-error" : undefined}
                  className="sr-only"
                />
                <span className="flex min-w-0 items-center gap-3">
                  {/* The chosen window gets a tick, so the choice isn't shown by colour alone. */}
                  {chosen ? (
                    <svg viewBox="0 0 20 20" width="20" height="20" aria-hidden="true" className="shrink-0 text-action" data-window-tick>
                      <circle cx="10" cy="10" r="10" fill="currentColor" />
                      <path d="M5.5 10.2l3 3 6-6.4" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  ) : null}
                  <span className="min-w-0">
                    <span className={`block font-semibold ${ok ? "text-navy" : "text-secondary"}`}>{t.slots[w.id]}</span>
                    <span className={`block t-small ${ok ? "text-body" : "text-secondary"}`}>{hoursText(w.starts, w.ends, locale)}</span>
                  </span>
                </span>
                {status ? (
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-1 text-[12px] font-semibold ${
                      w.status === "open" ? "bg-success-soft text-success" : w.status === "few" ? "bg-[#fff4e5] text-[#8a5300]" : "bg-white text-secondary"
                    }`}
                  >
                    {status}
                  </span>
                ) : null}
              </label>
            );
          })}
        </div>
        {errorSlot ? <p id="booking-slot-error" className="mt-2 t-small font-medium text-error">{errorSlot}</p> : null}
      </fieldset>
    </div>
  );
}
