"use client";

import { useEffect, useState } from "react";
import { track } from "@/components/layout/Analytics";
import type { NotifyText } from "@/content/i18n/notify";
import { currentSubscription, permission, pushSupport, subscribe, unsubscribe } from "@/lib/push/client";

type View = "loading" | "hidden" | "offer" | "on" | "denied" | "ios" | "unsupported";
type Prefs = { orderUpdates: boolean; reminders: boolean };

const SNOOZE = "velto_notify_snooze";
const SNOOZE_DAYS = 14;

const snoozed = () => {
  try {
    const at = Number(localStorage.getItem(SNOOZE));
    return Number.isFinite(at) && Date.now() - at < SNOOZE_DAYS * 86_400_000;
  } catch {
    return false;
  }
};

function Bell() {
  return (
    <span aria-hidden="true" className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl bg-[#e8f3fb] text-action">
      <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 8a6 6 0 1 1 12 0c0 7 3 8 3 8H3s3-1 3-8" />
        <path d="M10 20a2 2 0 0 0 4 0" />
      </svg>
    </span>
  );
}

/**
 * "Get updates on your phone". The value comes first (what Velto will tell them); the phone's own
 * prompt only appears after "Turn on". Account variant: the full card with settings once on.
 * After-booking variant (the one-tap reminder page): one short question, tied to the reminder code.
 * `demo` fixes the state for design review (local QA pages only).
 */
export function NotifyCard({
  t,
  lang,
  variant = "account",
  code,
  initialPrefs,
  demo,
}: {
  t: NotifyText;
  lang: "bn" | "en";
  variant?: "account" | "after";
  code?: string;
  initialPrefs?: Prefs;
  demo?: View;
}) {
  const [view, setView] = useState<View>(demo ?? "loading");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [prefs, setPrefs] = useState<Prefs>(initialPrefs ?? { orderUpdates: true, reminders: true });

  useEffect(() => {
    if (demo) return;
    let live = true;
    (async () => {
      const support = pushSupport();
      const next: View =
        support === "ios_install"
          ? variant === "after" ? "hidden" : "ios"
          : support === "unsupported"
            ? variant === "after" ? "hidden" : "unsupported"
            : permission() === "denied"
              ? variant === "after" ? "hidden" : "denied"
              : (await currentSubscription()) && permission() === "granted"
                ? variant === "after" ? "hidden" : "on"
                : variant === "account" && snoozed() ? "hidden" : "offer";
      if (live) setView(next);
    })();
    return () => {
      live = false;
    };
  }, [demo, variant]);

  async function turnOn() {
    if (busy) return;
    setBusy(true);
    setNote(null);
    track("notify_prompt", { placement: variant });
    const r = await subscribe(lang, code);
    setBusy(false);
    if (r.ok) {
      track("notify_on", { placement: variant });
      setView("on");
    } else if (r.reason === "denied") {
      track("notify_denied", { placement: variant });
      setView(variant === "after" ? "hidden" : "denied");
    } else {
      setNote(r.reason === "sign_in" ? t.signIn : r.reason === "unsupported" ? t.unsupported : t.failed);
    }
  }

  function later() {
    try {
      localStorage.setItem(SNOOZE, String(Date.now()));
    } catch {
      /* storage unavailable: it may show again next visit */
    }
    setView("hidden");
  }

  async function savePrefs(next: Prefs) {
    setPrefs(next);
    await fetch("/api/push/manage", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "prefs", ...next }) }).catch(() => null);
  }

  async function test() {
    setNote(null);
    const res = await fetch("/api/push/manage", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "test" }) }).catch(() => null);
    const body = (await res?.json().catch(() => null)) as { ok?: boolean } | null;
    setNote(body?.ok ? t.testSent : t.testFailed);
  }

  async function off() {
    setBusy(true);
    await unsubscribe();
    setBusy(false);
    setNote(t.offDone);
    setView("offer");
  }

  if (view === "loading" || view === "hidden") return null;

  const shell = "rounded-lg border border-line bg-white p-5 md:p-6";

  if (variant === "after") {
    if (view === "on") {
      return (
        <p role="status" className="rounded-md bg-success-soft px-4 py-3 t-small font-semibold text-success" data-notify="on">
          ✓ {t.onTitle}
        </p>
      );
    }
    return (
      <div className="rounded-lg border border-line bg-white p-4" data-notify="offer">
        <div className="flex gap-3">
          <Bell />
          <div className="min-w-0">
            <p className="font-semibold text-navy">{t.afterBookTitle}</p>
            <p className="mt-0.5 t-small text-body">{t.afterBookBody}</p>
          </div>
        </div>
        <button type="button" onClick={turnOn} disabled={busy} className="mt-3 inline-flex min-h-12 w-full items-center justify-center rounded-md bg-action px-5 font-semibold text-white hover:bg-action-hover disabled:opacity-60">
          {busy ? t.turning : t.afterBookButton}
        </button>
        {note ? <p role="alert" className="mt-2 t-small text-error">{note}</p> : null}
      </div>
    );
  }

  if (view === "on") {
    return (
      <section aria-labelledby="notify-title" className={shell} data-notify="on">
        <div className="flex gap-3">
          <Bell />
          <div className="min-w-0">
            <h2 id="notify-title" className="text-[18px] font-semibold text-navy">
              {t.onTitle}
            </h2>
            <p className="mt-0.5 t-small text-body">{t.onBody}</p>
          </div>
        </div>
        <div className="mt-4 space-y-2">
          <label className="flex min-h-11 items-center gap-3 t-small text-navy">
            <input type="checkbox" className="size-5" checked={prefs.orderUpdates} onChange={(e) => savePrefs({ ...prefs, orderUpdates: e.target.checked })} />
            {t.orderUpdates}
          </label>
          <label className="flex min-h-11 items-center gap-3 t-small text-navy">
            <input type="checkbox" className="size-5" checked={prefs.reminders} onChange={(e) => savePrefs({ ...prefs, reminders: e.target.checked })} />
            {t.reminders}
          </label>
        </div>
        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
          <button type="button" onClick={test} className="min-h-11 t-small font-semibold text-action underline underline-offset-4">
            {t.test}
          </button>
          <button type="button" onClick={off} disabled={busy} className="min-h-11 t-small font-semibold text-secondary underline underline-offset-4 hover:text-navy">
            {t.turnOff}
          </button>
        </div>
        {note ? <p role="status" className="mt-1 t-small text-secondary">{note}</p> : null}
      </section>
    );
  }

  return (
    <section aria-labelledby="notify-title" className={`${shell} border-[#b9dcf2]`} data-notify={view}>
      <div className="flex gap-3">
        <Bell />
        <div className="min-w-0">
          <h2 id="notify-title" className="text-[20px] font-semibold leading-tight text-navy">
            {view === "ios" ? t.iosTitle : t.title}
          </h2>
          {view === "offer" ? <p className="mt-1 t-small text-body">{t.intro}</p> : null}
        </div>
      </div>

      {view === "offer" ? (
        <>
          <ul className="mt-4 space-y-2">
            {t.points.map((p) => (
              <li key={p} className="flex items-start gap-2.5 text-[15px] text-navy">
                <span aria-hidden="true" className="mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-success-soft text-success">
                  <svg viewBox="0 0 20 20" className="size-3.5">
                    <path d="M4.5 10.5l3.5 3.5 7.5-8" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
                {p}
              </li>
            ))}
          </ul>
          <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-center">
            <button type="button" onClick={turnOn} disabled={busy} data-analytics="notify_click" className="inline-flex min-h-12 items-center justify-center rounded-md bg-action px-6 font-semibold text-white hover:bg-action-hover disabled:opacity-60">
              {busy ? t.turning : t.turnOn}
            </button>
            <button type="button" onClick={later} className="inline-flex min-h-11 items-center justify-center px-3 t-small font-semibold text-secondary hover:text-navy">
              {t.notNow}
            </button>
          </div>
          <p className="mt-3 t-caption text-secondary">{t.promise}</p>
        </>
      ) : view === "ios" ? (
        <ol className="mt-4 list-decimal space-y-1.5 pl-5 t-small text-navy">
          {t.iosSteps.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ol>
      ) : (
        <p className="mt-3 t-small text-body">{view === "denied" ? t.denied : t.unsupported}</p>
      )}
      {note ? <p role="alert" className="mt-2 t-small text-error">{note}</p> : null}
    </section>
  );
}
