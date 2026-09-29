"use client";

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import Link from "@/components/i18n/Link";
import { track } from "@/components/layout/Analytics";
import { ArrowRight, CloseIcon } from "@/components/ui/icons";
import { popupDue, popupExcluded, type PopupFrequency, type SeenRecord } from "@/lib/promo";

export type PopupView = {
  version: string;
  image: string;
  imageStyle: "poster" | "photo";
  imageAlt: string;
  tag: string;
  title: string;
  body: string;
  cta: string;
  /** "10%" and "OFF": the offer set large at the top; empty for a plain headline popup. */
  offerBig: string;
  offerSmall: string;
  /** Up to three ticked reasons to act. */
  points: string[];
  /** Small print: who qualifies, how the discount is applied. */
  fine: string;
  /** "5.0 on Google · 100+ reviews" from Site settings, or empty. */
  proof: string;
  /** "Ends 30 Oct" when the campaign has an end date, else empty. */
  ends: string;
  href: string;
  frequency: PopupFrequency;
  delaySeconds: number;
  /** Switched on and complete on the server; off means only ?promo=preview shows it. */
  active: boolean;
  /** Campaign window as timestamps (null: open-ended). Checked again in the browser: pages are cached. */
  startsAt: number | null;
  endsAt: number | null;
};

export type PopupLabels = { dialogLabel: string; close: string; notNow: string; posterOpens: string };

const KEY = "velto_promo";

function store(frequency: PopupFrequency): Storage {
  return frequency === "session" ? sessionStorage : localStorage;
}

