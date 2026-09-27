"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * Keeps the promo top bar and the header on screen together while the page scrolls. The bar's
 * real height (0 when there is no bar; more when a still line wraps on a phone) is published as
 * --promo-h, so the mobile menu, sticky side columns and anchor jumps sit below both.
 */
export function StickyTop({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = document.documentElement;
    const bar = ref.current?.querySelector<HTMLElement>("[data-promo-bar]");
    if (!bar) {
      root.style.removeProperty("--promo-h");
      return;
    }
    const set = () => root.style.setProperty("--promo-h", `${Math.round(bar.getBoundingClientRect().height)}px`);
    set();
    const observer = new ResizeObserver(set);
    observer.observe(bar);
    return () => {
      observer.disconnect();
      root.style.removeProperty("--promo-h");
    };
  }, []);
  return (
    <div ref={ref} className="sticky top-0 z-40">
      {children}
    </div>
  );
}
