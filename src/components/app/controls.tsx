"use client";

import { useId, type ReactNode } from "react";

/*
 * The app's choice controls (design "Chips, segmented, toggle"). Each is a native input under
 * the drawing, so keyboard, screen readers and forms work without extra script.
 */

const cx = (...parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(" ");

export type ChipOption = { value: string; label: ReactNode; sub?: ReactNode };

/**
 * Single-choice chips. "pill" for services and windows; "day" for the day picker (weekday over
 * date, equal width). Options that can't be chosen are left out by the caller, not greyed.
 */
export function ChipGroup({
  legend,
  name,
  options,
  value,
  onChange,
  variant = "pill",
  hideLegend,
}: {
  legend: ReactNode;
  name: string;
  options: ChipOption[];
  value: string | null;
  onChange: (value: string) => void;
  variant?: "pill" | "day";
  hideLegend?: boolean;
}) {
  return (
    <fieldset>
      <legend className={hideLegend ? "sr-only" : "mb-2 a-sec font-semibold text-navy"}>{legend}</legend>
      <div className={variant === "day" ? "grid grid-cols-[repeat(auto-fill,minmax(72px,1fr))] gap-2" : "flex flex-wrap gap-2"}>
        {options.map((o) => {
          const on = o.value === value;
          return (
            <label
              key={o.value}
              className={cx(
                "relative cursor-pointer border-[1.5px] text-body has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-action",
                variant === "day" ? "flex min-h-13 flex-col items-center justify-center gap-px rounded-xl py-2.5" : "inline-flex min-h-11 items-center rounded-full px-3.5 a-sec",
                on ? "border-action bg-app-tint font-semibold text-navy" : "border-app-chip bg-app-card",
              )}
            >
              <input type="radio" name={name} value={o.value} checked={on} onChange={() => onChange(o.value)} className="sr-only" />
              {variant === "day" ? (
                <>
                  <span className="a-cap font-semibold">{o.label}</span>
                  {o.sub ? <span className="a-meta">{o.sub}</span> : null}
                </>
              ) : (
                o.label
              )}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

/** Segmented control (Preferences: No preference / On hangers / Folded). */
export function Segmented({
  legend,
  name,
  options,
  value,
  onChange,
}: {
  legend: ReactNode;
  name: string;
  options: ChipOption[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <fieldset>
      <legend className="mb-2 a-sec font-semibold text-navy">{legend}</legend>
      <div className="flex rounded-xl bg-[#e8ebef] p-[3px]">
        {options.map((o) => {
          const on = o.value === value;
          return (
            <label
              key={o.value}
              className={cx(
                "flex min-h-11 flex-1 cursor-pointer items-center justify-center rounded-[10px] px-2 text-center text-[13.5px] font-semibold has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-action",
                on ? "bg-app-card text-navy shadow-[0_1px_2px_rgba(0,0,0,0.08)]" : "text-secondary",
              )}
            >
              <input type="radio" name={name} value={o.value} checked={on} onChange={() => onChange(o.value)} className="sr-only" />
              {o.label}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

/** − n + with a 44 px target on each side. */
export function Stepper({
  value,
  onChange,
  min = 0,
  max = 99,
  label,
  decreaseLabel,
  increaseLabel,
}: {
  value: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
  label: string;
  decreaseLabel: string;
  increaseLabel: string;
}) {
  const btn =
    "flex size-11 items-center justify-center rounded-full border-[1.5px] border-line-strong bg-app-card text-[20px] font-semibold text-navy disabled:border-line disabled:text-app-off-text";
  return (
    <div role="group" aria-label={label} className="flex items-center gap-1">
      <button type="button" className={btn} onClick={() => onChange(Math.max(min, value - 1))} disabled={value <= min} aria-label={decreaseLabel}>
        −
      </button>
      <output aria-live="polite" className="min-w-7 text-center a-row font-semibold text-navy">
        {value}
      </output>
      <button type="button" className={btn} onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max} aria-label={increaseLabel}>
        +
      </button>
    </div>
  );
}

/** On/off switch row: title, optional subtitle, 46×28 track. */
export function Switch({ checked, onChange, label, sub, disabled }: { checked: boolean; onChange: (on: boolean) => void; label: ReactNode; sub?: ReactNode; disabled?: boolean }) {
  const id = useId();
  return (
    <label htmlFor={id} className="flex min-h-13 cursor-pointer items-center justify-between gap-4 py-3">
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="a-row font-semibold text-navy">{label}</span>
        {sub ? <span className="a-cap text-muted">{sub}</span> : null}
      </span>
      <input id={id} type="checkbox" role="switch" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} className="peer sr-only" />
      <span
        aria-hidden="true"
        className="relative h-7 w-[46px] shrink-0 rounded-full bg-app-chip transition-colors peer-checked:bg-action peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-action peer-disabled:opacity-60 after:absolute after:left-[3px] after:top-[3px] after:size-[22px] after:rounded-full after:bg-white after:shadow-[0_1px_3px_rgba(0,0,0,0.2)] after:transition-transform peer-checked:after:translate-x-[18px]"
      />
    </label>
  );
}
