"use client";

import { useState, type ReactNode } from "react";

/**
 * Frame for the moving top bar. Motion already stops on hover and keyboard focus (CSS); this
 * button gives touch and screen-reader users the same control (WCAG 2.2.2). Readers who prefer
 * reduced motion never see the ticker: the CSS swaps in the still line.
 */
export function TickerControl({ label, pauseLabel, playLabel, children }: { label: string; pauseLabel: string; playLabel: string; children: ReactNode }) {
  const [paused, setPaused] = useState(false);
  return (
    <div className="promo-ticker bg-navy text-white" data-paused={paused} role="region" aria-label={label}>
      <div className="flex items-stretch">
        {children}
        <button
          type="button"
          onClick={() => setPaused((p) => !p)}
          aria-pressed={paused}
          aria-label={paused ? playLabel : pauseLabel}
          className="promo-ticker-toggle inline-flex w-10 shrink-0 items-center justify-center text-white/80 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-cyan"
        >
          {paused ? (
            <svg viewBox="0 0 16 16" aria-hidden="true" className="size-3" fill="currentColor"><path d="M4 2.5v11l9-5.5z" /></svg>
          ) : (
            <svg viewBox="0 0 16 16" aria-hidden="true" className="size-3" fill="currentColor"><path d="M4 2.5h3v11H4zM9 2.5h3v11H9z" /></svg>
          )}
        </button>
      </div>
    </div>
  );
}
