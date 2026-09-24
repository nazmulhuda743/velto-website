"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { AccountNavLink } from "@/components/account/AccountNavLink";
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
      const header = panel.closest("header");
      const focusables = Array.from(header?.querySelectorAll<HTMLElement>('a[href], button:not([disabled])') ?? []).filter((el) => el.offsetParent !== null);
      const first = focusables[0]; const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("keydown", onKey); document.documentElement.style.overflow = ""; };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div id="mobile-menu" ref={panelRef} className="fixed inset-x-0 bottom-0 top-16 z-50 overflow-y-auto border-t border-line bg-white lg:hidden">
      <nav aria-label="Mobile" className="container-page pb-[calc(24px+env(safe-area-inset-bottom))] pt-3"><ul>{NAV.mobile.map((item) => <li key={item.href} className="border-b border-line"><Link href={item.href} onClick={onClose} className="flex min-h-[52px] items-center justify-between py-3 text-[17px] font-medium tracking-[-0.01em] text-navy">{item.label}<ArrowRight className="size-4 text-blue" /></Link></li>)}<li className="border-b border-line"><AccountNavLink onNavigate={onClose} className="flex min-h-[52px] items-center justify-between py-3 text-[17px] font-medium tracking-[-0.01em] text-navy" /></li></ul>
        <div className="mt-8 flex gap-2.5"><ButtonLink href={bookHref("mobile_menu")} event="book_pickup_click" placement="mobile_menu" className="!h-12 flex-[1.4] !px-4" onClick={onClose}>Book a Pickup</ButtonLink><WhatsAppButton href={WHATSAPP_URL} placement="mobile_menu" className="!h-12 flex-1 !px-4">WhatsApp</WhatsAppButton></div>
      </nav>
    </div>
  );
}
