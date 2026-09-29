import Link from "next/link";
import { NotificationRefresher } from "@/components/admin/NotificationRefresher";
import { AdminHeader, Badge, DataNotice, one, type SearchParams } from "@/components/admin/ui";
import { WhatsAppSend } from "@/components/admin/WhatsAppSend";
import { getDispatch, getRequestContext, getStaff, type StaffMember } from "@/lib/admin/dispatch";
import {
  addDays,
  CANCEL_REASONS,
  dayName,
  dayPlan,
  DEFAULT_CAPACITY,
  daysSince,
  DELIVERY_BUCKETS,
  DELIVERY_CLOSE_REASONS,
  deliveryBucket,
  dhakaToday,
  findOverlaps,
  isOpen,
  needsPlan,
  SLOTS,
  slotLabel,
  suggestedSlot,
  waited,
  type DispatchJob,
  type JobKind,
  type Overlap,
  type SlotId,
} from "@/lib/admin/dispatch-logic";
import { readyMessage, type LinkedOrder } from "@/lib/admin/request-flow";
import { whatsappLink } from "@/lib/admin/retention-messages";
import { requireSection } from "@/lib/admin/session";
import { canEditCapacity } from "@/lib/admin/permissions";
import { OVERRIDE_REASONS } from "@/lib/capacity-logic";
import { getOrderCounts, getPhoneFlags } from "@/lib/admin/customer-extras";
import { loyaltyStatus } from "@/lib/customer/loyalty";
import { getSiteContent } from "@/lib/site-content";
import { closeAction, combineAction, mergeAction, planAction, splitAction } from "../../dispatch-actions";

export const metadata = { title: "Pickup & delivery · Velto Command Center" };

const SAVED: Record<string, string> = {
  planned: "Saved. The person sees it in Velto Ops under “Assigned to me”.",
  done: "Marked done.",
  cancelled: "Closed with your reason. The Velto Ops task is closed too.",
  merged: "Merged. The duplicate is closed in Velto Ops.",
  combined: "Combined into one trip: same person, same slot.",
  split: "Taken out of the trip.",
};

const STAGE: Record<string, { label: string; tone: "neutral" | "blue" | "green" | "amber" }> = {
  new: { label: "New", tone: "amber" },
  confirmed: { label: "Confirmed · needs a person", tone: "amber" },
  assigned: { label: "Needs a slot", tone: "amber" },
  picked: { label: "Picked up", tone: "green" },
  scheduled: { label: "Scheduled", tone: "blue" },
  done: { label: "Done", tone: "green" },
  cancelled: { label: "Cancelled", tone: "neutral" },
  merged: { label: "Merged", tone: "neutral" },
};

const waLink = (phone: string) => {
  const d = phone.replace(/\D/g, "");
  return `https://wa.me/${d.startsWith("880") ? d : d.startsWith("0") ? `88${d}` : d}`;
};
const label = (j: DispatchJob) => `${j.kind === "delivery" ? `Delivery ${j.order_number}` : j.source === "website_quote" ? "Quote" : "Pickup"} – ${j.customer_name ?? "customer"}`;

