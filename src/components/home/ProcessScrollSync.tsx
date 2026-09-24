"use client";

import { useEffect } from "react";

/**
 * Marks the process stage crossing ~45% of the viewport as active and shows
 * its frame (spec §20 section 03). Native scroll only — no hijacking. Without
 * JS the first frame stays visible and all copy remains readable.
 */
export function ProcessScrollSync({ rootId }: { rootId: string }) {
  useEffect(() => {
    const root = document.getElementById(rootId);
    if (!root) return;
    const stages = Array.from(root.querySelectorAll<HTMLElement>("[data-stage]"));
    const frames = Array.from(root.querySelectorAll<HTMLElement>("[data-frame]"));
    const desktop = window.matchMedia("(min-width: 1024px)");

    const activate = (index: string) => {
      stages.forEach((s) => (s.dataset.active = String(s.dataset.stage === index)));
      frames.forEach((f) => (f.dataset.active = String(f.dataset.frame === index)));
    };

    const io = new IntersectionObserver(
      (entries) => {
        if (!desktop.matches) return;
        const hit = entries.find((e) => e.isIntersecting);
        if (hit) activate((hit.target as HTMLElement).dataset.stage!);
      },
      { rootMargin: "-45% 0px -54% 0px" },
    );
    stages.forEach((s) => io.observe(s));
    return () => io.disconnect();
  }, [rootId]);

  return null;
}
