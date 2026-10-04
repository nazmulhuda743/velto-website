"use client";

import { useEffect, useRef, useState } from "react";
import { track } from "@/components/layout/Analytics";
import type { FormText } from "@/content/i18n/forms/en";
import { INSTALL_DISMISSED_KEY, installCardState, isIOSDevice, parseDismissedAt } from "@/lib/pwa/install-card";
import { takeInstallPrompt, useHasInstallPrompt } from "@/lib/pwa/install-prompt";

type Text = FormText["common"]["install"];
type Kind = "android" | "ios" | "android-steps";

/** Set by NotifyCard (after-booking variant) once its sheet is answered or won't show. */
export const NOTIFY_DONE_EVENT = "velto:notify-done";

declare global {
  interface Window {
    __veltoNotifyDone?: boolean;
  }
}

const standalone = () => window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;

/** What this phone gets, or null for nothing (installed already, snoozed, or no way to install). */
function kindFor(hasPrompt: boolean, force: boolean): Kind | null {
  let dismissedAt: number | null = null;
  try {
    dismissedAt = parseDismissedAt(localStorage.getItem(INSTALL_DISMISSED_KEY));
  } catch {
    /* storage unavailable: ask */
  }
  const isIOS = isIOSDevice(navigator.userAgent, navigator.maxTouchPoints ?? 0);
  const s = installCardState({ standalone: standalone(), isIOS, hasPrompt, dismissedAt: force ? null : dismissedAt, now: Date.now() });
  if (s !== "hidden") return s;
  // From the /app link: a phone without Chrome's prompt still gets the menu steps.
  if (force && !standalone() && /Android/.test(navigator.userAgent)) return "android-steps";
  return null;
}

/**
 * "Install Velto": the installed website (PWA) offered as a popup, only once the customer has booked
 * or opened their account. Android/Chrome gets the browser's one-tap prompt; iPhone gets the Share →
 * Add to Home Screen steps. Never inside the installed app; "Not now" holds for 14 days (`force`, from
 * velto.com.bd/app, ignores it).
 * After a booking (`when="after-notify"`) it waits for the notification sheet: iPhone (where that sheet
 * can't show before installing) sees this straight away, Android sees notifications first, then this.
 */
