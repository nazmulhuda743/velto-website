"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { ButtonLink, WhatsAppButton } from "@/components/ui/Button";
import { ArrowRight } from "@/components/ui/icons";
import { NAV, WHATSAPP_URL, bookHref } from "@/content/site";

export function MobileMenu({ open, onClose }: { open: boolean; onClose: () => void }) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    panel?.querySelector<HTMLElement>("a")?.focus();
    document.documentElement.style.overflow = "hidden";

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key !== "Tab" || !panel) return;
      // Keep focus within the menu and its trigger while open.
      const header = panel.closest("header");
      const focusables = Array.from(
        header?.querySelectorAll<HTMLElement>('a[href], button:not([disabled])') ?? [],
      ).filter((el) => el.offsetParent !== null);
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.documentElement.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      id="mobile-menu"
      ref={panelRef}
      className="fixed inset-x-0 bottom-0 top-16 z-50 overflow-y-auto border-t border-line bg-white lg:hidden"
    >
      <nav aria-label="Mobile" className="container-page flex min-h-full flex-col pb-[calc(24px+env(safe-area-inset-bottom))] pt-2">
        <ul>
          {NAV.mobile.map((item) => (
            <li key={item.href} className="border-b border-line">
              <Link
                href={item.href}
                onClick={onClose}
                className="flex items-center justify-between py-[18px] t-h4 text-navy"
              >
                {item.label}
                <ArrowRight className="size-5 text-blue" />
              </Link>
            </li>
          ))}
        </ul>
        <div className="mt-auto flex flex-col gap-3 pt-10">
          <WhatsAppButton href={WHATSAPP_URL} placement="mobile_menu" className="w-full">
            WhatsApp
          </WhatsAppButton>
          <ButtonLink
            href={bookHref("mobile_menu")}
            event="book_pickup_click"
            placement="mobile_menu"
            className="w-full"
            onClick={onClose}
          >
            Book a Pickup
          </ButtonLink>
        </div>
      </nav>
    </div>
  );
}
