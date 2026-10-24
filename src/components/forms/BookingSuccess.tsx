"use client";

import type { Ref } from "react";
import { NotifyCard } from "@/components/notify/NotifyCard";
import { InstallSheet } from "@/components/pwa/InstallSheet";
import { ButtonLink } from "@/components/ui/Button";
import { WhatsAppIcon } from "@/components/ui/icons";
import type { NotifyText } from "@/content/i18n/notify";
import { customerRoutes, type AppBase } from "@/lib/app-routes";
import { fill, format, localDigits, type Locale } from "@/lib/i18n/config";
import {
  areaText,
  displayPhone,
  estimateLabel,
  estimateOf,
  niceDate,
  pageWords,
  pickupLabel,
  uploadedPhotos,
  whatLabel,
  whatsappHref,
  type Common,
  type FormState,
  type Text,
} from "./booking-form-model";
import { useNightDhaka } from "./useNight";

/** The success tick: a circle and check that draw once (static with reduced motion). */
function SuccessMark() {
  return (
    <svg viewBox="0 0 48 48" width="48" height="48" aria-hidden="true" className="mb-5 text-success" data-success-mark>
      <circle cx="24" cy="24" r="22" fill="none" stroke="currentColor" strokeWidth="2.5" pathLength={1} data-mark-ring />
      <path d="M14.5 24.5l6.5 6.5 13-13.5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" pathLength={1} data-mark-check />
    </svg>
  );
}

export function WhatsAppFallback({
  href,
  placement,
  label,
  opens,
  className = "",
}: {
  href: string;
  placement: string;
  label: string;
  /** " (opens WhatsApp)" in the page language. */
  opens: string;
  className?: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      data-analytics="whatsapp_click"
      data-placement={placement}
      className={`inline-flex h-12 items-center justify-center gap-2.5 whitespace-nowrap rounded-md border border-line-strong bg-white px-5 font-semibold text-navy hover:border-navy ${className}`}
    >
      <WhatsAppIcon className="size-5 text-whatsapp" />
      {label}
      <span className="sr-only">{opens}</span>
    </a>
  );
}

/* ---------- success: integration-ready, never shows an invented reference ---------- */

export function BookingSuccess({
  headingRef,
  state,
  reference,
  t,
  c,
  locale,
  chargeMinor,
  notify,
  signedIn,
  appInstalled,
  base,
}: {
  headingRef: Ref<HTMLHeadingElement>;
  state: FormState;
  reference?: string;
  t: Text;
  c: Common;
  locale: Locale;
  chargeMinor: number | null;
  notify?: NotifyText;
  signedIn: boolean;
  appInstalled: boolean;
  base: AppBase;
}) {
  const words = pageWords(t, c, locale);
  const when = pickupLabel(state, words, t.slots);
  const night = useNightDhaka();
  const photos = uploadedPhotos(state).length;
  const firstName = state.name.trim().split(/\s+/)[0];
  const estimate = estimateLabel(estimateOf(state, chargeMinor), locale);
  const rows = [
    { label: state.items.length ? t.rowItems : state.what.trim() ? t.rowWhat : t.rowService, value: whatLabel(state, t, locale) || t.notSpecified },
    ...(estimate ? [{ label: t.rowEstimate, value: estimate }] : []),
    { label: t.rowPickupFrom, value: `${state.address.trim()}, ${areaText(state.sector, t, locale)}` },
    { label: state.pickup?.booked ? t.rowPickupWindow : t.rowPreferredTime, value: when },
    ...(photos ? [{ label: t.rowPhotos, value: fill(t.photosAdded, { n: photos }, locale) }] : []),
    ...(state.backBy ? [{ label: t.rowBackBy, value: niceDate(state.backBy, words) }] : []),
    // Phone numbers keep their digits.
    { label: t.rowContact, value: displayPhone(state.phone) },
  ];

  return (
    <div data-booking-success>
      <SuccessMark />
      <h1 id="page-title" ref={headingRef} tabIndex={-1} className="scroll-mt-32 t-h1 text-navy focus:outline-none">
        {state.pickup?.booked ? t.successTitleBooked : t.successTitle}
      </h1>
      <p className="mt-3 t-body text-body md:mt-4 md:t-body-lg">{state.pickup?.booked ? format(t.successBodyBooked, { name: firstName, when }) : format(night ? t.successBodyNight : t.successBody, { name: firstName })}</p>

      <dl className="mt-7 border-t border-navy">
        {rows.map((r) => (
          <div key={r.label} className="grid grid-cols-[7.5rem_1fr] gap-4 border-b border-line py-3.5 md:grid-cols-[10rem_1fr]">
            <dt className="t-small font-semibold text-navy">{r.label}</dt>
            <dd className="min-w-0 break-words t-small text-body">{r.value}</dd>
          </div>
        ))}
        {reference ? (
          <div className="grid grid-cols-[7.5rem_1fr] gap-4 border-b border-line py-3.5 md:grid-cols-[10rem_1fr]">
            <dt className="t-small font-semibold text-navy">{t.rowReference}</dt>
            <dd className="t-small text-body">
              <span className="font-semibold text-navy">{reference}</span>
              <span className="mt-0.5 block text-secondary">{t.referenceNote}</span>
            </dd>
          </div>
        ) : null}
      </dl>

      <h2 className="mt-8 t-label uppercase text-navy">{t.nextTitle}</h2>
      <ol className="mt-3 space-y-2.5 text-body">
        {(state.pickup?.booked ? t.nextStepsBooked : t.nextSteps).map((step, i) => (
          <li key={step} className="flex gap-3">
            <span className="t-label pt-[4px] text-action">{localDigits(String(i + 1).padStart(2, "0"), locale)}</span>
            {step}
          </li>
        ))}
      </ol>

      {/* "Install Velto", only for customers without the app: after the notification sheet when signed in
          (it waits for it), straight away for guests. Inside the app it never shows. */}
      <InstallSheet t={c.install} placement="booking_success" when={notify && signedIn ? "after-notify" : "now"} appInstalled={appInstalled} />

      {notify ? (
        <div className="mt-8" data-booking-notify>
          {signedIn ? (
            <NotifyCard t={notify} lang={locale === "bn" ? "bn" : "en"} variant="after" orderRef={reference} />
          ) : (
            <div className="rounded-lg border border-line bg-white p-4">
              <p className="font-semibold text-navy">{notify.afterBookTitle}</p>
              <p className="mt-1 t-small text-body">{notify.guestBody}</p>
              <ButtonLink href={base === "/app" ? `/app/login?next=${encodeURIComponent("/app/home")}` : "/login?next=/account"} variant="secondary" className="mt-3 !h-11 !px-5">
                {notify.guestButton}
              </ButtonLink>
            </div>
          )}
        </div>
      ) : null}

      <div className="mt-8 flex flex-col gap-3 border-t border-line pt-6 md:flex-row md:flex-wrap md:items-center">
        <WhatsAppFallback
          href={whatsappHref(state, t, c, locale, chargeMinor)}
          placement="booking_success"
          label={t.changeOnWhatsApp}
          opens={c.opensWhatsApp}
        />
        <ButtonLink href={base === "/app" ? customerRoutes(base).home : "/"} variant="secondary">
          {base === "/app" ? c.backAppHome : c.backHome}
        </ButtonLink>
      </div>
    </div>
  );
}
