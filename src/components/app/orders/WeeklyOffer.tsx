"use client";

import { useState, useTransition } from "react";
import { Switch } from "@/components/app/controls";
import { usePickupDays } from "@/components/app/usePickupDays";
import { defaultSlot } from "@/lib/customer/app-logic";
import { routineAction } from "@/lib/customer/routine-actions";
import { fill, type Locale } from "@/lib/i18n/config";
import { ROUTINE_WINDOWS } from "@/lib/routine";

type Text = {
  title: string;
  /** "Same service, same address, every {day} {window}. …" */
  body: string;
  /** "Every {day}, {time}. Velto will message you on WhatsApp …" */
  requested: string;
  /** The weekday's full name. */
  day: string;
  /** "evening" / "সন্ধ্যায়", per window. */
  windowWords: Record<string, string>;
  /** "Evening, 4–8 PM", per window. */
  slotNames: Record<string, string>;
  failed: string;
  needAddress: string;
};

/**
 * "Make this weekly?": one switch. On asks Velto for a weekly pickup on the day and window shown
 * (a manager confirms each one on WhatsApp first); off withdraws it again. With no window from an
 * earlier pickup it uses the window the rebook card starts on (same capacity, same rule), so Home
 * never offers "tomorrow morning" and "every Tuesday evening" side by side.
 */
export function WeeklyOffer({ weekday, window: known, sector, service, locale, t }: { weekday: number; window: string | null; sector: number | null; service: string; locale: Locale; t: Text }) {
  const [on, setOn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const load = usePickupDays(known ? null : sector);
  const routineWindow = (w: string | null | undefined) => (w && (ROUTINE_WINDOWS as readonly string[]).includes(w) ? w : null);
  const window = routineWindow(known) ?? (load.state === "ready" ? routineWindow(defaultSlot(load.days, load.today, null)?.window) : null);

  const toggle = (next: boolean) => {
    if (!window) return;
    setError(null);
    start(async () => {
      const form = new FormData();
      form.set("intent", next ? "request" : "stop");
      if (next) {
        form.set("weekday", String(weekday));
        form.set("window", window);
        form.set("service", service);
      }
      const result = await routineAction({ status: "idle" }, form);
      if (result.status === "done") setOn(next);
      else setError(result.status === "error" && result.code === "address" ? t.needAddress : t.failed);
    });
  };

  return (
    <section className="rounded-2xl border border-line bg-app-card px-4 py-1" data-app-weekly>
      <Switch checked={on} onChange={toggle} label={t.title} disabled={pending || !window} />
      {window ? (
        <p className="pb-3 a-sec text-secondary">
          {on ? fill(t.requested, { day: t.day, time: t.slotNames[window] ?? window }, locale) : fill(t.body, { day: t.day, window: t.windowWords[window] ?? "" }, locale)}
        </p>
      ) : (
        <span className="skeleton mb-3 block h-10 w-full" />
      )}
      {error ? (
        <p role="alert" className="pb-3 a-cap text-app-red">
          {error}
        </p>
      ) : null}
    </section>
  );
}
