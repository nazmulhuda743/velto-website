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
