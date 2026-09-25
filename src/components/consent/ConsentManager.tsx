"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import {
  CONSENT_OPEN_EVENT,
  readConsent,
  saveConsent,
  sendConsentEvent,
} from "@/lib/analytics/client";
import { ESSENTIAL_ONLY, type ConsentAction, type ConsentChoice } from "@/lib/consent";

/**
 * First-visit cookie consent (Command Center, phase 1).
 *
 * - Nothing non-essential runs before a decision: GTM is not loaded, the
 *   first-party analytics sender drops events, Consent Mode defaults to denied.
 * - Reject and Accept are equal buttons, side by side ("Reject non-essential" /
 *   "Accept all" in the preferences dialog, where there is room for the full labels).
 * - Mobile: bottom sheet. Desktop: a compact floating panel. Neither blocks
 *   the page; only "Manage preferences" opens a modal dialog.
 * - Footer "Cookie settings" (CONSENT_OPEN_EVENT) reopens the preferences.
 */
export function ConsentManager() {
  const [banner, setBanner] = useState(false);
  const [prefsOpen, setPrefsOpen] = useState(false);
  const [draft, setDraft] = useState<ConsentChoice>(ESSENTIAL_ONLY);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const prefsTitleId = useId();

  useEffect(() => {
    const saved = readConsent();
    // Shown after first paint, so the banner never competes with the hero for LCP.
    const frame = saved
      ? 0
      : requestAnimationFrame(() => {
          setBanner(true);
          sendConsentEvent("banner_view");
          window.dataLayer?.push({ event: "cookie_banner_view" });
        });
    const open = () => {
      setDraft(readConsent() ?? ESSENTIAL_ONLY);
      setPrefsOpen(true);
    };
    window.addEventListener(CONSENT_OPEN_EVENT, open);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener(CONSENT_OPEN_EVENT, open);
    };
  }, []);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (prefsOpen && !dialog.open) dialog.showModal();
    if (!prefsOpen && dialog.open) dialog.close();
  }, [prefsOpen]);

  const decide = useCallback((choice: ConsentChoice, action: ConsentAction) => {
    saveConsent(choice, action);
    setBanner(false);
    setPrefsOpen(false);
  }, []);

  const acceptAll = () => decide({ analytics: true, marketing: true }, "accept_all");
  const rejectAll = () => decide(ESSENTIAL_ONLY, "reject_nonessential");

  return (
    <>
      {banner && !prefsOpen ? (
        <section
          role="region"
          aria-labelledby={titleId}
          data-consent-banner
          // Mobile: a short sheet that sits directly above the sticky booking bar when that bar is
          // showing (it hides while typing and at the final CTA), so Book a Pickup stays tappable.
          // Desktop: a compact floating panel. Neither blocks the page.
          className="fixed inset-x-0 bottom-0 z-[45] border-t border-line bg-white px-4 pb-[calc(8px+env(safe-area-inset-bottom))] pt-3.5 shadow-[0_-8px_24px_rgba(0,49,83,0.10)] min-[360px]:px-5 max-md:[html:has([data-mobile-bar].visible)_&]:bottom-[calc(4rem+env(safe-area-inset-bottom))] max-md:[html:has([data-mobile-bar].visible)_&]:pb-2 md:inset-x-auto md:bottom-6 md:left-6 md:w-[400px] md:rounded-lg md:border md:px-5 md:pb-3 md:pt-5 md:shadow-[0_12px_32px_rgba(0,49,83,0.14)]"
        >
          <h2 id={titleId} className="sr-only md:not-sr-only md:mb-1.5 md:text-[16px] md:font-semibold md:leading-snug md:text-navy">
            Cookies on the Velto website
          </h2>
          <p className="t-small text-body">
            <span className="font-semibold text-navy md:hidden">Cookies. </span>
            Essential cookies keep the site working. With your OK, Velto also measures visits and ads.
          </p>
          <div className="mt-2.5 grid grid-cols-2 gap-2 md:mt-4 md:gap-3">
            {/* Equal weight: rejecting is as easy as accepting. */}
            <ConsentButton compact onClick={rejectAll}>Reject</ConsentButton>
            <ConsentButton compact onClick={acceptAll}>Accept</ConsentButton>
          </div>
          <div className="mt-0.5 flex items-center justify-between gap-4 md:mt-1.5">
            <button
              type="button"
              onClick={() => {
                setDraft(readConsent() ?? ESSENTIAL_ONLY);
                setPrefsOpen(true);
              }}
              className="inline-flex min-h-10 items-center t-small font-semibold text-navy underline underline-offset-4 hover:text-action"
            >
              Manage preferences
            </button>
            <Link href="/cookies" className="inline-flex min-h-10 items-center t-small text-secondary underline underline-offset-4 hover:text-navy">
              Cookie policy
            </Link>
          </div>
        </section>
      ) : null}

      <dialog
        ref={dialogRef}
        aria-labelledby={prefsTitleId}
        onClose={() => setPrefsOpen(false)}
        className="m-0 mt-auto max-h-[92dvh] w-full max-w-none overflow-y-auto border-t border-line bg-white p-0 text-body backdrop:bg-navy/40 md:m-auto md:max-w-[560px] md:rounded-lg md:border"
      >
        <div className="px-5 pb-[calc(20px+env(safe-area-inset-bottom))] pt-6 md:p-8">
          <div className="flex items-start justify-between gap-4">
            <h2 id={prefsTitleId} className="t-h3 text-navy">
              Cookie preferences
            </h2>
            <button
              type="button"
              onClick={() => setPrefsOpen(false)}
              className="-mr-2 -mt-1 inline-flex size-11 shrink-0 items-center justify-center rounded-md text-secondary hover:bg-soft hover:text-navy"
              aria-label="Close cookie preferences"
            >
              <svg viewBox="0 0 20 20" aria-hidden="true" className="size-5">
                <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </button>
          </div>
          <p className="mt-2 t-small text-secondary">
            Choose what the website may use. Essential cookies can&apos;t be switched off because the site needs them.
          </p>

          <ul className="mt-6 divide-y divide-line border-y border-line">
            <PreferenceRow
              title="Essential"
              body="Security, the booking and quote forms, and remembering this choice. Always on."
              locked
            />
            <PreferenceRow
              title="Analytics"
              body="Google Analytics and Velto's own anonymous website measurement: which pages and services are viewed, price searches and where visitors leave. No names, phone numbers or form answers."
              checked={draft.analytics}
              onChange={(analytics) => setDraft((d) => ({ ...d, analytics }))}
            />
            <PreferenceRow
              title="Marketing"
              body="Meta Pixel and advertising measurement, so Velto can see which Facebook and Instagram ads lead to bookings and show relevant ads."
              checked={draft.marketing}
              onChange={(marketing) => setDraft((d) => ({ ...d, marketing }))}
            />
          </ul>

          <div className="mt-6 grid gap-3 md:grid-cols-3">
            <ConsentButton onClick={rejectAll}>Reject non-essential</ConsentButton>
            <ConsentButton onClick={acceptAll}>Accept all</ConsentButton>
            <ConsentButton strong onClick={() => decide(draft, "preferences_saved")}>
              Save choices
            </ConsentButton>
          </div>
          <p className="mt-4 t-caption text-secondary">
            Read the{" "}
            <Link href="/cookies" className="font-medium text-navy underline underline-offset-4" onClick={() => setPrefsOpen(false)}>
              cookie policy
            </Link>{" "}
            for the full list.
          </p>
        </div>
      </dialog>
    </>
  );
}

