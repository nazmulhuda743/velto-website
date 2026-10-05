"use client";

import { useState, useTransition } from "react";
import { Switch } from "@/components/app/controls";
import { routineAction } from "@/lib/customer/routine-actions";

type Text = { title: string; body: string; requested: string; failed: string; needAddress: string };

/**
 * "Make this weekly?": one switch. On asks Velto for a weekly pickup on the day and window shown
 * (a manager confirms each one on WhatsApp first); off withdraws it again.
 */
export function WeeklyOffer({ weekday, window, service, t }: { weekday: number; window: string; service: string; t: Text }) {
  const [on, setOn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const toggle = (next: boolean) => {
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
      <Switch checked={on} onChange={toggle} label={t.title} disabled={pending} />
      <p className="pb-3 a-sec text-secondary">{on ? t.requested : t.body}</p>
      {error ? (
        <p role="alert" className="pb-3 a-cap text-app-red">
          {error}
        </p>
      ) : null}
    </section>
  );
}