function readSeen(frequency: PopupFrequency): SeenRecord | null {
  try {
    const raw = store(frequency).getItem(KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as Partial<SeenRecord>;
    return typeof v.version === "string" && typeof v.at === "number" ? { version: v.version, at: v.at } : null;
  } catch {
    return null;
  }
}

function writeSeen(frequency: PopupFrequency, version: string) {
  try {
    store(frequency).setItem(KEY, JSON.stringify({ version, at: Date.now() } satisfies SeenRecord));
  } catch {
    /* storage unavailable: the popup may show again next visit */
  }
}

/**
 * The campaign popup (Promo & popup in the admin): a poster or a headline with one link, shown
 * once per visit/day/week after a short delay, never on booking, sign-in, account or legal
 * pages. Closing it is remembered in the browser (no cookie, no identifier). The whole poster is
 * the link. ?promo=preview shows it at once, for checking a campaign before it goes live.
 */
export function PromoPopup({ popup, labels, logo }: { popup: PopupView; labels: PopupLabels; logo?: React.ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const outcome = useRef<"click" | "dismiss" | null>(null);
  const titleId = useId();

  useEffect(() => {
    if (popupExcluded(pathname)) return;
    const preview = new URLSearchParams(window.location.search).get("promo") === "preview";
    const now = Date.now();
    const inWindow = (popup.startsAt === null || now >= popup.startsAt) && (popup.endsAt === null || now <= popup.endsAt);
    if (!preview && (!popup.active || !inWindow || !popupDue(popup, readSeen(popup.frequency), now))) return;
    const timer = setTimeout(() => setOpen(true), preview ? 0 : popup.delaySeconds * 1000);
    return () => clearTimeout(timer);
  }, [pathname, popup]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog || !open || dialog.open) return;
    dialog.showModal();
    track("promo_view", { placement: "popup", detail: popup.version });
  }, [open, popup.version]);

  const finish = useCallback(
    (how: "click" | "dismiss") => {
      if (outcome.current) return;
      outcome.current = how;
      writeSeen(popup.frequency, popup.version);
      track(how === "click" ? "promo_click" : "promo_dismiss", { placement: "popup", detail: popup.version });
    },
    [popup.frequency, popup.version],
  );

  const close = () => {
    finish("dismiss");
    dialogRef.current?.close();
  };

  if (!open) return null;

  const external = /^https?:\/\//.test(popup.href);
  const linkClass = "block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-action focus-visible:ring-offset-2";
  const link = (content: React.ReactNode, className: string, ariaLabel?: string) =>
    external ? (
      <a href={popup.href} target="_blank" rel="noopener noreferrer" onClick={() => finish("click")} className={className} aria-label={ariaLabel}>
        {content}
      </a>
    ) : (
      <Link href={popup.href} onClick={() => finish("click")} className={className} aria-label={ariaLabel}>
        {content}
      </Link>
    );

  const hasText = Boolean(popup.tag || popup.title || popup.body || popup.cta || popup.offerBig);
  const photo = Boolean(popup.image && popup.imageStyle === "photo" && hasText);
  const poster = Boolean(popup.image && !photo);
  const cta = (
    <span className="inline-flex items-center gap-2">
      {popup.cta || labels.posterOpens}
      <ArrowRight className="size-5 transition-transform group-hover:translate-x-0.5" />
    </span>
  );
  const notNow = (
    <button type="button" onClick={close} className="inline-flex min-h-11 items-center justify-center px-4 t-small font-semibold text-secondary hover:text-navy">
      {labels.notNow}
    </button>
  );
  const tick = (
    <span aria-hidden="true" className="mt-[3px] inline-flex size-4 shrink-0 items-center justify-center rounded-full bg-navy text-white">
      <svg viewBox="0 0 20 20" className="size-2.5">
        <path d="M4.5 10.5l3.5 3.5 7.5-8" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );

  return (
    <dialog
      ref={dialogRef}
      data-promo-popup
      aria-labelledby={popup.title ? titleId : undefined}
      aria-label={popup.title ? undefined : popup.imageAlt || labels.dialogLabel}
      onClose={() => {
        finish("dismiss");
        setOpen(false);
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
      className={`mb-0 mt-auto max-h-[calc(100dvh-24px)] w-full max-w-none overflow-y-auto border-0 bg-transparent p-0 text-body backdrop:bg-navy/65 backdrop:backdrop-blur-[2px] sm:m-auto sm:max-h-[calc(100dvh-32px)] sm:w-[calc(100%-32px)] ${
        photo ? "sm:max-w-[680px]" : "sm:max-w-[440px]"
      }`}
    >
      <div
        data-promo-card
        data-voucher={photo ? "" : undefined}
        tabIndex={-1}
        autoFocus
        className={`relative overflow-hidden rounded-t-[20px] bg-white shadow-[0_24px_64px_rgba(0,34,61,0.35)] focus:outline-none sm:rounded-lg ${photo ? "sm:grid sm:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]" : ""}`}
      >
        <button
          type="button"
          onClick={close}
          aria-label={labels.close}
          className="absolute right-3 top-3 z-10 inline-flex size-10 items-center justify-center rounded-full bg-white/92 text-navy shadow-sm hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-action"
        >
          <CloseIcon className="size-5" />
        </button>

        {photo ? (
          <div className="relative h-[190px] overflow-hidden bg-soft sm:h-auto sm:min-h-full [@media(max-height:720px)]:hidden" data-promo-photo>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={popup.image} alt={popup.imageAlt} className="absolute inset-0 size-full object-cover" decoding="async" />
            {popup.ends ? (
              <p className="absolute left-4 top-4 rounded-full bg-navy px-3 py-1.5 t-caption font-semibold uppercase tracking-[0.08em] text-white" data-promo-ends>
                {popup.ends}
              </p>
            ) : null}
          </div>
        ) : poster ? (
          link(
            // eslint-disable-next-line @next/next/no-img-element
            <img src={popup.image} alt={popup.imageAlt} className="block max-h-[56dvh] w-full bg-soft object-contain" decoding="async" />,
            `${linkClass} bg-soft`,
            popup.title ? undefined : popup.imageAlt || labels.posterOpens,
          )
        ) : null}

        {hasText ? (
          <div className={`px-6 pb-5 pt-6 min-[400px]:px-7 [@media(max-height:720px)]:pb-3 [@media(max-height:720px)]:pt-4 ${photo ? "sm:px-9 sm:pb-7 sm:pt-9" : ""}`}>
            {photo ? (
              <div className="mb-6 flex items-center justify-between gap-4 [@media(max-height:720px)]:mb-4">
                {logo ? <div className="flex h-6 items-center">{logo}</div> : <span />}
                {popup.tag ? <p className="pr-10 t-caption font-semibold uppercase tracking-[0.12em] text-secondary">{popup.tag}</p> : null}
              </div>
            ) : popup.tag ? (
              <p className="t-caption font-semibold uppercase tracking-[0.12em] text-action">{popup.tag}</p>
            ) : null}

            {popup.offerBig ? (
              <p className="flex items-start gap-3 [@media(max-height:720px)]:gap-2" data-promo-offer>
                <span className="text-[80px] font-bold leading-[0.82] tracking-[-0.05em] text-navy min-[400px]:text-[92px] [@media(max-height:720px)]:text-[64px]">{popup.offerBig}</span>
                {popup.offerSmall ? (
                  <span className="max-w-[10ch] self-center font-serif text-[22px] italic leading-[1.1] text-navy min-[400px]:text-[24px]">{popup.offerSmall}</span>
                ) : null}
              </p>
            ) : null}
            {popup.title ? (
              <h2 id={titleId} className={`font-serif text-[21px] font-normal leading-[1.25] text-navy min-[400px]:text-[23px] ${popup.offerBig ? "mt-5 [@media(max-height:720px)]:mt-3" : "mt-2 pr-10"}`}>
                {popup.title}
              </h2>
            ) : null}
            {popup.body ? <p className="mt-2.5 text-[15px] leading-[1.55] text-body">{popup.body}</p> : null}
            {popup.points.length ? (
              <ul className="mt-4 space-y-2 border-t border-dashed border-line-strong pt-4 [@media(max-height:720px)]:mt-3 [@media(max-height:720px)]:space-y-1.5 [@media(max-height:720px)]:pt-3">
                {popup.points.map((point) => (
                  <li key={point} className="flex items-start gap-2.5 text-[14px] font-medium leading-[1.4] text-navy">
                    {tick}
                    {point}
                  </li>
                ))}
              </ul>
            ) : null}
            <div className="mt-5">
              {link(
                cta,
                "group inline-flex min-h-14 w-full items-center justify-center rounded-md bg-action px-5 text-[17px] font-semibold text-white shadow-[0_10px_24px_-12px_rgba(0,120,188,1)] transition-colors hover:bg-action-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-action focus-visible:ring-offset-2",
              )}
            </div>
            {popup.proof ? (
              <p className="mt-3 flex items-center justify-center gap-1.5 t-small font-medium text-navy" data-promo-proof>
                <svg aria-hidden="true" viewBox="0 0 20 20" className="size-4 text-[#f5a623]">
                  <path fill="currentColor" d="M10 1.8l2.5 5.2 5.7.7-4.2 3.9 1.1 5.6L10 14.5l-5.1 2.7 1.1-5.6-4.2-3.9 5.7-.7z" />
                </svg>
                {popup.proof}
              </p>
            ) : null}
            {popup.fine ? <p className="mt-2.5 text-center t-caption leading-[1.4] text-secondary">{popup.fine}</p> : null}
            {!photo && popup.ends ? <p className="mt-2 text-center t-caption font-semibold uppercase tracking-[0.08em] text-navy">{popup.ends}</p> : null}
            <div className="mt-1 flex justify-center">{notNow}</div>
          </div>
        ) : (
          <div className="flex justify-center bg-white py-2">{notNow}</div>
        )}
      </div>
    </dialog>
  );
}
