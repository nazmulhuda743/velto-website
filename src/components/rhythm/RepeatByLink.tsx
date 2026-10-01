"use client";

import { useEffect, useState } from "react";
import Link from "@/components/i18n/Link";
import { track } from "@/components/layout/Analytics";
import { fallbackDays, hoursText } from "@/components/forms/PickupWindows";
import type { RhythmText } from "@/content/i18n/rhythm";
import type { NotifyText } from "@/content/i18n/notify";
import { NotifyCard } from "@/components/notify/NotifyCard";
import { bookable, type AvailabilityDay, type WindowId } from "@/lib/capacity-logic";
import { fill } from "@/lib/i18n/config";
import { addDays, dayLabel, dhakaToday, type DateWords } from "@/lib/pickup-when";

type Load = { state: "loading" } | { state: "ready"; days: AvailabilityDay[]; live: boolean };
type Send = { kind: "idle" | "sending" } | { kind: "done"; reference?: string } | { kind: "error"; message: string };

/**
 * The one tap. The usual service is already chosen; the customer only confirms a day and a
 * time (tomorrow evening is preselected when it's open, since reminders go out the evening
 * before). Only the code and the chosen window leave the browser: /api/rhythm/book fills in the
 * name, phone and address from Velto Ops.
 */
export function RepeatByLink({
  code,
  sector,
  t,
  words,
  slotLabels,
  whatsappHref,
  notify,
  preview = false,
}: {
  code: string;
  /** Uttara sector from the Ops address, for live capacity; null when unknown. */
  sector: number | null;
  t: RhythmText;
  words: DateWords;
  slotLabels: Record<string, string>;
  whatsappHref: string;
  /** "Want updates on this pickup?" after booking (the code ties it to this phone). */
  notify: NotifyText;
  preview?: boolean;
}) {
  const [load, setLoad] = useState<Load>({ state: "loading" });
  const [reload, setReload] = useState(0);
  const [picked, setPicked] = useState<{ day?: string; window?: WindowId }>({});
  const [send, setSend] = useState<Send>({ kind: "idle" });
  const [stop, setStop] = useState<"idle" | "sending" | "done">("idle");

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
        if (!res.ok || !body || body.enabled !== true || !body.zone || !Array.isArray(body.days)) return preference();
        setLoad({ state: "ready", days: body.days, live: true });
      })
      .catch((e: unknown) => {
        if (!(e instanceof DOMException && e.name === "AbortError")) preference();
      });
    return () => controller.abort();
  }, [sector, reload]);

  const days = load.state === "ready" ? load.days.filter((d) => d.windows.some((w) => bookable(w.status))).slice(0, 3) : [];
  // Tomorrow is the default day when it can be booked: reminders go out the evening before.
  const tomorrow = addDays(dhakaToday(), 1);
  const defaultDay = days.find((d) => d.date === tomorrow) ?? days[0];
  const day = days.find((d) => d.date === picked.day) ?? defaultDay;
  const windows = day ? day.windows.filter((w) => bookable(w.status)) : [];
  const chosen = windows.find((w) => w.id === picked.window) ?? windows.find((w) => w.id === "evening") ?? windows[0] ?? null;
  const when = day && chosen ? `${dayLabel(day.date, words)} ${slotLabels[chosen.id] ?? chosen.id}`.toLowerCase() : "";

  async function book() {
    if (preview || !day || !chosen || load.state !== "ready" || send.kind === "sending") return;
    setSend({ kind: "sending" });
    track("booking_start", { section: "reminder", placement: "reminder_link" });
    try {
      const res = await fetch("/api/rhythm/book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, date: day.date, window: chosen.id, starts: chosen.starts, ends: chosen.ends, live: load.live }),
      });
      const body = (await res.json().catch(() => null)) as { ok?: boolean; reference?: string; error?: { code?: string } } | null;
      if (res.ok && body?.ok) {
        track("booking_success", { section: "reminder", placement: "reminder_link" });
        setSend({ kind: "done", reference: body.reference });
      } else if (body?.error?.code === "slot_unavailable") {
        setPicked({ day: day.date });
        setReload((n) => n + 1);
        setSend({ kind: "error", message: t.slotTaken });
      } else if (body?.error?.code === "duplicate_submission") {
        setSend({ kind: "done" });
      } else {
        setSend({ kind: "error", message: t.failed });
      }
    } catch {
      setSend({ kind: "error", message: t.failed });
    }
  }

  async function stopReminders() {
    if (preview || stop !== "idle") return;
    setStop("sending");
    const res = await fetch("/api/rhythm/stop", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code }) }).catch(() => null);
    setStop(res?.ok ? "done" : "idle");
  }

  if (send.kind === "done") {
    return (
      <div className="space-y-4">
        <div role="status" className="rounded-lg border border-success/40 bg-success-soft p-5" data-rhythm="done">
          <p className="text-[20px] font-semibold text-navy">✓ {t.doneTitle}</p>
          <p className="mt-1 text-body">{send.reference ? fill(t.doneBody, { ref: send.reference }, words.locale) : t.doneBodyNoRef}</p>
        </div>
        <NotifyCard t={notify} lang={words.locale === "bn" ? "bn" : "en"} variant="after" code={code} />
      </div>
    );
  }

  const chip = (active: boolean) =>
    `inline-flex min-h-11 items-center justify-center rounded-md border px-4 py-1.5 text-[15px] font-semibold transition-colors ${
      active ? "border-navy bg-navy text-white" : "border-line-strong bg-white text-navy hover:border-navy"
    }`;

  return (
    <div className="space-y-5" data-rhythm={load.state === "ready" ? (load.live ? "live" : "preference") : "loading"}>
      <fieldset>
        <legend className="t-caption font-semibold uppercase tracking-[0.04em] text-secondary">{t.day}</legend>
        <div className="mt-1.5 flex min-h-11 flex-wrap gap-2">
          {load.state === "loading" ? <span className="h-11 w-40 animate-pulse rounded-md bg-soft" /> : null}
          {days.map((d) => (
            <button key={d.date} type="button" aria-pressed={day?.date === d.date} onClick={() => setPicked({ day: d.date })} className={chip(day?.date === d.date)}>
              {dayLabel(d.date, words)}
            </button>
          ))}
        </div>
      </fieldset>
      <fieldset>
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

      <div className="space-y-2.5">
        <button
          type="button"
          onClick={book}
          disabled={!chosen || send.kind === "sending" || preview}
          data-analytics="book_pickup_click"
          data-placement="reminder_link"
          className="inline-flex min-h-14 w-full items-center justify-center rounded-md bg-action px-6 text-[17px] font-semibold text-white hover:bg-action-hover disabled:cursor-not-allowed disabled:opacity-60"
        >
          {send.kind === "sending" ? t.sending : when ? fill(t.book, { when }, words.locale) : t.bookShort}
        </button>
        {send.kind === "error" ? (
          <p role="alert" className="t-small font-semibold text-error">
            {send.message}
          </p>
        ) : null}
        <a
          href={whatsappHref}
          target="_blank"
          rel="noopener noreferrer"
          data-analytics="whatsapp_click"
          data-placement="reminder_link"
          className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-md border border-[#25d366] bg-white px-6 font-semibold text-[#137a4a] hover:bg-[#f2fbf5]"
        >
          <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5" fill="currentColor">
            <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2c-1.6 0-3.1-.4-4.4-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.9c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6a2.7 2.7 0 0 0 1.8-1.2 2.2 2.2 0 0 0 .1-1.2c0-.1-.2-.2-.4-.3Z" />
          </svg>
          {t.whatsapp}
        </a>
        <p className="text-center">
          <Link href="/book?source=reminder_link" className="inline-flex min-h-11 items-center t-small font-semibold text-secondary underline decoration-line-strong underline-offset-4 hover:text-navy">
            {t.different}
          </Link>
        </p>
      </div>

      <p className="t-small text-secondary">{t.countNote}</p>
      <p className="border-t border-line pt-4 t-caption text-secondary">
        {stop === "done" ? (
          <span role="status">{t.stopped}</span>
        ) : (
          <button type="button" onClick={stopReminders} disabled={stop === "sending"} className="min-h-10 font-semibold underline underline-offset-4 hover:text-navy" data-rhythm-stop>
            {t.stop}
          </button>
        )}
        <span className="ml-2">{t.notYou}</span>
      </p>
    </div>
  );
}