export function InstallSheet({
  t,
  placement,
  when = "now",
  force = false,
  delayMs = 1500,
}: {
  t: Text;
  placement: "booking_success" | "rebook" | "account_home" | "app_link";
  when?: "now" | "after-notify";
  force?: boolean;
  delayMs?: number;
}) {
  const hasPrompt = useHasInstallPrompt();
  const [kind, setKind] = useState<Kind | null>(null);
  const [added, setAdded] = useState(false);
  const ref = useRef<HTMLDialogElement>(null);
  const opened = useRef(false);
  const outcome = useRef<string | null>(null);

  // Decide once, after the right moment: a short delay, or once the notification sheet is done.
  useEffect(() => {
    if (opened.current) return;
    let timer: number | undefined;
    const go = () => {
      if (opened.current) return;
      timer = window.setTimeout(() => {
        const k = kindFor(hasPrompt, force);
        if (!k || opened.current) return;
        opened.current = true;
        setKind(k);
      }, delayMs);
    };
    if (when === "now" || window.__veltoNotifyDone) go();
    else window.addEventListener(NOTIFY_DONE_EVENT, go, { once: true });
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener(NOTIFY_DONE_EVENT, go);
    };
  }, [hasPrompt, force, when, delayMs]);

  useEffect(() => {
    const dialog = ref.current;
    if (!kind || !dialog || dialog.open) return;
    dialog.showModal();
    track(kind === "ios" ? "install_ios_shown" : "install_prompt_shown", { placement });
  }, [kind, placement]);

  if (!kind) return null;

  const close = (how: "not_now" | "close" | null) => {
    if (how && !outcome.current) {
      outcome.current = how;
      try {
        localStorage.setItem(INSTALL_DISMISSED_KEY, String(Date.now()));
      } catch {
        /* storage unavailable */
      }
      track("install_dismissed", { placement, detail: how });
    }
    ref.current?.close();
  };

  const install = async () => {
    const prompt = takeInstallPrompt();
    if (!prompt) return close("close");
    try {
      await prompt.prompt();
      const { outcome: choice } = await prompt.userChoice;
      outcome.current = choice;
      track(choice === "accepted" ? "install_accepted" : "install_dismissed", { placement, detail: "prompt" });
      if (choice === "accepted") {
        setAdded(true);
        window.setTimeout(() => ref.current?.close(), 1800);
      } else close(null);
    } catch {
      close(null);
    }
  };

  const steps = kind === "ios" ? t.iosSteps : kind === "android-steps" ? t.androidSteps : null;

  return (
    <dialog
      ref={ref}
      data-install-sheet={added ? "added" : kind}
      aria-labelledby="install-sheet-title"
      onCancel={() => {
        if (!outcome.current) {
          outcome.current = "close";
          try {
            localStorage.setItem(INSTALL_DISMISSED_KEY, String(Date.now()));
          } catch {
            /* storage unavailable */
          }
          track("install_dismissed", { placement, detail: "close" });
        }
      }}
      onClose={() => setKind(null)}
      onClick={(e) => {
        if (e.target === e.currentTarget) close("close");
      }}
      className="mb-0 mt-auto max-h-[calc(100dvh-24px)] w-full max-w-none overflow-y-auto border-0 bg-transparent p-0 text-body backdrop:bg-navy/65 backdrop:backdrop-blur-[2px] sm:m-auto sm:w-[calc(100%-32px)] sm:max-w-[420px]"
    >
      <div tabIndex={-1} autoFocus className="relative rounded-t-[20px] bg-white px-5 pb-[calc(20px+env(safe-area-inset-bottom))] pt-6 shadow-[0_24px_64px_rgba(0,34,61,0.35)] focus:outline-none sm:rounded-lg sm:p-6">
        <button
          type="button"
          onClick={() => close("close")}
          aria-label={t.close}
          className="absolute right-3 top-3 inline-flex size-10 items-center justify-center rounded-full text-navy hover:bg-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-action"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icons/icon-192.png" alt="" width={56} height={56} className="size-14 rounded-[14px] shadow-sm" />
        <h2 id="install-sheet-title" className="mt-4 text-[22px] font-semibold leading-tight text-navy">
          {t.title}
        </h2>
        {added ? (
          <p role="status" className="mt-2 font-semibold text-success" data-install-added>
            ✓ {t.added}
          </p>
        ) : (
          <>
            <p className="mt-1.5 text-body">{t.body}</p>
            <ul className="mt-4 space-y-2.5">
              {t.points.map((p) => (
                <li key={p} className="flex items-start gap-2.5 text-[15px] text-navy">
                  <svg viewBox="0 0 24 24" aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-action" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12.5l4.5 4.5L19 7.5" />
                  </svg>
                  {p}
                </li>
              ))}
            </ul>
            {steps ? (
              <>
                <ol className="mt-5 list-decimal space-y-1.5 rounded-md bg-soft py-3 pl-9 pr-4 t-small text-navy" data-install-steps={kind}>
                  {steps.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ol>
                {kind === "ios" ? <p className="mt-2 t-small text-secondary">{t.iosAfter}</p> : null}
                <button type="button" onClick={() => close("not_now")} className="mt-5 inline-flex min-h-[52px] w-full items-center justify-center rounded-md bg-action px-6 font-semibold text-white hover:bg-action-hover">
                  {t.gotIt}
                </button>
              </>
            ) : (
              <>
                <button type="button" onClick={install} className="mt-5 inline-flex min-h-[52px] w-full items-center justify-center rounded-md bg-action px-6 font-semibold text-white hover:bg-action-hover" data-install-button>
                  {t.button}
                </button>
                <button type="button" onClick={() => close("not_now")} className="mt-1 inline-flex min-h-11 w-full items-center justify-center px-3 t-small font-semibold text-secondary hover:text-navy">
                  {t.notNow}
                </button>
              </>
            )}
          </>
        )}
      </div>
    </dialog>
  );
}
