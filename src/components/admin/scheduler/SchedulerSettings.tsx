"use client";
import { useState } from "react";
import { saveSchedulerSettings } from "@/app/admin/scheduler-actions";
import { schedulerError } from "@/lib/admin/scheduler-logic";
export function SchedulerSettings({
  config,
}: {
  config: { interval_minutes: number; starts_at: string; ends_at: string };
}) {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <section className="admin-card mt-6 p-5">
      <h2 className="text-lg font-semibold">Exact appointment times</h2>
      <p className="mt-2 text-sm text-secondary">
        Set the daily timeline and time steps. Existing appointments keep their
        booked times.
      </p>
      <form
        className="mt-4 flex flex-wrap items-end gap-4"
        action={async (form) => {
          setBusy(true);
          const r = await saveSchedulerSettings(
            Number(form.get("interval")),
            String(form.get("starts")),
            String(form.get("ends")),
          );
          setBusy(false);
          setMessage(
            r.ok ? "Scheduler settings saved." : schedulerError(r.error),
          );
        }}
      >
        <label className="text-sm">
          Time steps
          <select
            name="interval"
            defaultValue={config.interval_minutes}
            className="admin-input mt-1"
          >
            {[15, 30, 60].map((n) => (
              <option key={n} value={n}>
                {n} minutes
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          Start · Dhaka
          <input
            name="starts"
            type="time"
            required
            defaultValue={config.starts_at.slice(0, 5)}
            className="admin-input mt-1"
          />
        </label>
        <label className="text-sm">
          Finish · Dhaka
          <input
            name="ends"
            type="time"
            required
            defaultValue={config.ends_at.slice(0, 5)}
            className="admin-input mt-1"
          />
        </label>
        <button disabled={busy} className="admin-btn-primary">
          {busy ? "Saving…" : "Save schedule settings"}
        </button>
      </form>
      {message && (
        <p role="status" className="mt-3 text-sm">
          {message}
        </p>
      )}
    </section>
  );
}
