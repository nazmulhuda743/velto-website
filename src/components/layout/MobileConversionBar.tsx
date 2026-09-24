"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { WhatsAppIcon } from "@/components/ui/icons";
import { WHATSAPP_URL, bookHref } from "@/content/site";

const TEXT_ENTRY = "input:not([type=checkbox]):not([type=radio]):not([type=button]):not([type=submit]), textarea, select";

/**
 * Persistent mobile conversion bar (spec §18). Hidden while typing and while
 * the final booking section fills ~60%+ of the viewport.
 */
export function MobileConversionBar({ finalSectionId }: { finalSectionId: string }) {
  const [typing, setTyping] = useState(false);
  const [finalInView, setFinalInView] = useState(false);

  useEffect(() => {
    const onFocusIn = (e: FocusEvent) => {
      if ((e.target as Element)?.matches?.(TEXT_ENTRY)) setTyping(true);
    };
    const onFocusOut = (e: FocusEvent) => {
      if ((e.target as Element)?.matches?.(TEXT_ENTRY)) setTyping(false);
    };
    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("focusout", onFocusOut);

    const target = document.getElementById(finalSectionId);
    let io: IntersectionObserver | undefined;
    if (target) {
      io = new IntersectionObserver(
        ([entry]) => {
          setFinalInView(entry.intersectionRect.height / window.innerHeight >= 0.6);
        },
        { threshold: Array.from({ length: 21 }, (_, i) => i / 20) },
      );
      io.observe(target);
    }
    return () => {
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("focusout", onFocusOut);
      io?.disconnect();
    };
  }, [finalSectionId]);

  const hidden = typing || finalInView;

  return (
    <div
      data-mobile-bar
      className={`fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white pb-[env(safe-area-inset-bottom)] transition-[transform,visibility] duration-200 motion-reduce:transition-none md:hidden ${
        hidden ? "invisible translate-y-full" : "visible translate-y-0"
      }`}
    >
      <div className="flex h-[72px] items-center gap-2 px-4 min-[375px]:px-5">
        <Link
          href={bookHref("mobile_sticky")}
          className="inline-flex h-12 flex-[7] items-center justify-center rounded-md bg-blue text-[15px] font-semibold uppercase tracking-[0.04em] text-white active:bg-[#025a8f]"
          data-analytics="book_pickup_click"
          data-placement="mobile_sticky"
        >
          Book Pickup
        </Link>
        <a
          href={WHATSAPP_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-12 min-w-0 flex-[3] items-center justify-center gap-1 rounded-md border border-line-strong px-1 text-[13px] font-semibold uppercase tracking-[0.01em] max-[374px]:text-[12px] max-[374px]:tracking-normal text-navy active:bg-soft"
          data-analytics="whatsapp_click"
          data-placement="mobile_sticky"
        >
          <WhatsAppIcon className="size-4 shrink-0 text-whatsapp" />
          WhatsApp
        </a>
      </div>
    </div>
  );
}
