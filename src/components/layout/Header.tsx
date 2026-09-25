"use client";

import Link from "@/components/i18n/Link";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ButtonLink } from "@/components/ui/Button";
import { CloseIcon, MenuIcon, WhatsAppIcon } from "@/components/ui/icons";
import { dictionary } from "@/content/i18n";
import { NAV, WHATSAPP_URL, bookHref } from "@/content/site";
import { LanguageSwitcher } from "@/components/i18n/LanguageSwitcher";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { AccountLink } from "./AccountLink";
import { MobileMenu } from "./MobileMenu";

export function Header({ logo, accounts = false }: { logo: ReactNode; accounts?: boolean }) {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const t = dictionary(useLocale());

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const closeMenu = useCallback(() => {
    setMenuOpen(false);
    triggerRef.current?.focus();
  }, []);

  return (
    <header
      className={`sticky top-0 z-40 border-b bg-white transition-[border-color,box-shadow] duration-200 ${
        scrolled || menuOpen
          ? "border-line/70 lg:shadow-[0_8px_24px_-18px_rgba(0,43,78,0.35)]"
          : "border-transparent"
      }`}
    >
      <div
        className={`container-page flex items-center justify-between gap-6 transition-[height] duration-200 motion-reduce:transition-none h-16 ${
          scrolled ? "lg:h-16" : "lg:h-[76px]"
        }`}
      >
        <Link
          href="/"
          className={`-m-1 flex shrink-0 origin-left items-center p-1 transition-transform duration-200 motion-reduce:transition-none ${
            scrolled ? "lg:scale-[0.86]" : ""
          }`}
          aria-label={t.common.homeAria}
        >
          {logo}
        </Link>

        <nav aria-label={t.nav.main} className="hidden lg:block">
          <ul className="flex items-center gap-1">
            {NAV.desktop.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="rounded-sm px-3 py-2 text-[15px] font-medium text-navy transition-colors hover:text-blue"
                >
                  {t.nav[item.key]}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex items-center gap-2 lg:gap-5">
          {NAV.utility.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="hidden rounded-sm px-1 py-2 text-[14px] font-medium text-secondary transition-colors hover:text-blue xl:inline-flex"
            >
              {t.nav[item.key]}
            </Link>
          ))}
          <LanguageSwitcher className="hidden rounded-sm px-1 py-2 text-[15px] font-semibold text-navy transition-colors hover:text-blue lg:inline-flex" />
          <a
            href={WHATSAPP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="hidden items-center gap-2 rounded-sm px-1 py-2 text-[15px] font-medium text-navy transition-colors hover:text-blue lg:inline-flex"
            data-analytics="whatsapp_click"
            data-placement="header"
          >
            <WhatsAppIcon className="size-[18px] text-whatsapp" />
            {/* With the account control present, WhatsApp is icon-only until there is room (1280px+). */}
            <span className={accounts ? "max-xl:sr-only" : undefined}>{t.common.whatsapp}</span>
          </a>
          {accounts ? (
            <span className="hidden lg:inline-flex">
              <AccountLink variant="header" />
            </span>
          ) : null}
          <div className="hidden md:block">
            <ButtonLink
              href={bookHref("header")}
              event="book_pickup_click"
              placement="header"
              className={`!h-11 !px-5 transition-[height] duration-200 ${scrolled ? "lg:!h-10" : "lg:!h-11"}`}
            >
              {t.common.bookPickup}
            </ButtonLink>
          </div>
          {accounts ? (
            <span className="inline-flex lg:hidden">
              <AccountLink variant="icon" />
            </span>
          ) : null}
          <button
            ref={triggerRef}
            type="button"
            className="-mr-2 inline-flex size-12 items-center justify-center rounded-md text-navy lg:hidden"
            aria-expanded={menuOpen}
            aria-controls="mobile-menu"
            onClick={() => (menuOpen ? closeMenu() : setMenuOpen(true))}
          >
            {menuOpen ? <CloseIcon /> : <MenuIcon />}
            <span className="sr-only">{menuOpen ? t.nav.closeMenu : t.nav.openMenu}</span>
          </button>
        </div>
      </div>

      <MobileMenu open={menuOpen} onClose={closeMenu} accounts={accounts} />
    </header>
  );
}
