import { AdminHeader, Badge, DataNotice, one, type SearchParams } from "@/components/admin/ui";
import { cancelB999Action, decideB999Action, flagB999Action, linkB999OrderAction } from "@/app/admin/b999-actions";
import { getB999List, type B999Row } from "@/lib/admin/b999";
import { requireSection } from "@/lib/admin/session";
import { B999, b999Total, offeredDays, dhakaToday } from "@/lib/campaigns/b999";
import { displayBdPhone } from "@/lib/customer/validation";

export const metadata = { title: "Blanket ৳999 · Velto Command Center" };

const SAVED: Record<string, string> = {
  flagged: "Saved: price check needed. The total stays the same until the customer answers.",
  approved: "Saved: the customer approved the new price.",
  declined: "Saved: the customer declined. The declined blanket(s) go back unprocessed.",
  linked: "Ops order linked.",
  cancelled: "Booking cancelled. The day's place is free again.",
};

const day = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Dhaka" }) : "");
const num = "admin-input w-20";

function Counts({ r }: { r: B999Row }) {
  const fields: [string, string, number][] = [
    ["regular", "Regular in pack", r.proposedRegular ?? 3],
    ["heavy", "Heavy in pack", r.proposedHeavy ?? 0],
    ["extraRegular", "Extra regular", r.proposedExtraRegular ?? 0],
    ["extraHeavy", "Extra heavy", r.proposedExtraHeavy ?? 0],
  ];
  return (
    <div className="flex flex-wrap gap-3">
      {fields.map(([name, label, value]) => (
        <label key={name} className="grid gap-1 t-small font-semibold text-navy">
          {label}
          <input name={name} type="number" min={0} max={name.startsWith("extra") ? 30 : 3} defaultValue={value} className={num} />
        </label>
      ))}
    </div>
  );
}

function Row({ r }: { r: B999Row }) {
  const total = r.approvedTotal ?? B999.packagePrice;
  const status =
    r.status === "cancelled" ? <Badge>Cancelled</Badge>
    : r.priceStatus === "confirmation_required" ? <Badge tone="amber">Price check: waiting for the customer</Badge>
    : r.priceStatus === "approved" ? <Badge tone="green">Approved ৳{r.approvedTotal}</Badge>
    : r.priceStatus === "declined" ? <Badge tone="green">Declined heavy · now ৳{r.approvedTotal}</Badge>
    : <Badge tone="blue">৳999 locked</Badge>;
  const counts = { regular: r.proposedRegular ?? 3, heavy: r.proposedHeavy ?? 0, extraRegular: r.proposedExtraRegular ?? 0, extraHeavy: r.proposedExtraHeavy ?? 0 };
  return (
    <li id={`b${r.id}`} className="admin-card scroll-mt-6 p-4 md:p-5" data-b999-row>
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <p className="font-semibold text-navy">
            {r.reference} · {r.name}
          </p>
          <p className="t-small text-secondary">
            Sector {r.sector} · {r.address} · booked {when(r.createdAt)}
            {r.utmSource ? ` · from ${r.utmSource}${r.utmCampaign ? `/${r.utmCampaign}` : ""}` : ""}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {status}
            {r.orderNumber ? <Badge>{`Ops ${r.orderNumber}: ৳${r.orderTotal ?? "?"}`}</Badge> : null}
            {r.mismatch ? (
              <span className="inline-flex items-center rounded-full bg-error-soft px-2.5 py-0.5 t-caption font-semibold text-error" data-b999-mismatch>
                Mismatch: Ops says ৳{r.orderTotal}, should be ৳{total}
              </span>
            ) : null}
          </div>
          {r.priceStatus === "confirmation_required" ? (
            <p className="mt-2 t-small text-body">
              Proposed ৳{r.proposedTotal} ({r.proposedRegular} regular + {r.proposedHeavy} heavy in the pack, {r.proposedExtraRegular} + {r.proposedExtraHeavy} extra) by {r.flaggedBy}, {when(r.flaggedAt)}.
              {r.staffNote ? ` Note: ${r.staffNote.replace(/[.]$/, "")}.` : ""} Keep the order at ৳999 until the customer answers.
            </p>
          ) : null}
          {r.decidedAt ? (
            <p className="mt-2 t-small text-secondary">
              Answer recorded by {r.decidedBy} ({r.decisionChannel?.replace("_", " ")}), {when(r.decidedAt)}. Enter ৳{r.approvedTotal} in Ops.
            </p>
          ) : null}
        </div>
        <p className="t-small font-semibold tabular-nums text-navy">{displayBdPhone(r.phone)}</p>
      </div>

      {r.status === "booked" && (r.priceStatus === "locked" || r.priceStatus === "confirmation_required") ? (
        <details className="mt-3">
          <summary className="cursor-pointer t-small font-semibold text-blue">{r.priceStatus === "locked" ? "Heavy or extra blankets? Record a price check" : "Change the counts"}</summary>
          <form action={flagB999Action} className="mt-3 space-y-3 rounded-md bg-soft p-3">
            <input type="hidden" name="id" value={r.id} />
            <Counts r={r} />
            <input name="note" placeholder="What you saw (optional)" maxLength={500} className="admin-input w-full" />
            <p className="t-caption text-secondary">
              Price is worked out by the rules: 3 in the pack = ৳999 + ৳50 per heavy; extras ৳400 / ৳450; fewer than 3 = list price. Then call the customer.
            </p>
            <button type="submit" className="admin-btn-secondary">
              Save: needs the customer&apos;s approval
            </button>
          </form>
        </details>
      ) : null}

      {r.status === "booked" && r.priceStatus === "confirmation_required" ? (
        <form action={decideB999Action} className="mt-3 flex flex-wrap items-end gap-2 rounded-md border border-line p-3">
          <input type="hidden" name="id" value={r.id} />
          {Object.entries(counts).map(([k, v]) => (
            <input key={k} type="hidden" name={k} value={v} />
          ))}
          <label className="grid gap-1 t-small font-semibold text-navy">
            Customer answered by
            <select name="channel" className="admin-input" defaultValue="phone">
              <option value="phone">Phone</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="in_person">In person</option>
            </select>
          </label>
          <button type="submit" name="decision" value="approved" className="admin-btn">
            Approved ৳{r.proposedTotal}
          </button>
          <label className="grid gap-1 t-small font-semibold text-navy">
            Heavy declined
            <input name="declinedHeavy" type="number" min={0} max={counts.heavy} defaultValue={counts.heavy} className={num} />
          </label>
          <button type="submit" name="decision" value="declined" className="admin-btn-secondary">
            Declined (return them, recalculate)
          </button>
          <p className="w-full t-caption text-secondary">
            If declined: {counts.heavy} heavy returned unprocessed → ৳{b999Total({ ...counts, heavy: 0 }).total} for the rest.
          </p>
        </form>
      ) : null}

      {r.status === "booked" ? (
        <div className="mt-3 flex flex-wrap items-end gap-2">
          {!r.orderNumber ? (
            <form action={linkB999OrderAction} className="flex flex-wrap items-end gap-2">
              <input type="hidden" name="id" value={r.id} />
              <input name="order" placeholder="VEL-01234" className="admin-input w-36" aria-label="Ops order number" />
              <button type="submit" className="admin-btn-secondary">
                Link Ops order
              </button>
            </form>
          ) : null}
          <form action={cancelB999Action}>
            <input type="hidden" name="id" value={r.id} />
            <button type="submit" className="admin-btn-secondary">
              Cancel booking
            </button>
          </form>
        </div>
      ) : null}
    </li>
  );
}

