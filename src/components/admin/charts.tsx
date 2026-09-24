import Link from "next/link";
import type { ReactNode } from "react";
import { pct, type FunnelStep } from "@/lib/admin/insights";

/**
 * Small, dependency-free chart primitives for the Command Center.
 * SVG/CSS only; every chart has a text equivalent (aria-label or visible
 * numbers) so nothing depends on reading a shape.
 */

export const fmt = (n: number) => n.toLocaleString("en-US");

export function Sparkline({
  values,
  label,
  width = 160,
  height = 36,
  className = "",
}: {
  values: number[];
  label: string;
  width?: number;
  height?: number;
  className?: string;
}) {
  if (values.length < 2) return null;
  const max = Math.max(1, ...values);
  const step = width / (values.length - 1);
  const pts = values.map((v, i) => [i * step, height - 2 - (v / max) * (height - 4)] as const);
  const line = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  const area = `${line} L${width} ${height} L0 ${height} Z`;
  return (
    <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} role="img" aria-label={label} className={`overflow-visible ${className}`} preserveAspectRatio="none">
      <path d={area} fill="currentColor" opacity="0.08" />
      <path d={line} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export function Delta({ value, invert = false }: { value: number | null; invert?: boolean }) {
  if (value === null || !Number.isFinite(value)) return <span className="t-caption text-muted">no earlier data</span>;
  const up = value > 0;
  const good = invert ? !up : up;
  const flat = Math.abs(value) < 0.005;
  return (
    <span className={`t-caption font-semibold ${flat ? "text-secondary" : good ? "text-success" : "text-error"}`}>
      {flat ? "±0%" : `${up ? "▲" : "▼"} ${pct(Math.abs(value))}`}
      <span className="font-normal text-secondary"> vs previous</span>
    </span>
  );
}

export type BarItem = { label: ReactNode; value: number; sub?: ReactNode; href?: string; key: string };

export function BarList({ items, total, empty = "Nothing recorded in this period.", valueLabel }: { items: BarItem[]; total?: number; empty?: string; valueLabel?: (v: number) => ReactNode }) {
  if (!items.length) return <p className="py-3 t-small text-secondary">{empty}</p>;
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <ul className="divide-y divide-line">
      {items.map((item) => {
        const body = (
          <>
            <span className="flex items-baseline justify-between gap-3">
              <span className="min-w-0 truncate text-[15px] text-navy">{item.label}</span>
              <span className="shrink-0 tabular-nums text-[15px] font-semibold text-navy">
                {valueLabel ? valueLabel(item.value) : fmt(item.value)}
                {total ? <span className="ml-2 font-normal text-secondary">{pct(item.value / total)}</span> : null}
              </span>
            </span>
            <span className="mt-1.5 block h-1 rounded-full bg-soft" aria-hidden="true">
              <span className="block h-1 rounded-full bg-blue/70" style={{ width: `${(item.value / max) * 100}%` }} />
            </span>
            {item.sub ? <span className="mt-1 block t-caption text-secondary">{item.sub}</span> : null}
          </>
        );
        return (
          <li key={item.key} className="py-2.5">
            {item.href ? (
              <Link href={item.href} className="block hover:opacity-80">
                {body}
              </Link>
            ) : (
              body
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** One strong funnel: stage bars scaled to the first stage, with step conversion and drop-off between stages. */
export function FunnelChart({ steps, compact = false }: { steps: FunnelStep[]; compact?: boolean }) {
  const top = Math.max(1, steps[0]?.count ?? 0);
  return (
    <ol className="space-y-0">
      {steps.map((s, i) => (
        <li key={s.key}>
          {i > 0 ? (
            <div className="flex items-center gap-3 py-1.5 pl-1 t-caption text-secondary" aria-label={`${pct(s.fromPrevious)} continued, ${pct(s.dropOff)} dropped off`}>
              <span aria-hidden="true" className="text-line-strong">↓</span>
              <span>
                <span className="font-semibold text-navy">{pct(s.fromPrevious)}</span> continued
              </span>
              {s.dropOff !== null && s.dropOff > 0 ? (
                <span>
                  · <span className="font-semibold text-error">{pct(s.dropOff)}</span> dropped off
                </span>
              ) : null}
            </div>
          ) : null}
          <div className={`grid items-center gap-x-4 gap-y-1 ${compact ? "grid-cols-[1fr_auto]" : "md:grid-cols-[15rem_1fr_7rem]"}`}>
            <div className={compact ? "col-span-2" : ""}>
              <p className="text-[15px] font-semibold text-navy">{s.label}</p>
              {!compact ? <p className="t-caption text-secondary">{s.hint}</p> : null}
            </div>
            <div className="h-9 rounded-md bg-soft" aria-hidden="true">
              <div
                className={`h-9 rounded-md ${i === steps.length - 1 ? "bg-success/80" : "bg-navy"}`}
                style={{ width: `${Math.max(s.count ? 1.5 : 0, (s.count / top) * 100)}%`, opacity: 1 - i * 0.12 }}
              />
            </div>
            <p className="text-right tabular-nums">
              <span className="text-[20px] font-semibold text-navy">{fmt(s.count)}</span>
              <span className="block t-caption text-secondary">{i === 0 ? "sessions" : `${pct(s.ofTotal)} of all`}</span>
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}

/** 24-hour activity strip (Dhaka time). */
export function HourStrip({ hours }: { hours: number[] }) {
  const max = Math.max(1, ...hours);
  const peak = hours.indexOf(Math.max(...hours));
  const label = (h: number) => `${h % 12 || 12}${h < 12 ? "am" : "pm"}`;
  return (
    <figure>
      <div className="grid items-end gap-[3px]" style={{ gridTemplateColumns: "repeat(24, minmax(0, 1fr))" }}>
        {hours.map((v, h) => (
          <div key={h} className="flex h-24 flex-col justify-end" title={`${label(h)}: ${v} sessions`}>
            <div className="rounded-sm bg-blue" style={{ height: `${Math.max(v ? 4 : 0, (v / max) * 100)}%`, opacity: 0.35 + (v / max) * 0.65 }} />
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex justify-between t-caption text-secondary" aria-hidden="true">
        <span>12am</span>
        <span>6am</span>
        <span>12pm</span>
        <span>6pm</span>
        <span>11pm</span>
      </div>
      <figcaption className="mt-2 t-small text-secondary">
        {hours.some(Boolean) ? (
          <>
            Busiest hour: <span className="font-semibold text-navy">{label(peak)}–{label((peak + 1) % 24)}</span> (Dhaka time)
          </>
        ) : (
          "No sessions in this period."
        )}
      </figcaption>
    </figure>
  );
}

export function StatusDot({ status }: { status: "healthy" | "warning" | "error" }) {
  const map = {
    healthy: ["bg-success", "Healthy"],
    warning: ["bg-[#c77c02]", "Warning"],
    error: ["bg-error", "Error"],
  } as const;
  const [bg, text] = map[status];
  return (
    <span className="inline-flex items-center gap-2 t-small font-semibold text-navy">
      <span aria-hidden="true" className={`size-2.5 rounded-full ${bg}`} />
      {text}
    </span>
  );
}

/** Split share bar, e.g. new vs returning or mobile vs desktop. */
export function SplitBar({ parts }: { parts: { label: string; value: number; tone: string }[] }) {
  const total = parts.reduce((a, p) => a + p.value, 0);
  return (
    <div>
      <div className="flex h-2.5 overflow-hidden rounded-full bg-soft" role="img" aria-label={parts.map((p) => `${p.label} ${pct(total ? p.value / total : null)}`).join(", ")}>
        {total ? parts.map((p) => <span key={p.label} className={p.tone} style={{ width: `${(p.value / total) * 100}%` }} />) : null}
      </div>
      <ul className="mt-3 flex flex-wrap gap-x-6 gap-y-2">
        {parts.map((p) => (
          <li key={p.label} className="flex items-center gap-2 t-small">
            <span aria-hidden="true" className={`size-2.5 rounded-sm ${p.tone}`} />
            <span className="text-secondary">{p.label}</span>
            <span className="font-semibold tabular-nums text-navy">{fmt(p.value)}</span>
            <span className="text-secondary">{pct(total ? p.value / total : null)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
