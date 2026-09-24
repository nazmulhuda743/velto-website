import type { ReactNode } from "react";

/** Label/value rows with structural rules (homepage turnaround-block style). */
export function FactRows({
  rows,
  className = "",
}: {
  rows: { label: string; value: ReactNode }[];
  className?: string;
}) {
  return (
    <dl className={`border-t border-navy ${className}`}>
      {rows.map((row) => (
        <div key={row.label} className="border-b border-line py-4">
          <dt className="t-label uppercase text-navy">{row.label}</dt>
          <dd className="mt-1 text-body">{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}
