"use client";

import { useState, type ReactNode } from "react";

/**
 * Wraps the review track. Motion stops on hover and keyboard focus (CSS); this
 * button gives touch and screen-reader users the same control (WCAG 2.2.2).
 */
export function MarqueeControl({ label, children }: { label: string; children: ReactNode }) {
  const [paused, setPaused] = useState(false);
  return (
    <div className="review-marquee relative" data-paused={paused} role="region" aria-label={label}>
      {children}
      <div className="container-page mt-5 flex justify-end">
        <button
          type="button"
          onClick={() => setPaused((p) => !p)}
          aria-pressed={paused}
          className="review-marquee-toggle inline-flex min-h-10 items-center gap-2 rounded-md px-2 t-small font-semibold text-navy hover:text-action"
        >
          <span aria-hidden="true" className="inline-flex size-4 items-center justify-center">
            {paused ? (
              <svg viewBox="0 0 16 16" className="size-3.5" fill="currentColor"><path d="M4 2.5v11l9-5.5z" /></svg>
            ) : (
              <svg viewBox="0 0 16 16" className="size-3.5" fill="currentColor"><path d="M4 2.5h3v11H4zM9 2.5h3v11H9z" /></svg>
            )}
          </span>
          {paused ? "Play reviews" : "Pause reviews"}
        </button>
      </div>
    </div>
  );
}
