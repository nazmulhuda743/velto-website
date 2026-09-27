"use client";

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import Link from "@/components/i18n/Link";
import { track } from "@/components/layout/Analytics";
import { CloseIcon } from "@/components/ui/icons";
import { popupDue, popupExcluded, type PopupFrequency, type SeenRecord } from "@/lib/promo";

export type PopupView = {
  version: string;
  image: string;
  imageAlt: string;
  tag: string;
  title: string;
  body: string;
  cta: string;
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
export function PromoPopup({ popup, labels }: { popup: PopupView; labels: PopupLabels }) {
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
      className="m-auto max-h-[calc(100dvh-32px)] w-[calc(100%-32px)] max-w-[420px] overflow-y-auto rounded-lg border-0 bg-transparent p-0 text-body backdrop:bg-navy/55 backdrop:backdrop-blur-[2px]"
    >
      <div className="relative overflow-hidden rounded-lg bg-white shadow-[0_24px_64px_rgba(0,34,61,0.35)]">
        <button
          type="button"
          onClick={close}
          aria-label={labels.close}
          className="absolute right-2.5 top-2.5 z-10 inline-flex size-10 items-center justify-center rounded-full bg-white/92 text-navy shadow-sm hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-action"
        >
          <CloseIcon className="size-5" />
        </button>

        {popup.image
          ? link(
              // eslint-disable-next-line @next/next/no-img-element
              <img src={popup.image} alt={popup.imageAlt} className="block max-h-[62dvh] w-full bg-soft object-contain" decoding="async" />,
              `${linkClass} bg-soft`,
              popup.title ? undefined : popup.imageAlt || labels.posterOpens,
            )
          : null}

        {popup.tag || popup.title || popup.body || popup.cta ? (
          <div className="px-5 pb-5 pt-4 min-[360px]:px-6">
            {popup.tag ? <p className="t-caption font-semibold uppercase tracking-[0.08em] text-action">{popup.tag}</p> : null}
            {popup.title ? (
              <h2 id={titleId} className={`t-h4 text-navy ${popup.tag ? "mt-1.5" : ""}`}>
                {popup.title}
              </h2>
            ) : null}
            {popup.body ? <p className="mt-2 t-small text-body">{popup.body}</p> : null}
            <div className="mt-4 flex flex-col gap-2">
              {link(
                popup.cta || labels.posterOpens,
                "inline-flex min-h-12 w-full items-center justify-center rounded-md bg-action px-5 text-[15px] font-semibold text-white hover:bg-action-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-action focus-visible:ring-offset-2",
              )}
              <button type="button" onClick={close} className="inline-flex min-h-10 items-center justify-center t-small font-semibold text-secondary hover:text-navy">
                {labels.notNow}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex justify-center bg-white py-2">
            <button type="button" onClick={close} className="inline-flex min-h-10 items-center justify-center px-4 t-small font-semibold text-secondary hover:text-navy">
              {labels.notNow}
            </button>
          </div>
        )}
      </div>
    </dialog>
  );
}
