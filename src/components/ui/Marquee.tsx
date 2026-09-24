"use client";

import { useState, type ReactNode } from "react";

/**
 * Continuous horizontal strip. Pauses on hover/focus and with the visible
 * toggle (WCAG 2.2.2); reduced-motion users get a static, scrollable row.
 * `repeat` fills short lists so one copy is always wider than the viewport.
 */
export function Marquee({
  children,
  label,
  seconds = 40,
  repeat = 1,
  gapClass = "gap-3",
  seamClass = "pr-3",
  className = "",
  toggleAt = "below",
}: {
  children: ReactNode;
  label: string;
  seconds?: number;
  repeat?: number;
  gapClass?: string;
  /** Right padding on each copy; must equal the gap so the loop point is invisible. */
  seamClass?: string;
  className?: string;
  /** Pause control beside the strip (compact bands) or under it (content carousels). */
  toggleAt?: "side" | "below";
}) {
  const [paused, setPaused] = useState(false);
  const group = (copy: boolean) => (
    <div
      className={`flex shrink-0 ${gapClass} ${seamClass} ${copy ? "marquee-copy" : ""}`}
      aria-hidden={copy || undefined}
      inert={copy || undefined}
    >
      {Array.from({ length: repeat }, (_, i) => (
        <div key={i} className={i > 0 ? "contents marquee-copy" : "contents"} aria-hidden={i > 0 || undefined} inert={i > 0 || undefined}>
          {children}
        </div>
      ))}
    </div>
  );

  return (
    <div className={`flex ${toggleAt === "side" ? "items-center gap-3" : "flex-col items-start gap-5"} ${className}`}>
      <div
        role="region"
        aria-label={label}
        data-paused={paused}
        className="marquee w-full min-w-0 flex-1 overflow-hidden"
        style={{ ["--marquee-duration" as string]: `${seconds}s` }}
      >
        <div className="marquee-track">
          {group(false)}
          {group(true)}
        </div>
      </div>
      <button
        type="button"
        onClick={() => setPaused((p) => !p)}
        aria-pressed={paused}
        className="marquee-toggle inline-flex size-9 shrink-0 items-center justify-center rounded-full border border-line bg-white text-navy hover:border-navy"
      >
        <span className="sr-only">{paused ? `Play ${label}` : `Pause ${label}`}</span>
        {paused ? (
          <svg viewBox="0 0 16 16" aria-hidden="true" className="size-3.5">
            <path fill="currentColor" d="M5 3.5v9l7-4.5z" />
          </svg>
        ) : (
          <svg viewBox="0 0 16 16" aria-hidden="true" className="size-3.5">
            <path fill="currentColor" d="M4.5 3.5h2.5v9H4.5zM9 3.5h2.5v9H9z" />
          </svg>
        )}
      </button>
    </div>
  );
}