/** One form to give a stop a person and a slot (or change them). */
function PlanForm({ job, staff, today, keep, suggestion, canOverride }: { job: DispatchJob; staff: StaffMember[]; today: string; keep: string; suggestion: { date: string | null; slot: string | null }; canOverride: boolean }) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(today, i));
  const day = job.slot_date ?? suggestion.date ?? "";
  if (day && !days.includes(day)) days.push(day);
  return (
    <form action={planAction} className="grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end">
      <input type="hidden" name="job" value={job.id} />
      <input type="hidden" name="label" value={label(job)} />
      <input type="hidden" name="keep" value={keep} />
      <label className="block t-caption font-semibold text-secondary">
        Person
        <select name="person" defaultValue={job.assignee_id ?? ""} className="admin-input mt-1">
          <option value="">Not assigned</option>
          {staff.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </label>
      <label className="block t-caption font-semibold text-secondary">
        Day
        <select name="day" defaultValue={day} className="admin-input mt-1">
          <option value="">No day yet</option>
          {days.map((d) => (
            <option key={d} value={d}>
              {d === today ? `Today, ${dayName(d)}` : d === addDays(today, 1) ? `Tomorrow, ${dayName(d)}` : dayName(d)}
            </option>
          ))}
        </select>
      </label>
      <label className="block t-caption font-semibold text-secondary">
        Slot
        <select name="slot" defaultValue={job.slot ?? suggestion.slot ?? ""} className="admin-input mt-1">
          <option value="">No slot yet</option>
          {SLOTS.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label} ({s.hours})
            </option>
          ))}
        </select>
      </label>
      <button type="submit" className="admin-btn">
        Save
      </button>
      {canOverride ? (
        // Only when the window is full: the stop is booked over capacity, with the reason on record.
        <details className="sm:col-span-4">
          <summary className="cursor-pointer t-caption font-semibold text-secondary hover:text-navy">Window full? Book over capacity</summary>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <select name="override" defaultValue="" className="admin-input" aria-label="Reason for booking over capacity">
              <option value="">No, keep within capacity</option>
              {OVERRIDE_REASONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
              <option value="other">Other reason…</option>
            </select>
            <input name="overrideOther" maxLength={200} placeholder="Other reason" className="admin-input" aria-label="Other reason" />
          </div>
        </details>
      ) : null}
    </form>
  );
}

function CloseForms({ job, keep }: { job: DispatchJob; keep: string }) {
  return (
    <div className="flex flex-wrap items-start gap-2">
      {job.kind === "pickup" && job.stage === "scheduled" ? (
        <form action={closeAction}>
          <input type="hidden" name="job" value={job.id} />
          <input type="hidden" name="outcome" value="done" />
          <input type="hidden" name="label" value={label(job)} />
          <input type="hidden" name="keep" value={keep} />
          <button type="submit" className="admin-btn-secondary">
            Picked up
          </button>
        </form>
      ) : null}
      <details className="group/cancel">
        <summary className="admin-btn-danger cursor-pointer list-none">{job.kind === "delivery" ? "Take off the board…" : "Cancel…"}</summary>
        <form action={closeAction} className="mt-2 grid gap-2 rounded-md border border-line bg-soft p-3 sm:w-[340px]">
          <input type="hidden" name="job" value={job.id} />
          <input type="hidden" name="outcome" value="cancelled" />
          <input type="hidden" name="label" value={label(job)} />
          <input type="hidden" name="keep" value={keep} />
          <label className="block t-caption font-semibold text-secondary">
            Reason
            <select name="reason" className="admin-input mt-1" defaultValue={(job.kind === "delivery" ? DELIVERY_CLOSE_REASONS : CANCEL_REASONS)[0]}>
              {(job.kind === "delivery" ? DELIVERY_CLOSE_REASONS : CANCEL_REASONS).map((r) => (
                <option key={r}>{r}</option>
              ))}
              <option value="other">Other (write below)</option>
            </select>
          </label>
          <input name="other" maxLength={200} placeholder="Other reason" className="admin-input" aria-label="Other reason" />
          <button type="submit" className="admin-btn-danger">
            {job.kind === "delivery" ? "Take it off the board" : "Cancel this pickup"}
          </button>
          {job.kind === "delivery" ? <p className="t-caption text-secondary">The order stays Ready in Velto Ops. It comes back here if the order changes in Ops.</p> : null}
        </form>
      </details>
    </div>
  );
}

function OrderLine({ order, today }: { order: LinkedOrder; today: string }) {
  const readyDays = daysSince(order.updatedAt);
  return (
    <p className="t-small text-navy">
      {order.items ? `${order.items} item${order.items === 1 ? "" : "s"} · ` : ""}
      {order.total !== null ? `৳${order.total.toLocaleString("en-US")}` : ""}
      {order.due ? <span className="font-semibold text-error"> · collect ৳{order.due.toLocaleString("en-US")}</span> : order.total ? <span className="text-success"> · paid</span> : null}
      <span className="text-secondary">
        {order.deliveryDate ? ` · delivery date ${order.deliveryDate === today ? "today" : dayName(order.deliveryDate)}` : " · no delivery date in Ops"}
        {readyDays >= 1 ? ` · ${order.status} for ${readyDays} day${readyDays === 1 ? "" : "s"}` : ""}
      </span>
    </p>
  );
}

