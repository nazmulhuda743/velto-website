import Link from "next/link";
import { AdminHeader, Badge, DataNotice, Notice, one, type SearchParams } from "@/components/admin/ui";
import { getFeedback, type FeedbackRow } from "@/lib/admin/customer-extras";
import { whatsappLink } from "@/lib/admin/retention-messages";
import { requireSection } from "@/lib/admin/session";
import { displayBdPhone } from "@/lib/customer/validation";
import { handleFeedbackAction } from "../../customer-actions";

const ISSUE: Record<string, string> = {
  missing_item: "Item missing",
  damage: "Damaged",
  stain: "Stain not removed",
  ironing: "Ironing / folding",
  smell: "Smell",
  late: "Late",
  service: "Staff / service",
  other: "Other",
};

const when = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", { timeZone: "Asia/Dhaka", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true });

/** Ratings from the last 30 days (a plain helper: the page renders on the server, per request). */
function lastMonth(rows: FeedbackRow[]) {
  const since = Date.now() - 30 * 86_400_000;
  return rows.filter((r) => Date.parse(r.createdAt) >= since);
}

function Stars({ n }: { n: number }) {
  return (
    <span className="whitespace-nowrap text-[18px] leading-none tracking-[1px]" aria-label={`${n} of 5`}>
      <span className="text-warning">{"★".repeat(n)}</span>
      <span className="text-line-strong">{"★".repeat(5 - n)}</span>
    </span>
  );
}

function Row({ r }: { r: FeedbackRow }) {
  const unhappy = r.rating <= 3;
  const message = `Hello${r.customerName ? ` ${r.customerName.split(" ")[0]}` : ""}, this is Velto. Thank you for rating order ${r.orderNumber}. We're sorry it wasn't right and would like to put it right.`;
  const wa = unhappy ? whatsappLink(r.customerPhone, message) : null;
  return (
    <li className="admin-card p-4 md:p-5" data-feedback-row={r.rating}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <Stars n={r.rating} />
            <span className="font-semibold text-navy">{r.orderNumber}</span>
            {unhappy ? r.handledAt ? <Badge tone="green">Handled</Badge> : <Badge tone="amber">Needs a call</Badge> : null}
          </div>
          <p className="mt-1 t-small text-secondary">
            {r.customerName ?? "Customer"}
            {r.customerPhone ? ` · ${displayBdPhone(r.customerPhone)}` : ""} · {when(r.createdAt)}
            {r.updatedAt !== r.createdAt ? ` (changed ${when(r.updatedAt)})` : ""}
          </p>
        </div>
        {unhappy && !r.handledAt ? (
          <form action={handleFeedbackAction}>
            <input type="hidden" name="id" value={r.id} />
            <input type="hidden" name="orderNumber" value={r.orderNumber} />
            <button type="submit" className="admin-btn-secondary">
              Mark handled
            </button>
          </form>
        ) : null}
      </div>
      {r.issues.length ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {r.issues.map((i) => (
            <Badge key={i}>{ISSUE[i] ?? i}</Badge>
          ))}
        </div>
      ) : null}
      {r.comment ? <p className="mt-3 max-w-[75ch] whitespace-pre-line text-body">“{r.comment}”</p> : null}
      {unhappy ? (
        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 t-small">
          {wa ? (
            <a href={wa} target="_blank" rel="noopener noreferrer" className="font-semibold text-action underline underline-offset-4">
              WhatsApp the customer ↗
            </a>
          ) : null}
          {r.customerPhone ? (
            <a href={`tel:${r.customerPhone}`} className="font-semibold text-action underline underline-offset-4">
              Call
            </a>
          ) : null}
          {r.taskId ? (
            <Link href={`/admin/board?task=${r.taskId}`} className="font-semibold text-action underline underline-offset-4">
              Task on the board
            </Link>
          ) : null}
          {r.handledAt ? <span className="text-secondary">Handled by {r.handledBy ?? "staff"}, {when(r.handledAt)}</span> : null}
        </div>
      ) : null}
    </li>
  );
}

export default async function FeedbackPage({ searchParams }: { searchParams: SearchParams }) {
  await requireSection("feedback");
  const params = await searchParams;
  const view = one(params.view) === "all" ? "all" : one(params.view) === "happy" ? "happy" : "open";
  const loaded = await getFeedback(500);
  const rows = loaded.state === "ok" ? loaded.data : [];
  const recent = lastMonth(rows);
  const avg = recent.length ? recent.reduce((n, r) => n + r.rating, 0) / recent.length : null;
  const open = rows.filter((r) => r.rating <= 3 && !r.handledAt);
  const shown = view === "open" ? open : view === "happy" ? rows.filter((r) => r.rating >= 4) : rows;

  const tabs = [
    { key: "open", label: `Needs a call (${open.length})` },
    { key: "happy", label: "Happy (4–5)" },
    { key: "all", label: "All" },
  ];

  return (
    <>
      <AdminHeader
        title="Customer feedback"
        intro="Ratings customers leave on delivered orders in their website account. 4–5 stars are invited to review Velto on Google; 1–3 stars open an urgent or high task on the board. Call or message, then mark it handled."
      />
      {loaded.state !== "ok" ? <DataNotice state={loaded.state} message={loaded.state === "error" ? loaded.message : undefined} /> : loaded.preview ? <DataNotice state="preview" /> : null}
      <Notice saved={one(params.saved)} error={one(params.error)} />

      <dl className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { label: "Average, last 30 days", value: avg === null ? "–" : `${avg.toFixed(1)} ★` },
          { label: "Ratings, last 30 days", value: String(recent.length) },
          { label: "Happy (4–5), last 30 days", value: recent.length ? `${Math.round((recent.filter((r) => r.rating >= 4).length / recent.length) * 100)}%` : "–" },
          { label: "Waiting for a call", value: String(open.length) },
        ].map((f) => (
          <div key={f.label} className="admin-card p-4">
            <dt className="t-caption uppercase tracking-[0.04em] text-secondary">{f.label}</dt>
            <dd className="mt-1 text-[24px] font-semibold text-navy tabular-nums">{f.value}</dd>
          </div>
        ))}
      </dl>

      <nav aria-label="Filter" className="mt-6 flex flex-wrap gap-2">
        {tabs.map((t) => (
          <Link
            key={t.key}
            href={`/admin/feedback${t.key === "open" ? "" : `?view=${t.key}`}`}
            aria-current={view === t.key ? "page" : undefined}
            className={`rounded-full px-4 py-2 t-small font-semibold ${view === t.key ? "bg-navy text-white" : "bg-soft text-navy hover:bg-line"}`}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      {shown.length ? (
        <ul className="mt-4 space-y-3">
          {shown.map((r) => (
            <Row key={r.id} r={r} />
          ))}
        </ul>
      ) : (
        <p className="mt-6 admin-card p-6 text-secondary">
          {view === "open" ? "Nothing waiting. Every unhappy rating has been handled." : "No ratings yet. They appear here as customers rate delivered orders in their account."}
        </p>
      )}
    </>
  );
}
