"use client";

import { useState } from "react";
import Link from "next/link";
import { BottomSheet } from "@/components/app/BottomSheet";
import { buttonClass } from "@/components/app/ui";
import { track } from "@/components/layout/Analytics";
import type { PriceRow } from "@/components/app/book/AppBookingFlow";
import type { Locale } from "@/lib/i18n/config";
import { PricesPanel, type PricesText } from "./PricesPanel";

/** The header's "Prices" pill: opens the prices as a bottom sheet (not a tab or a page). */
export function PricesButton({ label, close, book, bookHref, popular, t, locale }: { label: string; close: string; book: string; bookHref?: string; popular: PriceRow[]; t: PricesText; locale: Locale }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => {
          setOpen(true);
          track("prices_open", { placement: "sheet" });
        }}
        className="inline-flex min-h-11 items-center justify-center" data-app-prices-pill>
        <span className="rounded-full border border-app-chip bg-app-card px-3 py-[7px] a-cap font-semibold text-navy">{label}</span>
      </button>
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
