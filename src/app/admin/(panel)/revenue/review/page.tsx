import { RevenueTabs } from "@/components/admin/RevenueTabs";
import { AdminHeader, Badge, DataNotice, one, type SearchParams } from "@/components/admin/ui";
import { dayLabel } from "@/lib/admin/page-helpers";
import { getReviewQueue, type ReviewItem } from "@/lib/admin/revenue-data";
import { METHOD_LABELS } from "@/lib/admin/revenue-helpers";
import { reviewLinkAction } from "../../../revenue-actions";

export const metadata = { title: "Attribution review · Velto Command Center" };

const ISSUES: Record<ReviewItem["issue"], { title: string; body: string; tone: "amber" | "neutral" }> = {
  name_mismatch: {
    title: "Name differs from the customer record",
    body: "Linked by exact phone and already counted. The booking name shares no word with the Ops customer name — e.g. someone booking for a relative. Confirm to clear the flag, or reject if the link is wrong.",
    tone: "amber",
  },
  staff_link_other_customer: {
    title: "Staff link points to a different customer",
    body: "Staff linked this request to an order of another customer than the phone number matches. The staff link wins and is counted; check it is intended.",
    tone: "amber",
  },
  order_claimed_by_other_lead: {
    title: "Order already linked to another request",
    body: "Staff linked this request to an order another request is already staff-linked to. Not counted until resolved.",
    tone: "amber",
  },
  multiple_identifiers: {
    title: "Conflicting identifiers",
    body: "The request carries identifiers that point to different customers. Not counted until resolved.",
    tone: "amber",
  },
  staff_order_not_found: {
    title: "Staff order number not found",
    body: "The order number typed on the Ops task doesn't match an order with a customer. Correct it in Velto Ops; matching picks it up on the next run.",
    tone: "neutral",
  },
  unresolved_lead: {
    title: "Completed request with no attributable order",
    body: "Ops marked the task done, the window has closed and no order could be linked. If it became an order, add the order number to the Ops task.",
    tone: "neutral",
  },
};

export default async function ReviewPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const queue = await getReviewQueue();
  const items = queue.state === "ok" ? queue.data : [];
  const saved = one(params.saved);

  return (
    <>
      <AdminHeader
        title="Attribution review"
        intro="Only exceptional cases appear here. Normal exact-phone matches are counted automatically and never need approval. Every decision is kept in an audit trail."
      />
      <RevenueTabs active="/admin/revenue/review" reviewCount={items.length} />
      {queue.state === "not_configured" ? <DataNotice state="not_configured" /> : null}
      {queue.state === "error" ? <DataNotice state="error" message={queue.message} /> : null}
      {one(params.error) ? <DataNotice state="error" message={one(params.error)} /> : null}
      {saved ? (
        <p role="status" className="mt-6 rounded-md border border-success/30 bg-success-soft px-4 py-3 t-small font-medium text-success">
          Link {saved === "confirm" ? "confirmed" : saved === "reject" ? "rejected — it no longer counts" : "reversed — it no longer counts"}.
        </p>
      ) : null}

      {items.length === 0 && queue.state === "ok" ? (
        <p className="admin-card mt-6 p-6 t-small text-secondary">Nothing to review.</p>
      ) : (
        <ul className="mt-6 space-y-3">
          {items.map((it) => {
            const meta = ISSUES[it.issue];
            return (
              <li key={`${it.issue}-${it.link_id ?? it.lead_id}`} className="admin-card p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-navy">{meta.title}</p>
                    <p className="mt-1 max-w-[80ch] t-small text-secondary">{meta.body}</p>
                  </div>
                  <Badge tone={meta.tone}>{it.link_id ? "Counted" : "Not linked"}</Badge>
                </div>
                <dl className="mt-3 grid gap-x-8 gap-y-1 t-small sm:grid-cols-2 lg:grid-cols-4">
                  <div>
                    <dt className="text-secondary">Request</dt>
                    <dd className="font-semibold text-navy">
                      {it.lead_reference} · {it.lead_kind}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-secondary">Received</dt>
                    <dd className="text-navy">{dayLabel(it.lead_created_at)}</dd>
                  </div>
                  <div>
                    <dt className="text-secondary">Customer / order</dt>
                    <dd className="text-navy">{[it.customer_ref, it.order_number].filter(Boolean).join(" · ") || "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-secondary">{it.link_method ? "Linked by" : "Staff order number"}</dt>
                    <dd className="text-navy">{it.link_method ? METHOD_LABELS[it.link_method] ?? it.link_method : it.staff_order_number ?? "—"}</dd>
                  </div>
                </dl>
                {it.link_id ? (
                  <form action={reviewLinkAction} className="mt-4 flex flex-wrap items-center gap-2">
                    <input type="hidden" name="link_id" value={it.link_id} />
                    <input name="note" maxLength={200} placeholder="Note (optional)" className="admin-input w-full sm:w-64" aria-label="Review note" />
                    <button type="submit" name="action" value="confirm" className="admin-btn">
                      Confirm
                    </button>
                    <button type="submit" name="action" value="reject" className="admin-btn-secondary">
                      Reject
                    </button>
                    <button type="submit" name="action" value="reverse" className="admin-btn-danger">
                      Reverse link
                    </button>
                  </form>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
