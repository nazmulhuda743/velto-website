"use client";

import { useState } from "react";
import Link from "next/link";
import { BottomSheet } from "@/components/app/BottomSheet";
import { buttonClass } from "@/components/app/ui";
import type { PriceRow } from "@/components/app/book/AppBookingFlow";
import type { Locale } from "@/lib/i18n/config";
import { PricesPanel, type PricesText } from "./PricesPanel";

/**
 * Opens the prices as a bottom sheet (not a tab or a page): the header's "Prices" pill, or a text
 * button inside a screen (Home's "See prices first", with `trigger`).
 */
export function PricesButton({
  label,
  close,
  book,
  bookHref,
  popular,
  t,
  locale,
  trigger,
}: {
  label: string;
  close: string;
  book: string;
  bookHref?: string;
  popular: PriceRow[];
  t: PricesText;
  locale: Locale;
  /** A text button with this label instead of the header pill. */
  trigger?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      {trigger ? (
        <button type="button" onClick={() => setOpen(true)} className={buttonClass("text", "w-full")} data-app-prices-text>
          {trigger}
        </button>
      ) : (
        <button type="button" onClick={() => setOpen(true)} className="inline-flex min-h-11 items-center justify-center" data-app-prices-pill>
          <span className="rounded-full border border-app-chip bg-app-card px-3 py-[7px] a-cap font-semibold text-navy">{label}</span>
        </button>
      )}
      <BottomSheet
        open={open}
        onClose={() => setOpen(false)}
        title={label}
        closeLabel={close}
        footer={
          bookHref ? (
            <Link href={bookHref} className={buttonClass("primary")} onClick={() => setOpen(false)}>
              {book}
            </Link>
          ) : (
            <button type="button" className={buttonClass("primary")} onClick={() => setOpen(false)}>
              {book}
            </button>
          )
        }
      >
        <PricesPanel popular={popular} t={t} locale={locale} />
      </BottomSheet>
    </>
  );
}
