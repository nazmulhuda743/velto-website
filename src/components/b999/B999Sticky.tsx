"use client";

import { useEffect, useState } from "react";

/**
 * Mobile-only bar: "Book 3 Blankets for ৳999", scrolling to the booking form. Hidden while the
 * hero's own button or any part of the booking section is on screen, so it never covers a field.
 */
export function B999Sticky({ label, target }: { label: string; target: string }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const section = document.getElementById(target);
    const hero = document.querySelector("[data-b999-hero-cta]");
    const visible = new Map<Element, boolean>();
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) visible.set(e.target, e.isIntersecting);
      setShow(![...visible.values()].some(Boolean));
    });
    if (section) io.observe(section);
    if (hero) io.observe(hero);
    return () => io.disconnect();
  }, [target]);
  if (!show) return null;
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white/95 px-4 pb-[max(12px,env(safe-area-inset-bottom))] pt-3 backdrop-blur md:hidden" data-b999-sticky>
      <a
        href={`#${target}`}
        data-analytics="book_pickup_click"
        data-placement="b999-sticky"
        data-service="blanket-comforter-cleaning"
        className="flex min-h-[52px] w-full items-center justify-center rounded-md bg-action px-5 text-[17px] font-semibold text-white hover:bg-action-hover"
      >
        {label}
      </a>
    </div>
  );
}
