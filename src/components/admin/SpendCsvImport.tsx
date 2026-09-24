"use client";

import { useActionState } from "react";
import { csvSpendAction, type CsvState } from "@/app/admin/revenue-actions";

const money = (v: number) => `৳${Math.round(v).toLocaleString("en-US")}`;

/** CSV import: upload → validated preview (errors + duplicates shown) → explicit confirm. */
export function SpendCsvImport() {
  const [state, action, pending] = useActionState<CsvState, FormData>(csvSpendAction, { stage: "idle" });

  if (state.stage === "preview") {
    const { preview } = state;
    const errors = preview.rows.filter((r) => r.error);
    const dupes = preview.rows.filter((r) => r.duplicate);
    const total = preview.valid.reduce((a, r) => a + r.spend_bdt, 0);
    return (
      <div>
        <p className="t-small text-body">
          <span className="font-semibold text-navy">{state.fileName}</span>: {preview.valid.length} row{preview.valid.length === 1 ? "" : "s"} ready ({money(total)}),{" "}
          {dupes.length} duplicate{dupes.length === 1 ? "" : "s"} skipped, {errors.length} with errors.
        </p>
        <div className="mt-3 max-h-[320px] overflow-auto rounded-md border border-line">
          <table className="w-full min-w-[640px] text-left t-small">
            <thead className="sticky top-0 bg-soft">
              <tr>
                {["Line", "Date", "Platform", "Campaign", "Ad set / ad", "BDT", "Status"].map((h) => (
                  <th key={h} scope="col" className="px-3 py-2 font-semibold text-secondary">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {preview.rows.map((r) => (
                <tr key={r.line} className={r.error ? "bg-error-soft" : r.duplicate ? "bg-[#fff8ec]" : ""}>
                  <td className="px-3 py-1.5 tabular-nums">{r.line}</td>
                  <td className="px-3 py-1.5">{r.value?.spend_date ?? "—"}</td>
                  <td className="px-3 py-1.5">{r.value?.platform ?? "—"}</td>
                  <td className="px-3 py-1.5">{r.value?.campaign_name ?? "—"}</td>
                  <td className="px-3 py-1.5">{[r.value?.adset_name ?? r.value?.adset_id, r.value?.ad_name ?? r.value?.ad_id].filter(Boolean).join(" / ") || "—"}</td>
                  <td className="px-3 py-1.5 tabular-nums">{r.value ? money(r.value.spend_bdt) : "—"}</td>
                  <td className="px-3 py-1.5 font-semibold">
                    {r.error ? <span className="text-error">{r.error}</span> : r.duplicate === "existing" ? "Already recorded — skipped" : r.duplicate === "file" ? "Repeated in file — skipped" : <span className="text-success">Ready</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <form action={action} className="mt-4 flex flex-wrap items-center gap-3">
          <input type="hidden" name="mode" value="confirm" />
          <input type="hidden" name="payload" value={state.payload} />
          <button type="submit" className="admin-btn" disabled={pending || preview.valid.length === 0}>
            {pending ? "Importing…" : `Import ${preview.valid.length} row${preview.valid.length === 1 ? "" : "s"}`}
          </button>
          <a href="/admin/revenue/spend" className="admin-btn-secondary">
            Cancel
          </a>
        </form>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-3">
      {state.stage === "done" ? (
        <p role="status" className="rounded-md border border-success/30 bg-success-soft px-4 py-3 t-small font-medium text-success">
          Imported {state.imported} row{state.imported === 1 ? "" : "s"}.
        </p>
      ) : null}
      {state.stage === "error" ? (
        <p role="alert" className="rounded-md border border-error/30 bg-error-soft px-4 py-3 t-small font-medium text-error">
          {state.error}
        </p>
      ) : null}
      <input type="hidden" name="mode" value="preview" />
      <label className="block">
        <span className="block text-[15px] font-semibold text-navy">CSV file</span>
        <span className="block t-small text-secondary">
          Columns: date, platform, campaign_name, spend (required) · medium, campaign_id, adset_name, adset_id, ad_name, ad_id, currency, spend_bdt,
          notes. Dates as YYYY-MM-DD. Non-BDT rows need spend_bdt.
        </span>
        <input type="file" name="file" accept=".csv,text/csv" required className="mt-2 block w-full t-small" />
      </label>
      <button type="submit" className="admin-btn-secondary" disabled={pending}>
        {pending ? "Checking…" : "Preview import"}
      </button>
    </form>
  );
}
