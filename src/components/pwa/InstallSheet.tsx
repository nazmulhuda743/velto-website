"use client";

import { useEffect, useRef, useState } from "react";
import { track } from "@/components/layout/Analytics";
import type { FormText } from "@/content/i18n/forms/en";
import { INSTALL_DISMISSED_KEY, installCardState, parseDismissedAt, type InstallCardState } from "@/lib/pwa/install-card";
import { deviceInfo, isStandalone, knownInstalled } from "@/lib/pwa/install-detect";
import { takeInstallPrompt, useHasInstallPrompt } from "@/lib/pwa/install-prompt";
import { ShareGlyph } from "./ShareGlyph";

type Text = FormText["common"]["install"];
type Kind = Exclude<InstallCardState, "hidden">;

/** Set by NotifyCard (after-booking variant) once its sheet is answered or won't show. */
export const NOTIFY_DONE_EVENT = "velto:notify-done";

declare global {
  interface Window {
    __veltoNotifyDone?: boolean;
  }
}

/**
 * "Install Velto": offered once, right after a booking made on the website, only to customers who
 * don't have the app yet.
 * - Android with Chrome's prompt: one button, one tap, done.
 * - iPhone Safari: Apple gives websites no install button, so the popup points at Share → Add to
 *   Home Screen in one line.
 * - Nothing at all: inside the app, when the app is known to be installed (this phone opened it,
 *   Chrome reports it, or the customer's account has opened it on any phone: `appInstalled`), in
 *   Facebook / Instagram / WhatsApp browsers (nothing can be installed there), on Android without a
 *   prompt, on desktops, and for 14 days after "Not now".
 * After a booking (`when="after-notify"`) it waits for the notification sheet so the two never stack.
 */
export function InstallSheet({
  t,
  placement,
  when = "now",
  delayMs = 1200,
  appInstalled = false,
}: {
  t: Text;
  placement: "booking_success" | "rebook";
  when?: "now" | "after-notify";
  delayMs?: number;
  appInstalled?: boolean;
}) {
  const hasPrompt = useHasInstallPrompt();
  const [kind, setKind] = useState<Kind | null>(null);
  const [added, setAdded] = useState(false);
  const ref = useRef<HTMLDialogElement>(null);
  const opened = useRef(false);
  const outcome = useRef<string | null>(null);

  useEffect(() => {
    if (opened.current || appInstalled) return;
    let timer: number | undefined;
    let cancelled = false;
    const go = () => {
      if (opened.current) return;
      timer = window.setTimeout(async () => {
        if (cancelled || opened.current || isStandalone()) return;
        const installed = await knownInstalled();
        let dismissedAt: number | null = null;
        try {
          dismissedAt = parseDismissedAt(localStorage.getItem(INSTALL_DISMISSED_KEY));
        } catch {
          /* storage unavailable: ask */
        }
        const { isIOS, inApp } = deviceInfo();
        const k = installCardState({ standalone: false, installed, inApp, isIOS, hasPrompt, dismissedAt, now: Date.now() });
        if (k === "hidden" || cancelled || opened.current) return;
        opened.current = true;
        setKind(k);
      }, delayMs);
    };
    if (when === "now" || window.__veltoNotifyDone) go();
    else window.addEventListener(NOTIFY_DONE_EVENT, go, { once: true });
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      window.removeEventListener(NOTIFY_DONE_EVENT, go);
    };
  }, [hasPrompt, when, delayMs, appInstalled]);

  useEffect(() => {
    const dialog = ref.current;
    if (!kind || !dialog || dialog.open) return;
    dialog.showModal();
    track(kind === "ios" ? "install_ios_shown" : "install_prompt_shown", { placement });
  }, [kind, placement]);

  if (!kind) return null;

  const snooze = () => {
    try {
      localStorage.setItem(INSTALL_DISMISSED_KEY, String(Date.now()));
    } catch {
      /* storage unavailable */
    }
  };

  const close = (how: "not_now" | "close" | null) => {
    if (how && !outcome.current) {
      outcome.current = how;
      snooze();
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
      } else {
        snooze();
        close(null);
      }
    } catch {
      close(null);
    }
  };

  return (
    <dialog
      ref={ref}
      data-install-sheet={added ? "added" : kind}
      aria-labelledby="install-sheet-title"
      onCancel={() => {
        if (!outcome.current) {
          outcome.current = "close";
          snooze();
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
        <div className="flex items-center gap-3.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icons/icon-192.png" alt="" width={52} height={52} className="size-[52px] rounded-[13px] shadow-sm" />
          <h2 id="install-sheet-title" className="pr-8 text-[21px] font-semibold leading-tight text-navy">
            {t.title}
          </h2>
        </div>
        {added ? (
          <p role="status" className="mt-4 font-semibold text-success" data-install-added>
            {t.added}
          </p>
        ) : (
          <>
            <p className="mt-3 text-body">{t.body}</p>
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
            {kind === "ios" ? (
              <>
                <p className="mt-5 flex items-center gap-2 rounded-md bg-soft px-4 py-3 text-[15px] font-semibold text-navy" data-install-ios>
                  <ShareGlyph className="size-5 shrink-0 text-action" />
                  {t.iosLine}
                </p>
                <button type="button" onClick={() => close("not_now")} className="mt-4 inline-flex min-h-[52px] w-full items-center justify-center rounded-md bg-action px-6 font-semibold text-white hover:bg-action-hover">
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
