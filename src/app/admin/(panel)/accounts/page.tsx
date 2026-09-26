import { AdminHeader, Badge, Notice, one, type SearchParams } from "@/components/admin/ui";
import { getLinkRequests, type LinkRequest } from "@/lib/admin/data";
import { requestDate } from "@/lib/admin/request-details";
import { decideLinkAction } from "../../actions";
import { requireSection } from "@/lib/admin/session";

const SAVED: Record<string, string> = {
  approve: "Linked. The customer can now see their Velto orders.",
  reject: "Request rejected. The customer can correct their number and ask again.",
  unlink: "Account unlinked.",
};

function Request({ r }: { r: LinkRequest }) {
  const c = r.candidate;
  return (
    <li className="admin-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-navy">{r.fullName}</p>
          <p className="t-small text-secondary">
            {r.email} · asked {r.requestedAt ? requestDate(r.requestedAt) : "—"}
          </p>
        </div>
        <Badge tone={r.status === "pending" ? "amber" : r.status === "linked" ? "green" : "neutral"}>{r.status}</Badge>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div className="rounded-md bg-soft p-4">
          <p className="t-caption uppercase tracking-[0.04em] text-secondary">Number the customer gave</p>
          <p className="mt-1 text-lg font-semibold text-navy">{r.phone}</p>
        </div>
        <div className="rounded-md bg-soft p-4">
          <p className="t-caption uppercase tracking-[0.04em] text-secondary">Velto customer with this number</p>
          {c ? (
            <>
              <p className="mt-1 font-semibold text-navy">
                {c.name} {c.code ? <span className="font-normal text-secondary">· {c.code}</span> : null}
              </p>
              <p className="t-small text-secondary">
                {c.orders} orders{c.lastOrder ? ` · last ${c.lastOrder}` : ""}
                {c.zone ? ` · ${c.zone}` : ""}
              </p>
              {c.alreadyLinked && r.status !== "linked" ? <p className="mt-1 t-small font-semibold text-error">Already linked to another account.</p> : null}
            </>
          ) : (
            <p className="mt-1 t-small text-secondary">No Velto customer has this number, so there&apos;s nothing to link yet.</p>
          )}
        </div>
      </div>

      {r.status === "pending" ? (
        <form action={decideLinkAction} className="mt-4 space-y-3">
          <input type="hidden" name="authUserId" value={r.authUserId} />
          {c && !c.alreadyLinked ? (
            <label className="flex items-start gap-2 t-small text-body">
              <input type="checkbox" name="confirmed" className="mt-0.5 size-4" />
              <span>
                I called <strong>{c.phone}</strong> (the number on the Velto record) and the person confirmed they created this account.
              </span>
            </label>
          ) : null}
          <div className="flex flex-wrap gap-2">
            {c && !c.alreadyLinked ? (
              <button type="submit" name="decision" value="approve" className="admin-btn">
                Approve link
              </button>
            ) : null}
            <button type="submit" name="decision" value="reject" className="admin-btn-secondary">
              Reject
            </button>
            <a href={`tel:${c?.phone ?? r.phone}`} className="admin-btn-secondary">
              Call {c?.phone ?? r.phone}
            </a>
          </div>
        </form>
      ) : r.status === "linked" ? (
        <form action={decideLinkAction} className="mt-4 flex flex-wrap items-center gap-3">
          <input type="hidden" name="authUserId" value={r.authUserId} />
          <p className="t-small text-secondary">
            Linked by {r.decidedBy ?? "staff"}
            {r.decidedAt ? ` on ${requestDate(r.decidedAt)}` : ""}.
          </p>
          <button type="submit" name="decision" value="unlink" className="admin-btn-danger">
            Unlink
          </button>
        </form>
      ) : null}
    </li>
  );
}

export default async function AccountsPage({ searchParams }: { searchParams: SearchParams }) {
  await requireSection("accounts");
  const params = await searchParams;
  const view = one(params.view) === "all" ? "all" : "pending";
  let rows: LinkRequest[] = [];
  let error = false;
  try {
    rows = await getLinkRequests(view);
  } catch {
    error = true;
  }
  const saved = one(params.saved);

  return (
    <>
      <AdminHeader
        title="Customer accounts"
        intro="Customers who asked to see their past Velto orders. Approve only after calling the number on the Velto record and hearing the customer confirm it."
      />
      <Notice error={one(params.error)} />
      {saved && SAVED[saved] && !one(params.error) ? (
        <p role="status" className="mt-6 rounded-md border border-success/30 bg-success-soft px-4 py-3 t-small font-medium text-success">
          {SAVED[saved]}
        </p>
      ) : null}
      <div className="mt-6 flex gap-2">
        {(["pending", "all"] as const).map((v) => (
          <a
            key={v}
            href={`/admin/accounts${v === "all" ? "?view=all" : ""}`}
            aria-current={view === v ? "page" : undefined}
            className={`rounded-full border px-4 py-1.5 t-small font-semibold ${view === v ? "border-navy bg-navy text-white" : "border-line bg-white text-navy hover:border-navy"}`}
          >
            {v === "pending" ? "Waiting for verification" : "All accounts"}
          </a>
        ))}
      </div>
      {error ? (
        <p className="mt-6 t-small text-error">Couldn&apos;t load customer accounts. Has the customer portal SQL been applied to this project?</p>
      ) : rows.length === 0 ? (
        <p className="mt-6 admin-card p-5 t-small text-secondary">{view === "pending" ? "No requests waiting." : "No customer accounts yet."}</p>
      ) : (
        <ul className="mt-6 space-y-4">
          {rows.map((r) => (
            <Request key={r.authUserId} r={r} />
          ))}
        </ul>
      )}
    </>
  );
}