/** "Your order is ready" (with the planned delivery when there is one), Bangla or English. */
function ReadyWhatsApp({ job }: { job: DispatchJob }) {
  const facts = { name: job.customer_name, orderNumber: job.order_number!, date: job.assignee_id ? job.slot_date : null, slot: job.assignee_id ? (job.slot as SlotId | null) : null };
  const bn = whatsappLink(job.phone, readyMessage(facts, "bn"));
  const en = whatsappLink(job.phone, readyMessage(facts, "en"));
  return bn && en ? <WhatsAppSend job={job.id} kind="ready" label="Tell the customer on WhatsApp:" links={{ bn, en }} /> : null;
}

/** "Gold · 9 orders" (tier while loyalty is on) or "9 orders": who is a regular, at a glance. */
type Regular = { label: string; tone: "blue" | "neutral" };

function JobCard({ job, staff, today, keep, trip, order, regular, canOverride = false, flagged }: { job: DispatchJob; staff: StaffMember[]; today: string; keep: string; trip?: boolean; order?: LinkedOrder | null; regular?: Regular; canOverride?: boolean; flagged?: boolean }) {
  const suggestion = suggestedSlot(job.requested, job.created_at, today);
  const stage = STAGE[job.stage];
  return (
    <li className={`rounded-md border bg-white ${trip ? "border-blue/40" : "border-line"}`} data-job={job.id}>
      <details className="group">
        <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3">
          <Badge tone={stage.tone}>{stage.label}</Badge>
          {job.kind === "delivery" ? <span className="t-small font-semibold text-navy">{job.order_number}</span> : job.source === "website_quote" ? <Badge tone="amber">Quote</Badge> : null}
          <span className="font-semibold text-navy">{job.customer_name ?? "Customer"}</span>
          <span className="t-small text-secondary">{job.area ?? ""}</span>
          {regular ? <Badge tone={regular.tone}>{regular.label}</Badge> : null}
          {job.requested?.includes("(changed by the customer)") ? <Badge tone="amber">Changed by customer</Badge> : null}
          {flagged ? <Badge tone="amber">Number may have changed</Badge> : null}
          {trip ? <span className="t-caption font-semibold text-blue">⛓ One trip</span> : null}
          <span className="ml-auto t-small text-secondary">
            {job.slot_date
              ? `${dayName(job.slot_date)} · ${slotLabel(job.slot)}`
              : job.kind === "delivery" && order
                ? order.deliveryDate
                  ? `Due ${order.deliveryDate === today ? "today" : dayName(order.deliveryDate)}`
                  : "No delivery date"
                : job.requested
                  ? `Asked: ${job.requested}`
                  : `Waiting ${waited(job.created_at)}`}
            {job.assignee_name ? ` · ${job.assignee_name}` : ""}
          </span>
        </summary>
        <div className="space-y-4 border-t border-line px-4 py-4">
          {job.kind === "delivery" && order ? <OrderLine order={order} today={today} /> : null}
          <dl className="grid gap-x-6 gap-y-1 t-small sm:grid-cols-2">
            <div>
              <dt className="text-secondary">Address</dt>
              <dd className="text-navy [overflow-wrap:anywhere]">{[job.address, job.area].filter(Boolean).join(", ") || "Not given"}</dd>
            </div>
            <div>
              <dt className="text-secondary">{job.kind === "delivery" ? "Delivery" : "Customer asked for"}</dt>
              <dd className="text-navy">
                {job.kind === "delivery" && order ? (order.deliveryDate ? `Date in Ops: ${dayName(order.deliveryDate)}` : "No date in Ops yet") : (job.requested ?? "No preference")}
              </dd>
            </div>
            <div>
              <dt className="text-secondary">Came in</dt>
              <dd className="text-navy">{waited(job.created_at)} ago</dd>
            </div>
            {job.reason ? (
              <div>
                <dt className="text-secondary">Reason</dt>
                <dd className="text-navy">{job.reason}</dd>
              </div>
            ) : null}
          </dl>
          <div className="flex flex-wrap gap-2">
            {job.phone ? (
              <>
                <a href={`tel:${job.phone.replace(/[^\d+]/g, "")}`} className="admin-btn-secondary">
                  Call {job.phone}
                </a>
                <a href={waLink(job.phone)} target="_blank" rel="noopener noreferrer" className="admin-btn-secondary">
                  WhatsApp
                </a>
              </>
            ) : null}
            {job.kind === "pickup" ? (
              <Link href={`/admin/requests?${new URLSearchParams({ stage: "all", open: job.id })}#r-${job.id}`} className="admin-btn-secondary">
                Open the booking
              </Link>
            ) : null}
          </div>
          {job.kind === "delivery" && job.order_number && isOpen(job) ? <ReadyWhatsApp job={job} /> : null}
          {isOpen(job) ? (
            <>
              <PlanForm job={job} staff={staff} today={today} keep={keep} suggestion={suggestion} canOverride={canOverride} />
              <div className="flex flex-wrap items-start gap-2">
                <CloseForms job={job} keep={keep} />
                {job.trip_key ? (
                  <form action={splitAction}>
                    <input type="hidden" name="job" value={job.id} />
                    <input type="hidden" name="label" value={label(job)} />
                    <input type="hidden" name="keep" value={keep} />
                    <button type="submit" className="admin-btn-secondary">
                      Take out of trip
                    </button>
                  </form>
                ) : null}
              </div>
            </>
          ) : null}
          {job.history.length ? (
            <ol className="space-y-0.5 border-t border-line pt-3 t-caption text-secondary">
              {job.history.slice(-5).map((h, i) => (
                <li key={i}>
                  {new Date(h.at).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Dhaka" })} · {h.by}: {h.action}
                  {h.detail ? ` (${h.detail})` : ""}
                </li>
              ))}
            </ol>
          ) : null}
        </div>
      </details>
    </li>
  );
}

function OverlapCard({ o, keep, board }: { o: Overlap; keep: string; board: JobKind }) {
  if (o.kind === "duplicate") {
    return (
      <li className="rounded-md border border-[#f0d49a] bg-[#fff8eb] px-4 py-3">
        <p className="t-small text-navy">
          <span className="font-semibold">{o.keep.customer_name ?? "A customer"}</span> sent {o.others.length + 1} pickup requests ({[o.keep, ...o.others].map((j) => j.requested ?? `${waited(j.created_at)} ago`).join(" · ")}).
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {o.others.map((r) => (
            <form key={r.id} action={mergeAction}>
              <input type="hidden" name="keep_job" value={o.keep.id} />
              <input type="hidden" name="remove_job" value={r.id} />
              <input type="hidden" name="label" value={o.keep.customer_name ?? ""} />
              <input type="hidden" name="keep" value={keep} />
              <button type="submit" className="admin-btn-secondary">
                Merge the {waited(r.created_at)}-old request into the first
              </button>
            </form>
          ))}
        </div>
      </li>
    );
  }
  if (o.kind === "same_place") {
    const other = o.other.kind === board ? o.lead : o.other;
    return (
      <li className="rounded-md border border-blue/30 bg-[#f0f7fc] px-4 py-3">
        <p className="t-small text-navy">
          <span className="font-semibold">{o.lead.customer_name ?? "A customer"}</span>: {o.lead.kind === "delivery" ? `delivery ${o.lead.order_number}` : "pickup"} and{" "}
          {o.other.kind === "delivery" ? `delivery ${o.other.order_number}` : "pickup"} at the same {o.why === "phone" ? "customer" : "address"}
          {other.kind !== board ? ` (the ${other.kind} is on the ${other.kind === "delivery" ? "Deliveries" : "Pickups"} board)` : ""}.
          {o.lead.slot_date ? ` Planned: ${dayName(o.lead.slot_date)} ${slotLabel(o.lead.slot).toLowerCase()}${o.lead.assignee_name ? `, ${o.lead.assignee_name}` : ""}.` : ""}
        </p>
        <form action={combineAction} className="mt-2">
          <input type="hidden" name="lead_job" value={o.lead.id} />
          <input type="hidden" name="other_job" value={o.other.id} />
          <input type="hidden" name="label" value={o.lead.customer_name ?? ""} />
          <input type="hidden" name="keep" value={keep} />
          <button type="submit" className="admin-btn-secondary">
            Combine into one trip{o.lead.slot_date ? " (same person and slot)" : ""}
          </button>
        </form>
      </li>
    );
  }
  return (
    <li className="rounded-md border border-error/30 bg-error-soft px-4 py-3 t-small text-error">
      <span className="font-semibold">{o.personName}</span> has {o.stops} stops on {dayName(o.date)} {slotLabel(o.slot).toLowerCase()} (up to {o.capacity}).{" "}
      <Link href={`/admin/dispatch?${new URLSearchParams({ board, day: o.date })}`} className="font-semibold underline underline-offset-4">
        Move some
      </Link>
    </li>
  );
}

export default async function DispatchPage({ searchParams }: { searchParams: SearchParams }) {
  const admin = await requireSection("dispatch");
  const canOverride = canEditCapacity(admin.role);
  const params = await searchParams;
  const board: JobKind = one(params.board) === "delivery" ? "delivery" : "pickup";
  const today = dhakaToday();
  const dayParam = one(params.day) ?? "";
  const day = /^\d{4}-\d{2}-\d{2}$/.test(dayParam) && dayParam >= today ? dayParam : today;
  const keep = new URLSearchParams({ board, day }).toString();

  const [loaded, staff] = await Promise.all([getDispatch(), getStaff()]);
  const all = loaded.state === "ok" ? loaded.data : [];
  const jobs = all.filter((j) => j.kind === board);
  // Regulars: order counts by phone, shown as the loyalty tier while loyalty is on.
  const { loyalty } = await getSiteContent();
  const phones = jobs.flatMap((j) => (j.phone_key ? [j.phone_key] : []));
  const [orderCounts, phoneFlags] = await Promise.all([getOrderCounts(phones, loyalty.windowMonths), getPhoneFlags(phones)]);
  // Someone signed in with this number and said the old Velto history isn't theirs (or failed the
  // name check): confirm the name on the call. Cleared on /admin/accounts.
  const flaggedFor = (j: DispatchJob) => Boolean(j.phone_key && phoneFlags.has(j.phone_key));
  const regularFor = (j: DispatchJob): Regular | undefined => {
    const c = j.phone_key ? orderCounts[j.phone_key] : undefined;
    if (!c || c.total < 2) return undefined;
    const tier = loyalty.enabled ? loyaltyStatus(loyalty, c).tier : null;
    const orders = `${c.total} orders`;
    return tier && loyaltyStatus(loyalty, c).tierIndex > 0 ? { label: `${tier.name} · ${orders}`, tone: "blue" } : { label: orders, tone: "neutral" };
  };
  const waiting = jobs.filter(needsPlan).sort((a, b) => a.created_at.localeCompare(b.created_at));
  const overlaps = findOverlaps(all).filter((o) =>
    o.kind === "duplicate" ? o.keep.kind === board : o.kind === "same_place" ? o.lead.kind === board || o.other.kind === board : jobs.some((j) => j.assignee_id === o.person),
  );
  const plan = dayPlan(jobs, day);
  const closed = jobs.filter((j) => !isOpen(j)).sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  const counts = (k: JobKind) => all.filter((j) => j.kind === k && needsPlan(j)).length;
  const days = Array.from({ length: 7 }, (_, i) => addDays(today, i));
  const planned = (d: string) => jobs.filter((j) => isOpen(j) && j.slot_date === d && j.assignee_id).length;
  const saved = one(params.saved);
  const error = one(params.error);

  // Deliveries: the order's money, date and how long it has been Ready, and groups by urgency.
  const { orders } = board === "delivery" ? await getRequestContext([], [...new Set(jobs.map((j) => j.order_number).filter((o): o is string => Boolean(o)))]) : { orders: {} as Record<string, LinkedOrder> };
  const orderOf = (j: DispatchJob) => (j.order_number ? (orders[j.order_number] ?? null) : null);
  const groups = DELIVERY_BUCKETS.map((b) => {
    const list = waiting.filter((j) => deliveryBucket(orderOf(j), today) === b.id);
    // Most pressing first inside a group: earliest delivery date, then oldest.
    list.sort((a, c) => (orderOf(a)?.deliveryDate ?? "9999").localeCompare(orderOf(c)?.deliveryDate ?? "9999") || a.created_at.localeCompare(c.created_at));
    return { ...b, list, due: list.reduce((sum, j) => sum + (orderOf(j)?.due ?? 0), 0) };
  }).filter((g) => g.list.length);

  return (
    <>
      <NotificationRefresher />
      <AdminHeader
        title="Pickup & delivery"
        intro="Every customer request and every Ready order, from new to done. Give each stop a person and a slot: it appears in Velto Ops under that person's “Assigned to me”, with the usual reminder before the slot ends."
      />
      {loaded.state === "error" ? <div className="mt-4"><DataNotice state="error" message={loaded.message} /></div> : null}
      {loaded.state === "not_configured" ? <p className="mt-6 t-small text-secondary">Velto Ops is not connected on this server.</p> : null}
      {saved && SAVED[saved] ? (
        <p role="status" className="mt-6 rounded-md border border-success/30 bg-success-soft px-4 py-3 t-small font-medium text-success">
          {SAVED[saved]}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="mt-6 rounded-md border border-error/30 bg-error-soft px-4 py-3 t-small font-medium text-error">
          {error}
        </p>
      ) : null}

      <nav aria-label="Boards" className="mt-6 flex gap-2">
        {(["pickup", "delivery"] as const).map((k) => (
          <Link
            key={k}
            href={`/admin/dispatch?${new URLSearchParams({ board: k, day })}`}
            aria-current={board === k ? "page" : undefined}
            className={`rounded-full border px-4 py-2 t-small font-semibold ${board === k ? "border-navy bg-navy text-white" : "border-line bg-white text-navy hover:border-navy"}`}
          >
            {k === "pickup" ? "Pickups" : "Deliveries"}
            {counts(k) ? <span className={`ml-2 rounded-full px-1.5 ${board === k ? "bg-white/20" : "bg-[#fff1d6] text-[#8a5a00]"}`}>{counts(k)}</span> : null}
          </Link>
        ))}
      </nav>

      {overlaps.length ? (
        <section aria-labelledby="overlaps-title" className="mt-6">
          <h2 id="overlaps-title" className="t-label uppercase text-navy">
            Overlaps to sort out ({overlaps.length})
          </h2>
          <ul className="mt-2 space-y-2">
            {overlaps.map((o, i) => (
              <OverlapCard key={i} o={o} keep={keep} board={board} />
            ))}
          </ul>
        </section>
      ) : null}

      <div className="mt-8 grid grid-cols-[minmax(0,1fr)] gap-8 xl:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <section aria-labelledby="waiting-title">
          <h2 id="waiting-title" className="t-h4 text-navy">
            Needs a plan <span className="text-secondary">({waiting.length})</span>
          </h2>
          <p className="mt-1 t-small text-secondary">
            {board === "pickup" ? "New requests from the website, oldest first. Call the customer, then give it a person and a slot." : "Orders that are Ready in Velto Ops, most urgent first. Give each one a person and a slot; red amounts are what the rider collects."}
          </p>
          {waiting.length && board === "delivery" ? (
            <div className="mt-3 space-y-5">
              {groups.map((g) => {
                const list = (
                  <ul className="mt-2 space-y-2">
                    {g.list.map((j) => (
                      <JobCard canOverride={canOverride} key={j.id} job={j} staff={staff} today={today} keep={keep} order={orderOf(j)} regular={regularFor(j)} flagged={flaggedFor(j)} />
                    ))}
                  </ul>
                );
                const heading = (
                  <>
                    <span className={g.id === "late" ? "text-error" : "text-navy"}>{g.label}</span> <span className="font-normal text-secondary">({g.list.length}{g.due ? ` · ৳${g.due.toLocaleString("en-US")} to collect` : ""})</span>
                  </>
                );
                return g.id === "waiting" ? (
                  <details key={g.id} className="rounded-md border border-[#f0d49a] bg-[#fff8eb] p-3">
                    <summary className="cursor-pointer t-small font-semibold">{heading}</summary>
                    <p className="mt-1 t-caption text-secondary">{g.hint}</p>
                    {list}
                  </details>
                ) : (
                  <div key={g.id}>
                    <h3 className="t-small font-semibold">{heading}</h3>
                    {g.hint ? <p className="t-caption text-secondary">{g.hint}</p> : null}
                    {list}
                  </div>
                );
              })}
            </div>
          ) : waiting.length ? (
            <ul className="mt-3 space-y-2">
              {waiting.map((j) => (
                <JobCard canOverride={canOverride} key={j.id} job={j} staff={staff} today={today} keep={keep} regular={regularFor(j)} flagged={flaggedFor(j)} />
              ))}
            </ul>
          ) : (
            <p className="mt-3 rounded-md border border-dashed border-line px-4 py-6 text-center t-small text-secondary">Nothing waiting. Every {board} has a person and a slot.</p>
          )}
        </section>

        <section aria-labelledby="plan-title">
          <h2 id="plan-title" className="t-h4 text-navy">
            Plan for {day === today ? "today" : dayName(day)}
          </h2>
          <nav aria-label="Day" className="mt-3 flex gap-1.5 overflow-x-auto pb-1">
            {days.map((d) => (
              <Link
                key={d}
                href={`/admin/dispatch?${new URLSearchParams({ board, day: d })}`}
                aria-current={d === day ? "date" : undefined}
                className={`shrink-0 rounded-md border px-3 py-2 text-center t-small ${d === day ? "border-navy bg-navy text-white" : "border-line bg-white text-navy hover:border-navy"}`}
              >
                <span className="block font-semibold">{d === today ? "Today" : d === addDays(today, 1) ? "Tomorrow" : dayName(d).slice(0, 3)}</span>
                <span className={`block t-caption ${d === day ? "text-white/80" : "text-secondary"}`}>
                  {dayName(d).slice(4)} · {planned(d)}
                </span>
              </Link>
            ))}
          </nav>
          <div className="mt-4 space-y-5">
            {plan.map(({ slot, people }) => (
              <div key={slot.id}>
                <h3 className="flex items-baseline gap-2 t-small font-semibold text-navy">
                  {slot.label} <span className="font-normal text-secondary">{slot.hours}</span>
                </h3>
                {people.some((p) => p.count) ? (
                  <div className="mt-2 grid gap-3 md:grid-cols-2">
                    {people
                      .filter((p) => p.count)
                      .map((p) => (
                        <div key={p.person.id} className="rounded-md border border-line bg-soft p-3">
                          <p className="flex items-center justify-between t-small font-semibold text-navy">
                            {p.person.name}
                            <span className={p.over ? "text-error" : "text-secondary"}>
                              {p.count} / {DEFAULT_CAPACITY} stops
                            </span>
                          </p>
                          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-line" aria-hidden="true">
                            <div className={`h-full ${p.over ? "bg-error" : "bg-action"}`} style={{ width: `${Math.min(100, (p.count / DEFAULT_CAPACITY) * 100)}%` }} />
                          </div>
                          <ul className="mt-2 space-y-2">
                            {p.jobs.map((j) => (
                              <JobCard canOverride={canOverride} key={j.id} job={j} staff={staff} today={today} keep={keep} trip={Boolean(j.trip_key)} order={orderOf(j)} regular={regularFor(j)} flagged={flaggedFor(j)} />
                            ))}
                          </ul>
                        </div>
                      ))}
                  </div>
                ) : (
                  <p className="mt-1 t-small text-secondary">No {board === "pickup" ? "pickups" : "deliveries"} in this slot.</p>
                )}
              </div>
            ))}
          </div>
        </section>
      </div>

      {closed.length ? (
        <details className="admin-card mt-8">
          <summary className="cursor-pointer list-none px-5 py-4 font-semibold text-navy">Finished in the last 3 days ({closed.length})</summary>
          <ul className="space-y-2 border-t border-line p-4">
            {closed.map((j) => (
              <JobCard canOverride={canOverride} key={j.id} job={j} staff={staff} today={today} keep={keep} order={orderOf(j)} regular={regularFor(j)} flagged={flaggedFor(j)} />
            ))}
          </ul>
        </details>
      ) : null}
    </>
  );
}
