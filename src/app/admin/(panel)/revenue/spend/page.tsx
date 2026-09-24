import { fmt } from "@/components/admin/charts";
import { RevenueTabs } from "@/components/admin/RevenueTabs";
import { SpendCsvImport } from "@/components/admin/SpendCsvImport";
import { DataTable, Td } from "@/components/admin/tables";
import { AdminHeader, DataNotice, Field, Panel, one, type SearchParams } from "@/components/admin/ui";
import type { SpendRow } from "@/lib/admin/revenue";
import { listSpend } from "@/lib/admin/revenue-data";
import { money, parseRevenueRange } from "@/lib/admin/revenue-helpers";
import { dhakaDay } from "@/lib/admin/insights";
import { isAdminPreview } from "@/lib/admin/preview";
import { isSupabaseConfigured } from "@/lib/supabase-server";
import { deleteSpendAction, saveSpendAction } from "../../../revenue-actions";

export const metadata = { title: "Campaign spend · Velto Command Center" };

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const PLATFORMS = ["facebook", "instagram", "google", "tiktok", "youtube", "whatsapp", "offline"];

function SpendForm({ row }: { row?: SpendRow }) {
  return (
    <form action={saveSpendAction} className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {row ? <input type="hidden" name="id" value={row.id} /> : null}
      <Field label="Date">
        <input type="date" name="date" required defaultValue={row?.spend_date ?? dhakaDay(new Date())} className="admin-input" />
      </Field>
      <Field label="Platform / source" hint="Use the utm_source you tag links with.">
        <input name="platform" required list="spend-platforms" defaultValue={row?.platform ?? "facebook"} maxLength={40} className="admin-input" />
        <datalist id="spend-platforms">
          {PLATFORMS.map((p) => (
            <option key={p} value={p} />
          ))}
        </datalist>
      </Field>
      <Field label="Medium">
        <input name="medium" defaultValue={row?.medium ?? "paid_social"} maxLength={60} className="admin-input" />
      </Field>
      <Field label="Campaign name" hint="Must equal the link's utm_campaign.">
        <input name="campaign_name" required defaultValue={row?.campaign_name ?? ""} maxLength={160} className="admin-input" placeholder="curtain_sep26" />
      </Field>
      <Field label="Spend">
        <input name="spend" required inputMode="decimal" defaultValue={row ? String(row.spend) : ""} className="admin-input" placeholder="2500" />
      </Field>
      <Field label="Currency">
        <input name="currency" defaultValue={row?.currency ?? "BDT"} maxLength={3} className="admin-input uppercase" />
      </Field>
      <Field label="Spend in BDT" hint="Only for non-BDT spend.">
        <input name="spend_bdt" inputMode="decimal" defaultValue={row && row.currency !== "BDT" ? String(row.spend_bdt) : ""} className="admin-input" />
      </Field>
      <Field label="Campaign ID (optional)">
        <input name="campaign_id" defaultValue={row?.campaign_id ?? ""} maxLength={80} className="admin-input" />
      </Field>
      <Field label="Ad set name (optional)">
        <input name="adset_name" defaultValue={row?.adset_name ?? ""} maxLength={160} className="admin-input" />
      </Field>
      <Field label="Ad set ID (optional)">
        <input name="adset_id" defaultValue={row?.adset_id ?? ""} maxLength={80} className="admin-input" />
      </Field>
      <Field label="Ad / content name (optional)">
        <input name="ad_name" defaultValue={row?.ad_name ?? ""} maxLength={160} className="admin-input" />
      </Field>
      <Field label="Ad / content ID (optional)">
        <input name="ad_id" defaultValue={row?.ad_id ?? ""} maxLength={80} className="admin-input" />
      </Field>
      <div className="md:col-span-2 xl:col-span-3">
        <Field label="Notes (optional)">
          <input name="notes" defaultValue={row?.notes ?? ""} maxLength={500} className="admin-input" />
        </Field>
      </div>
      <div className="flex items-end gap-2">
        <button type="submit" className="admin-btn">
          {row ? "Save changes" : "Add spend"}
        </button>
        {row ? (
          <a href="/admin/revenue/spend" className="admin-btn-secondary">
            Cancel
          </a>
        ) : null}
      </div>
    </form>
  );
}