function ConsentButton({
  children,
  onClick,
  strong = false,
  compact = false,
}: {
  children: React.ReactNode;
  onClick: () => void;
  strong?: boolean;
  /** 44px on the first banner (still a comfortable target); 48px in the preferences dialog. */
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex ${compact ? "h-11" : "h-12"} items-center justify-center rounded-md px-4 text-[15px] font-semibold leading-tight transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan ${
        strong
          ? "bg-action text-white hover:bg-action-hover active:bg-action-active"
          : "border border-navy bg-white text-navy hover:bg-soft active:bg-line"
      }`}
    >
      {children}
    </button>
  );
}

function PreferenceRow({
  title,
  body,
  locked = false,
  checked = true,
  onChange,
}: {
  title: string;
  body: string;
  locked?: boolean;
  checked?: boolean;
  onChange?: (value: boolean) => void;
}) {
  const id = useId();
  return (
    <li className="flex items-start gap-5 py-4">
      <div className="min-w-0 flex-1">
        <label htmlFor={id} className="block text-[16px] font-semibold text-navy">
          {title}
        </label>
        <p id={`${id}-d`} className="mt-1 t-small text-secondary">
          {body}
        </p>
      </div>
      {locked ? (
        <span className="mt-0.5 shrink-0 t-caption font-semibold uppercase tracking-wide text-secondary">Always on</span>
      ) : (
        <span className="relative mt-0.5 inline-flex shrink-0">
          <input
            id={id}
            type="checkbox"
            role="switch"
            aria-describedby={`${id}-d`}
            checked={checked}
            onChange={(e) => onChange?.(e.target.checked)}
            className="peer h-7 w-12 cursor-pointer appearance-none rounded-full border border-line-strong bg-soft transition-colors checked:border-action checked:bg-action focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan"
          />
          <span
            aria-hidden="true"
            className="pointer-events-none absolute left-1 top-1 size-5 rounded-full bg-white shadow-[0_1px_2px_rgba(0,0,0,0.25)] transition-transform peer-checked:translate-x-5"
          />
        </span>
      )}
    </li>
  );
}
