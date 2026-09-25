import type { ReactNode } from "react";

export function AdminHeader({ title, intro, actions }: { title: string; intro?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div>
        <h1 className="t-h3 text-navy">{title}</h1>
        {intro ? <p className="mt-2 max-w-[70ch] text-secondary">{intro}</p> : null}
      </div>
      {actions ? <div className="flex gap-2">{actions}</div> : null}
    </div>
  );
}

/** Result banner from ?saved= / ?error= after a form post. */
export function Notice({ saved, error }: { saved?: string | boolean; error?: string }) {
  if (error) {
    return (
      <p role="alert" className="mt-6 rounded-md border border-error/30 bg-error-soft px-4 py-3 t-small font-medium text-error">
        {error}
      </p>
    );
  }
  if (saved) {
    return (
      <p role="status" className="mt-6 rounded-md border border-success/30 bg-success-soft px-4 py-3 t-small font-medium text-success">
        Saved. The website is updated.
      </p>
    );
  }
  return null;
}

export function Field({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[15px] font-semibold text-navy">{label}</span>
      {hint ? <span className="mt-0.5 block t-small text-secondary">{hint}</span> : null}
      <span className="mt-2 block">{children}</span>
    </label>
  );
}

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "blue" | "green" | "amber" }) {
  const tones = {
    neutral: "bg-soft text-secondary",
    blue: "bg-[#e8f3fb] text-blue",
    green: "bg-success-soft text-success",
    amber: "bg-[#fff4e5] text-[#8a5300]",
  };
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 t-caption font-semibold ${tones[tone]}`}>{children}</span>;
}

export type SearchParams = Promise<Record<string, string | string[] | undefined>>;
export const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** A titled block on a dashboard page. Border + spacing, no shadow. */
export function Panel({
  title,
  intro,
  action,
  children,
  className = "",
}: {
  title: string;
  intro?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`admin-card min-w-0 p-5 md:p-6 ${className}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="text-[17px] font-semibold text-navy">{title}</h2>
        {action ? <div className="t-small">{action}</div> : null}
      </div>
      {intro ? <p className="mt-1 t-small text-secondary">{intro}</p> : null}
      <div className="mt-4">{children}</div>
    </section>
  );
}

/** Honest state for data that is missing, failing, or synthetic. */
export function DataNotice({ state, message }: { state: "not_configured" | "error" | "preview" | "off"; message?: string }) {
  const copy = {
    not_configured: "Analytics isn't connected on this server yet (Supabase is not configured), so there is nothing to show.",
    error: message ?? "The analytics database could not be read right now.",
    preview: "Preview data: synthetic numbers for local design review. Not real visitors.",
    off: "First-party analytics storage is switched off (WEBSITE_ANALYTICS_WRITES_ENABLED), so no visitor events are being recorded yet.",
  }[state];
  const tone =
    state === "error"
      ? "border-error/30 bg-error-soft text-error"
      : state === "preview"
        ? "border-purple/30 bg-[#f3f0f8] text-purple"
        : "border-line bg-white text-secondary";
  return (
    <p role={state === "error" ? "alert" : "status"} className={`mt-6 rounded-md border px-4 py-3 t-small font-medium ${tone}`}>
      {copy}
    </p>
  );
}

export const RANGE_OPTIONS = [
  { key: "today", label: "Today" },
  { key: "7d", label: "7 days" },
  { key: "30d", label: "30 days" },
] as const;

/** Today / 7 days / 30 days / Custom, preserving any other query parameters. */
export function RangePicker({
  basePath,
  params,
  active,
  from,
  to,
  options = RANGE_OPTIONS,
  maxNote = "Up to the last 90 days (raw event retention).",
}: {
  basePath: string;
  params: Record<string, string | undefined>;
  active: string;
  from?: string;
  to?: string;
  options?: readonly { key: string; label: string }[];
  maxNote?: string;
}) {
  const keep = Object.fromEntries(Object.entries(params).filter(([k, v]) => v && !["range", "from", "to"].includes(k))) as Record<string, string>;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="inline-flex rounded-md border border-line bg-white p-0.5" role="group" aria-label="Date range">
        {options.map((o) => (
          <a
            key={o.key}
            href={`${basePath}?${new URLSearchParams({ ...keep, range: o.key })}`}
            aria-current={active === o.key ? "true" : undefined}
            className={`rounded-[6px] px-3 py-1.5 t-small font-semibold ${active === o.key ? "bg-navy text-white" : "text-navy hover:bg-soft"}`}
          >
            {o.label}
          </a>
        ))}
      </div>
      <details className="group relative">
        <summary
          className={`cursor-pointer list-none rounded-md border px-3 py-2 t-small font-semibold ${active === "custom" ? "border-navy bg-navy text-white" : "border-line bg-white text-navy hover:border-navy"}`}
        >
          {active === "custom" && from && to ? `${from} → ${to}` : "Custom"}
        </summary>
        <form action={basePath} className="absolute right-0 z-20 mt-2 w-[min(20rem,calc(100vw-2rem))] space-y-3 rounded-lg border border-line bg-white p-4 shadow-[0_12px_32px_rgba(0,49,83,0.14)]">
          {Object.entries(keep).map(([k, v]) => (
            <input key={k} type="hidden" name={k} value={v} />
          ))}
          <input type="hidden" name="range" value="custom" />
          <label className="block t-small font-semibold text-navy">
            From
            <input type="date" name="from" defaultValue={from} required className="admin-input mt-1" />
          </label>
          <label className="block t-small font-semibold text-navy">
            To
            <input type="date" name="to" defaultValue={to} required className="admin-input mt-1" />
          </label>
          <p className="t-caption text-secondary">{maxNote}</p>
          <button type="submit" className="admin-btn w-full">
            Apply
          </button>
        </form>
      </details>
    </div>
  );
}

/** Key → value rows for dense secondary signals. */
export function Facts({ items, columns = 1 }: { items: { label: string; value: ReactNode; sub?: ReactNode }[]; columns?: 1 | 2 }) {
  return (
    <dl className={`grid gap-x-8 ${columns === 2 ? "sm:grid-cols-2" : ""}`}>
      {items.map((i) => (
        <div key={i.label} className="flex items-baseline justify-between gap-4 border-b border-line py-2.5">
          <dt className="t-small text-secondary">{i.label}</dt>
          <dd className="min-w-0 text-right">
            <span className="text-[15px] font-semibold text-navy [overflow-wrap:anywhere]">{i.value}</span>
            {i.sub ? <span className="block t-caption text-secondary">{i.sub}</span> : null}
          </dd>
        </div>
      ))}
    </dl>
  );
}
