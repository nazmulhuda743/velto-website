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
      className="mb-0 mt-auto max-h-[calc(100dvh-24px)] w-full max-w-none overflow-y-auto border-0 bg-transparent p-0 text-body backdrop:bg-navy/60 backdrop:backdrop-blur-[2px] sm:m-auto sm:max-h-[calc(100dvh-32px)] sm:w-[calc(100%-32px)] sm:max-w-[440px]"
    >
      <div data-promo-card tabIndex={-1} autoFocus className="relative overflow-hidden rounded-t-[20px] bg-white shadow-[0_24px_64px_rgba(0,34,61,0.35)] focus:outline-none sm:rounded-lg">
        <button
          type="button"
          onClick={close}
          aria-label={labels.close}
          className={`absolute right-3 top-3 z-10 inline-flex size-10 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan ${
            popup.image ? "bg-white/92 text-navy shadow-sm hover:bg-white" : "bg-white/10 text-white hover:bg-white/20"
          }`}
        >
          <CloseIcon className="size-5" />
        </button>

        {popup.image ? (
          link(
            // eslint-disable-next-line @next/next/no-img-element
            <img src={popup.image} alt={popup.imageAlt} className="block max-h-[56dvh] w-full bg-soft object-contain" decoding="async" />,
            `${linkClass} bg-soft`,
            popup.title ? undefined : popup.imageAlt || labels.posterOpens,
          )
        ) : hasText ? (
          <div className="on-navy bg-navy-deep px-6 pb-7 pt-6 text-white min-[400px]:px-7 [@media(max-height:720px)]:pb-5 [@media(max-height:720px)]:pt-5">
            {logo ? <div className="mb-5 flex h-7 items-center [@media(max-height:720px)]:hidden">{logo}</div> : null}
            {popup.tag ? (
              <p className="inline-flex rounded-full border border-cyan/50 px-3 py-1 t-caption font-semibold uppercase tracking-[0.08em] text-cyan">{popup.tag}</p>
            ) : null}
            {popup.offerBig ? (
              <p className="mt-4 flex items-end gap-3 [@media(max-height:720px)]:mt-3" data-promo-offer>
                <span className="text-[68px] font-bold leading-[0.85] tracking-[-0.04em] text-cyan min-[400px]:text-[80px] [@media(max-height:720px)]:text-[56px]">{popup.offerBig}</span>
                {popup.offerSmall ? <span className="pb-1 text-[24px] font-bold uppercase leading-none tracking-[0.02em] text-white min-[400px]:text-[28px]">{popup.offerSmall}</span> : null}
              </p>
            ) : null}
            {popup.title ? (
              <h2 id={titleId} className={`text-[22px] font-semibold leading-[1.2] tracking-[-0.01em] text-white min-[400px]:text-[24px] ${popup.offerBig ? "mt-3" : "mt-3 pr-10"}`}>
                {popup.title}
              </h2>
            ) : null}
          </div>
        ) : null}

        {hasText ? (
          <div className="px-6 pb-5 pt-5 min-[400px]:px-7 [@media(max-height:720px)]:pb-3 [@media(max-height:720px)]:pt-4">
            {popup.image && popup.tag ? <p className="t-caption font-semibold uppercase tracking-[0.08em] text-action">{popup.tag}</p> : null}
            {popup.image && popup.title ? (
              <h2 id={titleId} className={`t-h4 text-navy ${popup.tag ? "mt-1.5" : ""}`}>
                {popup.title}
              </h2>
            ) : null}
            {popup.body ? <p className={`${popup.image ? "mt-2" : ""} text-[16px] leading-[1.5] text-body`}>{popup.body}</p> : null}
            {popup.points.length ? (
              <ul className="mt-4 space-y-2.5 [@media(max-height:720px)]:mt-3 [@media(max-height:720px)]:space-y-1.5">
                {popup.points.map((point) => (
                  <li key={point} className="flex items-start gap-3 text-[15px] font-medium text-navy">
                    <span aria-hidden="true" className="mt-px inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-success-soft text-success">
                      <svg viewBox="0 0 20 20" className="size-3.5">
                        <path d="M4.5 10.5l3.5 3.5 7.5-8" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </span>
                    {point}
                  </li>
                ))}
              </ul>
            ) : null}
            <div className="mt-5">
              {link(
                cta,
                "group inline-flex min-h-14 w-full items-center justify-center rounded-md bg-action px-5 text-[17px] font-semibold text-white shadow-[0_8px_20px_-10px_rgba(0,112,186,0.9)] transition-colors hover:bg-action-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-action focus-visible:ring-offset-2",
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
            {popup.fine ? <p className="mt-3 text-center t-caption text-secondary">{popup.fine}</p> : null}
            <div className="mt-1 flex justify-center">{notNow}</div>
          </div>
        ) : (
          <div className="flex justify-center bg-white py-2">{notNow}</div>
        )}
      </div>
    </dialog>
  );
}