export default async function SpendPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const fallback = parseRevenueRange({ range: "90d" });
  const from = DAY.test(one(params.from) ?? "") ? one(params.from)! : fallback.from;
  const to = DAY.test(one(params.to) ?? "") ? one(params.to)! : fallback.to;
  const campaign = (one(params.campaign) ?? "").trim().toLowerCase().slice(0, 80);

  let rows: SpendRow[] = [];
  let error: string | null = null;
  if (isSupabaseConfigured() || isAdminPreview()) {
    try {
      rows = await listSpend(from <= to ? from : to, to);
    } catch {
      error = "Campaign spend could not be read right now.";
    }
  }
  const shown = campaign ? rows.filter((r) => r.campaign_name.toLowerCase().includes(campaign)) : rows;
  const editId = one(params.edit);
  const editing = editId ? rows.find((r) => r.id === editId) : undefined;
  const deleteId = one(params.delete);
  const deleting = deleteId ? rows.find((r) => r.id === deleteId) : undefined;
  const total = shown.reduce((a, r) => a + Number(r.spend_bdt), 0);
  const byCampaign = [...shown.reduce((m, r) => m.set(r.campaign_name, (m.get(r.campaign_name) ?? 0) + Number(r.spend_bdt)), new Map<string, number>())].sort((a, b) => b[1] - a[1]);
  const saved = one(params.saved);

  return (
    <>
      <AdminHeader title="Campaign spend" intro="Record what each campaign cost, so CAC and ROAS can be calculated. Amounts are stored in BDT for reporting." />
      <RevenueTabs active="/admin/revenue/spend" />
      {!isSupabaseConfigured() && !isAdminPreview() ? <DataNotice state="not_configured" /> : null}
      {error || one(params.error) ? <DataNotice state="error" message={one(params.error) ?? error ?? undefined} /> : null}
      {saved ? (
        <p role="status" className="mt-6 rounded-md border border-success/30 bg-success-soft px-4 py-3 t-small font-medium text-success">
          Spend {saved}. Revenue reports are updated.
        </p>
      ) : null}

      {deleting ? (
        <section role="alertdialog" aria-labelledby="del-title" className="mt-6 rounded-lg border border-error/40 bg-error-soft p-5">
          <h2 id="del-title" className="font-semibold text-error">
            Delete this spend entry?
          </h2>
          <p className="mt-1 t-small text-body">
            {deleting.spend_date} · {deleting.platform} · {deleting.campaign_name} · {money(Number(deleting.spend_bdt))}. It will stop counting in CAC and ROAS.
            The entry is kept in the audit history.
          </p>
          <form action={deleteSpendAction} className="mt-3 flex gap-2">
            <input type="hidden" name="id" value={deleting.id} />
            <input type="hidden" name="confirm" value="yes" />
            <button type="submit" className="admin-btn-danger">
              Yes, delete
            </button>
            <a href="/admin/revenue/spend" className="admin-btn-secondary">
              Keep it
            </a>
          </form>
        </section>
      ) : null}

      <Panel className="mt-6" title={editing ? "Edit spend entry" : "Add spend"} intro="One row per day, platform, campaign, ad set and ad. A second entry for the same combination is rejected, so nothing is double-counted.">
        <SpendForm key={editing?.id ?? "new"} row={editing} />
      </Panel>

      <Panel className="mt-6" title="Import from CSV" intro="Preview first; duplicates and errors are shown before anything is saved.">
        <SpendCsvImport />
      </Panel>

      <Panel className="mt-6" title="Recorded spend" intro={`${fmt(shown.length)} entries · ${money(total)}`}>
        <form action="/admin/revenue/spend" className="mb-4 flex flex-wrap items-end gap-3">
          <label className="t-small font-semibold text-navy">
            From
            <input type="date" name="from" defaultValue={from} className="admin-input mt-1" />
          </label>
          <label className="t-small font-semibold text-navy">
            To
            <input type="date" name="to" defaultValue={to} className="admin-input mt-1" />
          </label>
          <label className="t-small font-semibold text-navy">
            Campaign contains
            <input name="campaign" defaultValue={campaign} className="admin-input mt-1" />
          </label>
          <button type="submit" className="admin-btn-secondary">
            Filter
          </button>
        </form>
        {byCampaign.length ? (
          <p className="mb-4 t-small text-secondary">
            {byCampaign.slice(0, 6).map(([c, v]) => (
              <span key={c} className="mr-4 inline-block">
                <span className="font-semibold text-navy">{c}</span> {money(v)}
              </span>
            ))}
          </p>
        ) : null}
        {shown.length === 0 ? (
          <p className="t-small text-secondary">No spend recorded in this period. CAC and ROAS show “Spend not recorded” until it is.</p>
        ) : (
          <DataTable leftCols={4} caption="Recorded spend" head={["Date", "Platform", "Campaign", "Ad set / ad", "Spend", "BDT", "Source", ""]}>
            {shown.slice(0, 500).map((r) => (
              <tr key={r.id}>
                <Td first>{r.spend_date}</Td>
                <Td left>{r.platform}</Td>
                <Td left className="max-w-[14rem] truncate">
                  {r.campaign_name}
                </Td>
                <Td left className="max-w-[12rem] truncate">
                  {[r.adset_name ?? r.adset_id, r.ad_name ?? r.ad_id].filter(Boolean).join(" / ") || "—"}
                </Td>
                <Td>
                  {Number(r.spend).toLocaleString("en-US")} {r.currency}
                </Td>
                <Td className="font-semibold">{money(Number(r.spend_bdt))}</Td>
                <Td>{r.import_source}</Td>
                <Td>
                  <a href={`/admin/revenue/spend?edit=${r.id}`} className="font-semibold text-navy underline underline-offset-4">
                    Edit
                  </a>{" "}
                  <a href={`/admin/revenue/spend?delete=${r.id}`} className="ml-2 font-semibold text-error underline underline-offset-4">
                    Delete
                  </a>
                </Td>
              </tr>
            ))}
          </DataTable>
        )}
      </Panel>
    </>
  );
}
