"use client";

import { useEffect, useState, type ReactNode } from "react";
import { track } from "@/components/layout/Analytics";
import type { NotifyText } from "@/content/i18n/notify";
import { currentSubscription, permission, pushSupport, subscribe, unsubscribe } from "@/lib/push/client";

type View = "loading" | "hidden" | "offer" | "on" | "denied" | "ios" | "unsupported";
type Prefs = { orderUpdates: boolean; reminders: boolean };

const SNOOZE = "velto_notify_snooze";
const SNOOZE_DAYS = 14;
/** After a booking, "Not now" holds for that order only: the next order offers it again. */
const NOT_NOW = "velto_notify_not_now";

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

const declinedFor = (key: string | undefined) => {
  if (!key) return false;
  try {
    return localStorage.getItem(NOT_NOW) === key;
  } catch {
    return false;
  }
};

function Tick() {
  return (
    <span aria-hidden="true" className="mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-success-soft text-success">
      <svg viewBox="0 0 20 20" className="size-3.5">
        <path d="M4.5 10.5l3.5 3.5 7.5-8" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

/** One setting with its switch (Profile → Notifications). The whole row toggles it. */
function SwitchRow({ icon, tone, title, hint, checked, onChange }: { icon: ReactNode; tone: string; title: string; hint: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex min-h-16 cursor-pointer items-center gap-3 py-3.5">
      <span aria-hidden="true" className={`inline-flex size-10 shrink-0 items-center justify-center rounded-[11px] ${tone}`}>
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[15.5px] font-semibold text-navy">{title}</span>
        <span className="block t-small text-secondary">{hint}</span>
      </span>
      <input type="checkbox" role="switch" className="peer sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span
        aria-hidden="true"
        className="relative h-7 w-[46px] shrink-0 rounded-full bg-[#c9d2d9] transition-colors after:absolute after:left-[3px] after:top-[3px] after:size-[22px] after:rounded-full after:bg-white after:shadow after:transition-[left] peer-checked:bg-action peer-checked:after:left-[21px] peer-focus-visible:ring-2 peer-focus-visible:ring-action peer-focus-visible:ring-offset-2"
      />
    </label>
  );
}

/**
 * "Get updates on your phone". The value comes first (what Velto will tell them); the phone's own
 * prompt only appears after "Turn on". Account variant: the offer only (nothing once on, so the
 * account home stays about orders). Settings variant (Profile): on/off and what to receive.
 * After-booking variant (booking success and the one-tap reminder page): the pre-permission sheet,
 * what Velto will send and "Turn on" / "Not now"; "Not now" holds until the next order (`orderRef`).
 * `demo` fixes the state for design review (local QA pages only).
 */
export function NotifyCard({
  t,
  lang,
  variant = "account",
  code,
  orderRef,
  initialPrefs,
  demo,
}: {
  t: NotifyText;
  lang: "bn" | "en";
  variant?: "account" | "after" | "settings";
  code?: string;
  /** The booking this sheet follows (after variant): "Not now" is remembered for it only. */
  orderRef?: string;
  initialPrefs?: Prefs;
  demo?: View;
}) {
  const [view, setView] = useState<View>(demo ?? "loading");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [prefs, setPrefs] = useState<Prefs>(initialPrefs ?? { orderUpdates: true, reminders: true });
  const declineKey = orderRef ?? code;

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
                : (variant === "account" && snoozed()) || (variant === "after" && declinedFor(declineKey)) ? "hidden" : "offer";
      if (live) setView(next);
    })();
    return () => {
      live = false;
    };
  }, [demo, variant, declineKey]);

  async function turnOn() {
    if (busy) return;
    setBusy(true);
    setNote(null);
    track("notify_prompt", { placement: variant });
    const r = await subscribe(lang, code);
    setBusy(false);
    if (r.ok) {
      track("notify_on", { placement: variant });
      if (r.welcomed) setNote(t.welcomeSent);
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
      if (variant === "after") localStorage.setItem(NOT_NOW, declineKey ?? "");
      else localStorage.setItem(SNOOZE, String(Date.now()));
    } catch {
      /* storage unavailable: it may show again next visit */
    }
    setView("hidden");
  }

  async function savePrefs(next: Prefs) {
    setPrefs(next);
    await fetch("/api/push/manage", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "prefs", ...next }) }).catch(() => null);
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
    // The pre-permission sheet (inline): what changes their plans, then the phone's own prompt
    // only after "Turn on notifications". No offers here.
    return (
      <section aria-labelledby="notify-sheet-title" className="rounded-lg border border-[#b9dcf2] bg-white p-5" data-notify="offer">
        <Bell />
        <h2 id="notify-sheet-title" className="mt-3 text-[20px] font-semibold leading-tight text-navy">
          {t.sheetTitle}
        </h2>
        <p className="mt-1.5 t-small text-body">{t.sheetBody}</p>
        <ul className="mt-4 space-y-2.5">
          {t.sheetPoints.map((p) => (
            <li key={p} className="flex items-start gap-2.5 text-[15px] text-navy">
              <Tick />
              {p}
            </li>
          ))}
        </ul>
        <button type="button" onClick={turnOn} disabled={busy} data-analytics="notify_click" className="mt-5 inline-flex min-h-[52px] w-full items-center justify-center rounded-md bg-action px-6 font-semibold text-white hover:bg-action-hover disabled:opacity-60">
          {busy ? t.turning : t.turnOn}
        </button>
        <button type="button" onClick={later} className="mt-1 inline-flex min-h-11 w-full items-center justify-center px-3 t-small font-semibold text-secondary hover:text-navy">
          {t.notNow}
        </button>
        {note ? <p role="alert" className="mt-1 t-small text-error">{note}</p> : null}
      </section>
    );
  }

  if (variant === "settings") {
    // Profile → Notifications (owner-approved "Version A"): a heading with On/Off, then switches.
    const on = view === "on";
    const svg = "size-[21px]";
    return (
      <div data-notify={view}>
        <div className="flex items-center justify-between gap-3">
          <h2 id="notify-settings-title" className="t-h3 text-navy">
            {t.settingsTitle}
          </h2>
          <span className={`rounded-full px-2.5 py-1 text-[12.5px] font-semibold ${on ? "bg-success-soft text-success" : "bg-[#eef1f3] text-secondary"}`}>
            {on ? `● ${t.stateOn}` : t.stateOff}
          </span>
        </div>
        {on ? (
          <>
            <p className="mt-1 text-body">{t.settingsOn}</p>
            <div className="mt-2 divide-y divide-line">
              <SwitchRow
                tone="bg-[#e9f4fb] text-action"
                icon={<svg viewBox="0 0 24 24" className={svg} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 7H4l1.5 12h13z" /><path d="M9 7a3 3 0 0 1 6 0" /></svg>}
                title={t.orderUpdatesTitle}
                hint={t.orderUpdatesHint}
                checked={prefs.orderUpdates}
                onChange={(v) => savePrefs({ ...prefs, orderUpdates: v })}
              />
              <SwitchRow
                tone="bg-success-soft text-success"
                icon={<svg viewBox="0 0 24 24" className={svg} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></svg>}
                title={t.remindersTitle}
                hint={t.remindersHint}
                checked={prefs.reminders}
                onChange={(v) => savePrefs({ ...prefs, reminders: v })}
              />
            </div>
            <button type="button" onClick={off} disabled={busy} className="mt-1 min-h-11 t-small font-semibold text-secondary underline underline-offset-4 hover:text-navy">
              {t.turnOff}
            </button>
          </>
        ) : view === "offer" ? (
          <>
            <p className="mt-1 text-body">{t.settingsOff}</p>
            <button type="button" onClick={turnOn} disabled={busy} data-analytics="notify_click" className="mt-4 inline-flex min-h-12 w-full items-center justify-center rounded-md bg-action px-6 font-semibold text-white hover:bg-action-hover disabled:opacity-60">
              {busy ? t.turning : t.turnOn}
            </button>
            <p className="mt-3 t-small text-secondary">{t.settingsPromise}</p>
          </>
        ) : view === "ios" ? (
          <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-body">
            {t.iosSteps.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ol>
        ) : (
          <p className="mt-1 text-body">{view === "denied" ? t.denied : t.unsupported}</p>
        )}
        {note ? <p role="status" className="mt-2 t-small text-secondary">{note}</p> : null}
      </div>
    );
  }

  if (view === "on") {
    // Account home: once on, nothing stays here (settings live in Profile). Right after turning on,
    // one line confirms it and says a notification is on its way.
    return note ? (
      <p role="status" className="rounded-md bg-success-soft px-4 py-3 t-small font-semibold text-success" data-notify="on">
        ✓ {note}
      </p>
    ) : null;
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
