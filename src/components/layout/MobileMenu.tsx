"use client";

import Link from "@/components/i18n/Link";
import { useEffect, useRef } from "react";
import { ButtonLink, WhatsAppButton } from "@/components/ui/Button";
import { ArrowRight } from "@/components/ui/icons";
import { LanguageSwitcher } from "@/components/i18n/LanguageSwitcher";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { dictionary } from "@/content/i18n";
import { NAV, WHATSAPP_URL, bookHref } from "@/content/site";
import { AccountLink } from "./AccountLink";

export function MobileMenu({ open, onClose, accounts = false }: { open: boolean; onClose: () => void; accounts?: boolean }) {
  const panelRef = useRef<HTMLDivElement>(null);
  const t = dictionary(useLocale());

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
      <nav aria-label={t.nav.mobile} className="container-page pb-[calc(24px+env(safe-area-inset-bottom))] pt-3">
        {accounts ? <AccountLink variant="menu" onClick={onClose} className="mb-3 mt-1" /> : null}
        <ul>
          {NAV.mobile.map((item) => (
            <li key={item.href} className="border-b border-line">
              <Link
                href={item.href}
                onClick={onClose}
                className="flex min-h-[52px] items-center justify-between py-3 text-[17px] font-medium tracking-[-0.01em] text-navy"
              >
                {t.nav[item.key]}
                <ArrowRight className="size-4 text-blue" />
              </Link>
            </li>
          ))}
        </ul>
        <LanguageSwitcher className="mt-4 inline-flex min-h-11 items-center rounded-md border border-line-strong px-4 text-[16px] font-semibold text-navy" />
        <div className="mt-8 flex gap-2.5">
          <ButtonLink
            href={bookHref("mobile_menu")}
            event="book_pickup_click"
            placement="mobile_menu"
            className="!h-12 flex-[1.4] !px-4"
            onClick={onClose}
          >
            {t.common.bookPickup}
          </ButtonLink>
          <WhatsAppButton href={WHATSAPP_URL} placement="mobile_menu" className="!h-12 flex-1 !px-4">
            {t.common.whatsapp}
          </WhatsAppButton>
        </div>
      </nav>
    </div>
  );
}