export default async function B999AdminPage({ searchParams }: { searchParams: SearchParams }) {
  await requireSection("dispatch");
  const params = await searchParams;
  const list = await getB999List(30);
  const rows = list.state === "ok" ? list.rows : [];
  const booked = rows.filter((r) => r.status === "booked");
  const upcoming = offeredDays(dhakaToday());
  const perDay = Object.fromEntries(upcoming.map((d) => [d, booked.filter((r) => r.pickupDate === d).length]));
  const saved = one(params.saved);
  const error = one(params.error);

  return (
    <>
      <AdminHeader
        title="Blanket ৳999"
        intro="B999-WEB bookings from /blanket-cleaning-uttara: 3 Regular/Medium blankets, ৳999, pay at delivery. No first-order 10% or coupon. If a blanket is heavy or there are extras, record a price check here first, call the customer, then record their answer. Enter the recorded price in Ops."
        actions={
          <a href="/blanket-cleaning-uttara" target="_blank" rel="noopener noreferrer" className="admin-btn-secondary">
            Open the page ↗
          </a>
        }
      />
      {list.state === "not_configured" ? <DataNotice state="not_configured" /> : null}
      {list.state === "error" ? <DataNotice state="error" message={list.message} /> : null}
      {error ? (
        <p role="alert" className="mt-6 rounded-md border border-error/30 bg-error-soft px-4 py-3 t-small font-medium text-error">
          {error}
        </p>
      ) : saved && SAVED[saved] ? (
        <p role="status" className="mt-6 rounded-md border border-success/30 bg-success-soft px-4 py-3 t-small font-medium text-success">
          {SAVED[saved]}
        </p>
      ) : null}

      <section aria-labelledby="days-title" className="admin-card mt-6 p-5">
        <h2 id="days-title" className="t-h4 text-navy">
          Pickup days · {B999.dailyCap} per day
        </h2>
        <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
          {upcoming.map((d) => (
            <li key={d} className={`rounded-md border p-3 ${perDay[d] >= B999.dailyCap ? "border-error/40 bg-error-soft" : "border-line"}`}>
              <p className="t-small font-semibold text-navy">{day(d)}</p>
              <p className="text-[20px] font-semibold tabular-nums text-navy">
                {perDay[d]}/{B999.dailyCap}
              </p>
              <p className="t-caption text-secondary">{perDay[d] >= B999.dailyCap ? "Full" : "Open"}</p>
            </li>
          ))}
        </ul>
      </section>

      {list.state === "ok" ? (
        rows.length ? (
          <ul className="mt-6 space-y-3">
            {rows.map((r) => (
              <Row key={r.id} r={r} />
            ))}
          </ul>
        ) : (
          <p className="mt-6 admin-card p-5 t-small text-body">No B999 bookings yet.</p>
        )
      ) : null}
    </>
  );
}
