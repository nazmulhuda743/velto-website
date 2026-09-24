"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ButtonLink } from "@/components/ui/Button";
import { CloseIcon, MenuIcon, WhatsAppIcon } from "@/components/ui/icons";
import { NAV, WHATSAPP_URL, bookHref } from "@/content/site";
import { MobileMenu } from "./MobileMenu";

export function Header({ logo }: { logo: ReactNode }) {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

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
      className={`sticky top-0 z-40 border-b bg-white transition-[border-color] duration-200 ${
        scrolled || menuOpen ? "border-line" : "border-transparent"
      }`}
    >
      <div
        className={`container-page flex items-center justify-between gap-6 transition-[height] duration-200 motion-reduce:transition-none h-16 ${
          scrolled ? "lg:h-[68px]" : "lg:h-[76px]"
        }`}
      >
        <Link href="/" className="-m-1 flex shrink-0 items-center p-1" aria-label="Velto home">
          {logo}
        </Link>

        <nav aria-label="Main" className="hidden lg:block">
          <ul className="flex items-center gap-1">
            {NAV.desktop.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="rounded-sm px-3 py-2 text-[15px] font-medium text-navy transition-colors hover:text-blue"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex items-center gap-2 lg:gap-5">
          <a
            href={WHATSAPP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="hidden items-center gap-2 rounded-sm px-1 py-2 text-[15px] font-medium text-navy transition-colors hover:text-blue lg:inline-flex"
            data-analytics="whatsapp_click"
            data-placement="header"
          >
            <WhatsAppIcon className="size-[18px] text-whatsapp" />
            WhatsApp
          </a>
          <div className="hidden md:block">
            <ButtonLink
              href={bookHref("header")}
              event="book_pickup_click"
              placement="header"
              className="!h-11 !px-5 lg:!h-11"
            >
              Book a Pickup
            </ButtonLink>
          </div>
          <button
            ref={triggerRef}
            type="button"
            className="-mr-2 inline-flex size-12 items-center justify-center rounded-md text-navy lg:hidden"
            aria-expanded={menuOpen}
            aria-controls="mobile-menu"
            onClick={() => (menuOpen ? closeMenu() : setMenuOpen(true))}
          >
            {menuOpen ? <CloseIcon /> : <MenuIcon />}
            <span className="sr-only">{menuOpen ? "Close menu" : "Open menu"}</span>
          </button>
        </div>
      </div>

      <MobileMenu open={menuOpen} onClose={closeMenu} />
    </header>
  );
}
