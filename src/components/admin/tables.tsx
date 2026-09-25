import type { ReactNode } from "react";
import { pct, type ConversionRow } from "@/lib/admin/insights";
import { fmt } from "./charts";

/** Scrollable data table; the first column stays readable on phones. */
export function DataTable({ head, children, caption, leftCols = 1, minWidth = "min-w-[640px]" }: { head: ReactNode[]; children: ReactNode; caption?: string; leftCols?: number; minWidth?: string }) {
  return (
    <div className="-mx-5 overflow-x-auto md:-mx-6">
      <table className={`w-full ${minWidth} border-collapse text-left`}>
        {caption ? <caption className="sr-only">{caption}</caption> : null}
        <thead>
          <tr className="border-b border-line">
            {head.map((h, i) => (
              <th key={i} scope="col" className={`whitespace-nowrap px-3 pb-2 t-caption font-semibold uppercase tracking-[0.04em] text-secondary first:pl-5 last:pr-5 md:first:pl-6 md:last:pr-6 ${i >= leftCols ? "text-right" : ""}`}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">{children}</tbody>
      </table>
    </div>
  );
}

export const Td = ({ children, first = false, left = false, wrap = false, className = "" }: { children: ReactNode; first?: boolean; left?: boolean; wrap?: boolean; className?: string }) =>
  first ? (
    <th scope="row" className={`${wrap ? "min-w-[11rem]" : "whitespace-nowrap"} px-3 py-2.5 pl-5 text-left text-[15px] font-semibold text-navy md:pl-6 ${className}`}>
      {children}
    </th>
  ) : (
    <td className={`whitespace-nowrap px-3 py-2.5 ${left ? "text-left" : "text-right"} tabular-nums text-[15px] text-navy last:pr-5 md:last:pr-6 ${className}`}>{children}</td>
  );

export function ConversionTable({ rows, label, caption, hideEmpty = false }: { rows: ConversionRow[]; label: string; caption: string; hideEmpty?: boolean }) {
  const shown = hideEmpty ? rows.filter((r) => r.sessions > 0) : rows;
  if (!shown.length) return <p className="t-small text-secondary">No sessions in this period.</p>;
  return (
    <DataTable caption={caption} head={[label, "Sessions", "Starts", "Bookings", "Quotes", "WhatsApp", "Conv."]}>
      {shown.map((r) => (
        <tr key={r.key} className={r.sessions ? "" : "text-secondary"}>
          <Td first>{r.label}</Td>
          <Td>{fmt(r.sessions)}</Td>
          <Td>{fmt(r.bookingStarts)}</Td>
          <Td>{fmt(r.bookings)}</Td>
          <Td>{fmt(r.quotes)}</Td>
          <Td>{fmt(r.whatsapp)}</Td>
          <Td className="font-semibold">{pct(r.conversionRate)}</Td>
        </tr>
      ))}
    </DataTable>
  );
}
