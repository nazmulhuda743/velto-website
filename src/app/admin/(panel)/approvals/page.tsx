import Link from "next/link";
import { AdminHeader, Badge, DataNotice, Notice, one, type SearchParams } from "@/components/admin/ui";
import { getPriceChanges, type PriceChange } from "@/lib/admin/price-changes";
import { PRICE_FIELD_LABELS, priceDiff, priceJump, taka } from "@/lib/admin/price-diff";
import { requestDate } from "@/lib/admin/request-details";
import { requireSection } from "@/lib/admin/session";
import { decidePriceAction } from "../../price-actions";

const SERVICE_LABEL: Record<string, string> = { "Dry Cleaning": "Dry Cleaning", "Wash + Iron": "Wash & Iron", Ironing: "Ironing" };
const KIND_LABEL: Record<PriceChange["kind"], string> = { add: "New item", edit: "Price change", remove: "Remove", restore: "Restore" };
const SAVED: Record<string, string> = {
  approve: "Approved. Velto Ops and the website now use it.",
  reject: "Rejected. Nothing changed; your reason is saved with the request and in Activity.",
};

function Change({ c, open }: { c: PriceChange; open: boolean }) {
  const subject = c.proposed.item_name || c.before?.item_name || "Item";
  const service = c.proposed.service_category || c.before?.service_category;
  const diff = c.kind === "add" || c.kind === "edit" ? priceDiff(c.kind === "add" ? null : c.before, c.proposed) : [];
  const jump = c.kind === "edit" ? priceJump(c.before, c.proposed) : null;
  const staleInOps = c.kind !== "add" && c.before && c.current && c.current.updated_at !== c.before.updated_at;
  return (
    <li id={`c-${c.id}`} className="admin-card p-5 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="t-caption uppercase tracking-[0.04em] text-secondary">{KIND_LABEL[c.kind]}</p>
          <h2 className="mt-0.5 text-[18px] font-semibold text-navy">
            {subject}
            {service ? <span className="font-normal text-secondary"> · {SERVICE_LABEL[service] ?? service}</span> : null}
          </h2>
          <p className="t-small text-secondary">
            Asked by {c.requested_by_name} ({c.requested_by_role}) · {requestDate(c.requested_at)}
          </p>
        </div>
        <Badge tone={c.kind === "remove" ? "amber" : "blue"}>{KIND_LABEL[c.kind]}</Badge>
      </div>

      {c.reason ? <p className="mt-3 rounded-md bg-soft px-3 py-2 t-small text-body">“{c.reason}”</p> : null}

      {diff.length ? (
        <table className="mt-4 w-full t-small">
          <thead>
            <tr className="border-b border-line text-left text-secondary">
              <th className="py-1.5 pr-3 font-semibold">Field</th>
              {c.kind === "edit" ? <th className="py-1.5 pr-3 font-semibold">Now</th> : null}
              <th className="py-1.5 font-semibold">{c.kind === "edit" ? "After approval" : "Value"}</th>
            </tr>
          </thead>
          <tbody>
            {diff.map((d) => (
              <tr key={d.field} className="border-b border-line last:border-0">
                <th scope="row" className="py-1.5 pr-3 text-left font-medium text-navy">
                  {PRICE_FIELD_LABELS[d.field]}
                </th>
                {c.kind === "edit" ? <td className="py-1.5 pr-3 text-secondary line-through">{d.from}</td> : null}
                <td className="py-1.5 font-semibold text-navy">{d.to}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : c.kind === "edit" ? (
        <p className="mt-3 t-small text-secondary">No field changes.</p>
      ) : (
        <p className="mt-3 t-small text-body">
          {c.kind === "remove" ? "Ops will stop offering this price and the website will hide it. Ops keeps it in its history." : "Ops will offer this price again and the website will show it."}{" "}
          Current price: <span className="font-semibold text-navy">{taka(c.before?.price ?? null, c.before?.price_type)}</span>
        </p>
      )}

      {jump !== null && Math.abs(jump) >= 50 ? (
        <p role="alert" className="mt-3 rounded-md border border-[#e6c48a] bg-[#fff4e5] px-3 py-2 t-small font-medium text-[#8a5300]">
          Price {jump > 0 ? "rises" : "falls"} by {Math.abs(jump)}%. Check it isn&apos;t a typo before approving.
        </p>
      ) : null}
      {staleInOps ? (
        <p role="alert" className="mt-3 rounded-md border border-error/30 bg-error-soft px-3 py-2 t-small font-medium text-error">
          This price was changed in Velto Ops after the request. Approving will be refused; reject it and ask for a fresh request.
        </p>
      ) : null}

      <div className="mt-4 flex flex-wrap items-end gap-3 border-t border-line pt-4">
        <form action={decidePriceAction}>
          <input type="hidden" name="id" value={c.id} />
          <input type="hidden" name="decision" value="approve" />
          <button type="submit" className="admin-btn">
            Approve
          </button>
        </form>
        <details open={open} className="min-w-0 flex-1">
          <summary className="cursor-pointer t-small font-semibold text-error">Reject…</summary>
          <form action={decidePriceAction} className="mt-2 flex flex-wrap items-end gap-2">
            <input type="hidden" name="id" value={c.id} />
            <input type="hidden" name="decision" value="reject" />
            <label className="block min-w-[14rem] flex-1 t-small font-semibold text-navy">
              Reason (the requester sees this)
              <input name="note" required maxLength={500} className="admin-input mt-1" />
            </label>
            <button type="submit" className="admin-btn-danger">
              Reject
            </button>
          </form>
        </details>
      </div>
    </li>
  );
}

export default async function ApprovalsPage({ searchParams }: { searchParams: SearchParams }) {
  await requireSection("approvals");
  const params = await searchParams;
  const [pending, all] = await Promise.all([getPriceChanges("pending", 200), getPriceChanges("all", 60)]);
  const history = all.state === "ok" ? all.data.filter((c) => c.status !== "pending").slice(0, 40) : [];
  const saved = one(params.saved);

  return (
    <>
      <AdminHeader
        title="Approvals"
        intro="Price list changes waiting for an Owner. Approving writes the change to the Velto Ops price list, so Ops billing and the website change together. Nothing changes until you approve."
      />
      <Notice error={one(params.error)} />
      {saved && SAVED[saved] && !one(params.error) ? (
        <p role="status" className="mt-6 rounded-md border border-success/30 bg-success-soft px-4 py-3 t-small font-medium text-success">
          {SAVED[saved]}
        </p>
      ) : null}
      {pending.state === "ok" && pending.preview ? <DataNotice state="preview" /> : null}
      {pending.state === "error" ? <DataNotice state="error" message={pending.message} /> : null}
      {pending.state === "not_configured" ? <DataNotice state="not_configured" /> : null}

      <section aria-labelledby="waiting-title" className="mt-6">
        <h2 id="waiting-title" className="text-[20px] font-semibold text-navy">
          Waiting ({pending.state === "ok" ? pending.data.length : 0})
        </h2>
        {pending.state === "ok" && !pending.data.length ? (
          <p className="admin-card mt-3 p-5 text-secondary">
            Nothing waiting. Changes Managers make on{" "}
            <Link href="/admin/prices" className="font-semibold text-navy underline underline-offset-4">
              Prices
            </Link>{" "}
            will appear here.
          </p>
        ) : null}
        {pending.state === "ok" ? (
          <ul className="mt-3 space-y-4">
            {pending.data.map((c) => (
              <Change key={c.id} c={c} open={one(params.open) === c.id} />
            ))}
          </ul>
        ) : null}
      </section>

      {history.length ? (
        <section aria-labelledby="history-title" className="mt-10">
          <h2 id="history-title" className="text-[20px] font-semibold text-navy">
            Recent decisions
          </h2>
          <ul className="admin-card mt-3 divide-y divide-line">
            {history.map((c) => (
              <li key={c.id} className="flex flex-wrap items-baseline justify-between gap-2 px-4 py-2.5 t-small">
                <span className="text-navy">
                  <span className="font-semibold">{KIND_LABEL[c.kind]}:</span> {c.proposed.item_name || c.before?.item_name}
                  {c.kind === "add" || c.kind === "edit" ? ` → ${taka(c.proposed.price ?? null, c.proposed.price_type)}` : ""}
                  <span className="text-secondary"> · asked by {c.requested_by_name}</span>
                  {c.decision_note ? <span className="text-secondary"> · “{c.decision_note}”</span> : null}
                </span>
                <span className="flex items-center gap-2">
                  <Badge tone={c.status === "approved" ? "green" : c.status === "rejected" ? "amber" : "neutral"}>{c.status}</Badge>
                  <span className="text-secondary">
                    {c.decided_by_name ? `${c.decided_by_name}, ` : ""}
                    {c.decided_at ? requestDate(c.decided_at) : ""}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}
