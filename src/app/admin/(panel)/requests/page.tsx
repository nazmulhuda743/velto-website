import Link from "next/link";
import { BarList, fmt } from "@/components/admin/charts";
import { MarkRequestsSeen } from "@/components/admin/MarkRequestsSeen";
import { NotificationRefresher } from "@/components/admin/NotificationRefresher";
import { AdminHeader, Badge, DataNotice, one, type SearchParams } from "@/components/admin/ui";
import { WhatsAppSend } from "@/components/admin/WhatsAppSend";
import { CHANNEL_LABELS } from "@/lib/analytics/classify";
import { getRequests } from "@/lib/admin/analytics-data";
import { getRequestContext, getRequestJobs, getStaff, type StaffMember } from "@/lib/admin/dispatch";
import { addDays, CANCEL_REASONS, dayName, dhakaToday, isOpen, SLOTS, slotLabel, suggestedSlot, type DispatchJob, type SlotId } from "@/lib/admin/dispatch-logic";
import { pageLabel } from "@/lib/admin/insights";
import { can } from "@/lib/admin/permissions";
import { requestDate } from "@/lib/admin/request-details";
import {
  callTimer,
  confirmMessage,
  duplicateOf,
  FLOW,
  flowState,
  minutesLabel,
  needsAction,
  orderCandidates,
  pickedMessage,
  priorOrders,
  readyMessage,
  type CustomerContext,
  type FlowKey,
  type FlowState,
  type LinkedOrder,
  routineMessage,
  callbackMessage,
} from "@/lib/admin/request-flow";
import { QUICK_FILTERS, analyseRequest, matchesQuickFilter, requestSummary, type RequestInsight } from "@/lib/admin/request-intel";
import { whatsappLink } from "@/lib/admin/retention-messages";
import { requireSection } from "@/lib/admin/session";
import { closeAction, mergeAction, planAction } from "../../dispatch-actions";
import { contactAction, linkOrderAction, noteAction, pickAction } from "../../request-actions";
import { activateRoutineAction, declineRoutineAction } from "../../routine-actions";
import { closeCallbackAction } from "../../callback-actions";
import { getCallbacks, type CallbackRow } from "@/lib/admin/callbacks";
import { getUsualItemsByPhone } from "@/lib/upsell-data";
import { CALLBACK_OUTCOMES } from "@/lib/booking-recovery";
import { getRoutines } from "@/lib/admin/routines";
import type { Loaded } from "@/lib/admin/analytics-data";
import type { RoutineRow } from "@/lib/routine";

export const metadata = { title: "Bookings & quotes · Velto Command Center" };

const SAVED: Record<string, string> = {
  confirmed: "Confirmed with the customer. Next: give it to someone.",
  no_answer: "Call attempt saved.",
  planned: "Saved. The person sees it in Velto Ops under “Assigned to me”.",
  picked: "Marked as picked up. The Velto Ops task is closed.",
  linked: "Order linked. The card now follows it in Velto Ops.",
  unlinked: "Order unlinked.",
  note: "Note added.",
  cancelled: "Cancelled. The Velto Ops task is closed with your reason.",
  merged: "Merged. The repeat request is closed in Velto Ops; this one carries on.",
};

/** Stage filters, in the order work happens. */
const STAGE_FILTERS: { key: string; label: string; match: (c: Card) => boolean }[] = [
  { key: "action", label: "Needs action", match: (c) => needsAction(c.state) },
  { key: "new", label: "To call", match: (c) => !c.state.closed && c.state.key === "new" },
  { key: "confirmed", label: "Confirmed", match: (c) => !c.state.closed && c.state.key === "confirmed" },
  { key: "assigned", label: "Assigned", match: (c) => !c.state.closed && c.state.key === "assigned" },
  { key: "picked", label: "Order to link", match: (c) => !c.state.closed && c.state.key === "picked" },
  { key: "process", label: "In process", match: (c) => !c.state.closed && c.state.key === "process" },
  { key: "ready", label: "Ready / delivery", match: (c) => !c.state.closed && (c.state.key === "ready" || c.state.key === "delivery") },
  { key: "delivered", label: "Delivered", match: (c) => c.state.key === "delivered" },
  { key: "closed", label: "Cancelled", match: (c) => Boolean(c.state.closed) },
  { key: "all", label: "All", match: () => true },
];

type Card = {
  job: DispatchJob;
  insight: RequestInsight | null;
  order: LinkedOrder | null;
  delivery: DispatchJob | null;
  customer: CustomerContext | null;
  state: FlowState;
  /** The first open request from the same phone, when this one repeats it. */
  duplicateOf: DispatchJob | null;
  /** Items this phone sent in 2+ of its last 10 orders (smart upsell: ask on the call). */
  usual: { item: string; service: string; orders: number }[];
};

/** Work order: to call first (oldest first), then each later step; finished ones last, newest first. */
const RANK: Partial<Record<FlowKey, number>> = { new: 0, confirmed: 1, assigned: 2, picked: 3, ready: 4, delivery: 5, process: 6 };
function sortCards(cards: Card[]) {
  const rank = (c: Card) => (c.state.closed ? 9 : (RANK[c.state.key] ?? 8));
  return [...cards].sort((a, b) => {
    const r = rank(a) - rank(b);
    if (r) return r;
    return rank(a) >= 8 ? b.job.created_at.localeCompare(a.job.created_at) : a.job.created_at.localeCompare(b.job.created_at);
  });
}

const tel = (phone: string) => `tel:${phone.replace(/[^\d+]/g, "")}`;
const taka = (n: number | null) => (n === null ? "—" : `৳${fmt(n)}`);
const cardLabel = (j: DispatchJob) => `${j.source === "website_quote" ? "the quote" : "the pickup"} for ${j.customer_name ?? "a customer"}`;
const when = (date: string | null, slot: string | null, today: string) =>
  date ? `${date === today ? "Today" : date === addDays(today, 1) ? "Tomorrow" : dayName(date)}, ${slotLabel(slot).toLowerCase()}` : null;

/* ---------- pieces ---------- */

function StageBar({ state }: { state: FlowState }) {
  return (
    <ol aria-label="Progress" className="flex flex-wrap gap-1.5">
      {FLOW.map((s, i) => {
        const done = i < state.index || (i === state.index && s.key === "delivered");
        const current = i === state.index && s.key !== "delivered";
        const tone = state.closed && current
          ? "border-error/40 bg-error-soft text-error"
          : current
            ? "border-navy bg-navy text-white"
            : done
              ? "border-success/30 bg-success-soft text-success"
              : "border-line bg-white text-secondary";
        return (
          <li key={s.key} aria-current={current ? "step" : undefined} className={`rounded-md border px-2.5 py-1 t-caption font-semibold ${tone}`}>
            {done ? "✓ " : ""}
            {s.label}
          </li>
        );
      })}
    </ol>
  );
}

function DaySlotFields({ today, day, slot, idPrefix }: { today: string; day: string; slot: string; idPrefix: string }) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(today, i));
  if (day && !days.includes(day)) days.push(day);
  return (
    <>
      <label className="block t-caption font-semibold text-secondary" htmlFor={`${idPrefix}-day`}>
        Day
        <select id={`${idPrefix}-day`} name="day" defaultValue={day} className="admin-input mt-1" required>
          <option value="">Choose a day</option>
          {days.map((d) => (
            <option key={d} value={d}>
              {d === today ? `Today, ${dayName(d)}` : d === addDays(today, 1) ? `Tomorrow, ${dayName(d)}` : dayName(d)}
            </option>
          ))}
        </select>
      </label>
      <label className="block t-caption font-semibold text-secondary" htmlFor={`${idPrefix}-slot`}>
        Time of day
        <select id={`${idPrefix}-slot`} name="slot" defaultValue={slot} className="admin-input mt-1" required>
          <option value="">Choose</option>
          {SLOTS.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label} ({s.hours})
            </option>
          ))}
        </select>
      </label>
    </>
  );
}

function Hidden({ job, ret, label, card }: { job: string; ret: string; label: string; card?: string }) {
  return (
    <>
      <input type="hidden" name="job" value={job} />
      <input type="hidden" name="return" value={ret} />
      <input type="hidden" name="label" value={label} />
      {card ? <input type="hidden" name="card" value={card} /> : null}
    </>
  );
}

/** Person + day + time of day for a stop (the pickup, or the order's delivery). */
function PlanForm({
  job,
  card,
  staff,
  today,
  ret,
  label,
  submit,
  suggest,
}: {
  job: DispatchJob;
  card: string;
  staff: StaffMember[];
  today: string;
  ret: string;
  label: string;
  submit: string;
  suggest?: { date: string | null; slot: string | null };
}) {
  const suggestion = suggest ?? (job.kind === "pickup" ? suggestedSlot(job.requested, job.created_at, today) : { date: null, slot: null });
  return (
    <form action={planAction} className="grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end">
      <Hidden job={job.id} ret={ret} label={label} card={card} />
      <label className="block t-caption font-semibold text-secondary" htmlFor={`p-${job.id}-person`}>
        Person
        <select id={`p-${job.id}-person`} name="person" defaultValue={job.assignee_id ?? ""} className="admin-input mt-1" required>
          <option value="">Choose someone</option>
          {staff.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </label>
      <DaySlotFields today={today} day={job.slot_date ?? suggestion.date ?? ""} slot={job.slot ?? suggestion.slot ?? ""} idPrefix={`p-${job.id}`} />
      <button type="submit" className="admin-btn">
        {submit}
      </button>
    </form>
  );
}

function NextStep({ card, staff, today, ret, canPlan }: { card: Card; staff: StaffMember[]; today: string; ret: string; canPlan: boolean }) {
  const { job, state, order, delivery, customer } = card;
  const label = cardLabel(job);
  const name = job.customer_name;
  const wa = (text: { bn: string; en: string }) => {
    const bn = whatsappLink(job.phone, text.bn);
    const en = whatsappLink(job.phone, text.en);
    return bn && en ? { bn, en } : null;
  };

  if (state.closed) {
    return (
      <p className="t-small text-error">
        {state.closed === "merged" ? "Merged into another request from the same customer." : `Cancelled${job.stage === "cancelled" && job.reason ? `: ${job.reason}` : order?.status === "Cancelled" ? ": the order was cancelled in Velto Ops" : ""}.`}
      </p>
    );
  }

  if (state.key === "new") {
    const suggestion = suggestedSlot(job.requested, job.created_at, today);
    return (
      <div className="space-y-3">
        <p className="font-semibold text-navy">Call the customer and agree a day and time of day.</p>
        <p className="t-small text-secondary">
          Asked for: {job.requested ?? "no preference"}
          {job.contact_attempts ? ` · ${job.contact_attempts} call${job.contact_attempts === 1 ? "" : "s"} without an answer so far` : ""}
        </p>
        {job.phone ? (
          <div className="flex flex-wrap gap-2">
            <a href={tel(job.phone)} className="admin-btn-secondary">
              Call {job.phone}
            </a>
            {whatsappLink(job.phone, "") ? (
              <a href={whatsappLink(job.phone, "")!} target="_blank" rel="noopener noreferrer" className="admin-btn-secondary">
                Open WhatsApp chat
              </a>
            ) : null}
          </div>
        ) : null}
        <form action={contactAction} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <Hidden job={job.id} ret={ret} label={label} />
          <input type="hidden" name="outcome" value="confirmed" />
          <DaySlotFields today={today} day={suggestion.date ?? ""} slot={suggestion.slot ?? ""} idPrefix={`c-${job.id}`} />
          <button type="submit" className="admin-btn">
            Confirmed with customer
          </button>
        </form>
        <form action={contactAction}>
          <Hidden job={job.id} ret={ret} label={label} />
          <input type="hidden" name="outcome" value="no_answer" />
          <button type="submit" className="admin-btn-secondary">
            No answer (call {job.contact_attempts + 1})
          </button>
          {job.contact_attempts >= 3 ? <span className="ml-3 t-small text-secondary">Three calls without an answer: send a WhatsApp, or cancel with “No answer after 3 calls”.</span> : null}
        </form>
      </div>
    );
  }

  if (state.key === "confirmed") {
    const msg = job.slot_date && job.slot ? wa({ bn: confirmMessage({ name, date: job.slot_date, slot: job.slot as SlotId, rider: null }, "bn"), en: confirmMessage({ name, date: job.slot_date, slot: job.slot as SlotId, rider: null }, "en") }) : null;
    return (
      <div className="space-y-3">
        <p className="font-semibold text-navy">
          Confirmed for {when(job.slot_date, job.slot, today) ?? "a day to choose"}. Give it to someone.
        </p>
        {canPlan ? <PlanForm job={job} card={job.id} staff={staff} today={today} ret={ret} label={label} submit="Assign" /> : <p className="t-small text-secondary">Assigning is on Pickup &amp; delivery.</p>}
        {msg ? <WhatsAppSend job={job.id} kind="confirm" label="Send the confirmation on WhatsApp:" links={msg} /> : null}
      </div>
    );
  }

  if (state.key === "assigned") {
    const msg = job.slot_date && job.slot ? wa({ bn: confirmMessage({ name, date: job.slot_date, slot: job.slot as SlotId, rider: job.assignee_name }, "bn"), en: confirmMessage({ name, date: job.slot_date, slot: job.slot as SlotId, rider: job.assignee_name }, "en") }) : null;
    return (
      <div className="space-y-3">
        <p className="font-semibold text-navy">
          {job.assignee_name ?? "Someone"} collects it {when(job.slot_date, job.slot, today)?.replace(/^(\w)/, (c) => c.toLowerCase()) ?? ""}. When it is collected, mark it picked up.
        </p>
        <form action={pickAction} className="flex flex-wrap items-end gap-2">
          <Hidden job={job.id} ret={ret} label={label} />
          <label className="block t-caption font-semibold text-secondary" htmlFor={`k-${job.id}-order`}>
            Ops order number (if made already)
            <input id={`k-${job.id}-order`} name="order" placeholder="VEL-01952" pattern="[Vv][Ee][Ll][Rr]?-[0-9]{3,6}" maxLength={11} className="admin-input mt-1 w-44 uppercase" />
          </label>
          <button type="submit" className="admin-btn">
            Picked up
          </button>
        </form>
        {msg ? <WhatsAppSend job={job.id} kind="confirm" label="Send the confirmation on WhatsApp:" links={msg} /> : null}
        {canPlan ? (
          <details>
            <summary className="cursor-pointer t-small font-semibold text-navy underline underline-offset-4">Change the person or time</summary>
            <div className="mt-2">
              <PlanForm job={job} card={job.id} staff={staff} today={today} ret={ret} label={label} submit="Save" />
            </div>
          </details>
        ) : null}
      </div>
    );
  }

  if (state.key === "picked" && job.order_number) {
    // Linked, but the order couldn't be read (Ops unreachable, or the number was changed in Ops).
    return (
      <div className="space-y-3">
        <p className="font-semibold text-navy">Picked up and linked to {job.order_number}. Its status in Velto Ops can&apos;t be read right now.</p>
        <form action={linkOrderAction} className="inline">
          <Hidden job={job.id} ret={ret} label={label} />
          <input type="hidden" name="clear" value="1" />
          <button type="submit" className="t-small font-semibold text-secondary underline underline-offset-4 hover:text-navy">
            Wrong order? Unlink {job.order_number}
          </button>
        </form>
      </div>
    );
  }

  if (state.key === "picked") {
    const candidates = orderCandidates(job, customer);
    const msg = wa({ bn: pickedMessage({ name, orderNumber: null }, "bn"), en: pickedMessage({ name, orderNumber: null }, "en") });
    return (
      <div className="space-y-3">
        <p className="font-semibold text-navy">Picked up{job.picked_at ? ` ${requestDate(job.picked_at)}` : ""}. Link the order made in Velto Ops, so this card can follow it.</p>
        {candidates.length ? (
          <div className="flex flex-wrap gap-2">
            {candidates.map((o) => (
              <form key={o.orderNumber} action={linkOrderAction}>
                <Hidden job={job.id} ret={ret} label={label} />
                <input type="hidden" name="order" value={o.orderNumber} />
                <button type="submit" className="admin-btn">
                  Link {o.orderNumber} <span className="font-normal opacity-80">({o.status}, made {requestDate(o.createdAt)})</span>
                </button>
              </form>
            ))}
          </div>
        ) : (
          <p className="t-small text-secondary">No new order for this phone in Velto Ops yet.</p>
        )}
        <form action={linkOrderAction} className="flex flex-wrap items-end gap-2">
          <Hidden job={job.id} ret={ret} label={label} />
          <label className="block t-caption font-semibold text-secondary" htmlFor={`l-${job.id}-order`}>
            Or type the order number
            <input id={`l-${job.id}-order`} name="order" placeholder="VEL-01952" required pattern="[Vv][Ee][Ll][Rr]?-[0-9]{3,6}" maxLength={11} className="admin-input mt-1 w-44 uppercase" />
          </label>
          <button type="submit" className="admin-btn-secondary">
            Link order
          </button>
        </form>
        {msg ? <WhatsAppSend job={job.id} kind="picked" label="Tell the customer on WhatsApp:" links={msg} /> : null}
      </div>
    );
  }

  // Following the linked order.
  const number = job.order_number!;
  const orderLine = order ? (
    <p className="t-small text-secondary">
      {number} · {order.status} in Velto Ops{order.items ? ` · ${order.items} item${order.items === 1 ? "" : "s"}` : ""} · {taka(order.total)}
      {order.due ? <span className="font-semibold text-navy"> · due {taka(order.due)}</span> : order.total ? " · paid" : ""}
    </p>
  ) : null;
  const unlink = (
    <form action={linkOrderAction} className="inline">
      <Hidden job={job.id} ret={ret} label={label} />
      <input type="hidden" name="clear" value="1" />
      <button type="submit" className="t-small font-semibold text-secondary underline underline-offset-4 hover:text-navy">
        Wrong order? Unlink {number}
      </button>
    </form>
  );

  if (state.key === "process") {
    const msg = wa({ bn: pickedMessage({ name, orderNumber: number }, "bn"), en: pickedMessage({ name, orderNumber: number }, "en") });
    return (
      <div className="space-y-3">
        <p className="font-semibold text-navy">At the outlet. Nothing to do until the order is Ready in Velto Ops.</p>
        {orderLine}
        {msg ? <WhatsAppSend job={job.id} kind="picked" label="Tell the customer on WhatsApp:" links={msg} /> : null}
        {unlink}
      </div>
    );
  }

  if (state.key === "ready" || state.key === "delivery") {
    const planned = delivery && delivery.assignee_id && delivery.slot_date;
    const msg = wa({
      bn: readyMessage({ name, orderNumber: number, date: planned ? delivery!.slot_date : null, slot: planned ? (delivery!.slot as SlotId) : null }, "bn"),
      en: readyMessage({ name, orderNumber: number, date: planned ? delivery!.slot_date : null, slot: planned ? (delivery!.slot as SlotId) : null }, "en"),
    });
    return (
      <div className="space-y-3">
        <p className="font-semibold text-navy">
          {planned ? `Delivery: ${delivery!.assignee_name ?? "someone"}, ${when(delivery!.slot_date, delivery!.slot, today)?.toLowerCase()}.` : "Ready. Plan the delivery."}
        </p>
        {orderLine}
        {delivery && isOpen(delivery) && canPlan ? (
          planned ? (
            <details>
              <summary className="cursor-pointer t-small font-semibold text-navy underline underline-offset-4">Change the delivery person or time</summary>
              <div className="mt-2">
                <PlanForm job={delivery} card={job.id} staff={staff} today={today} ret={ret} label={`Delivery ${number} – ${name ?? "customer"}`} submit="Save" />
              </div>
            </details>
          ) : (
            <PlanForm
              job={delivery}
              card={job.id}
              staff={staff}
              today={today}
              ret={ret}
              label={`Delivery ${number} – ${name ?? "customer"}`}
              submit="Plan delivery"
              suggest={{ date: order?.deliveryDate && order.deliveryDate >= today ? order.deliveryDate : null, slot: null }}
            />
          )
        ) : !delivery ? (
          <p className="t-small text-secondary">The delivery appears here once the order is on the delivery board (refresh in a moment).</p>
        ) : null}
        {msg ? <WhatsAppSend job={job.id} kind="ready" label="Tell the customer on WhatsApp:" links={msg} /> : null}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="font-semibold text-success">Delivered. All done.</p>
      {orderLine}
    </div>
  );
}

const linkify = (value: string) =>
  value.split(/(\s+)/).map((part, i) =>
    /^https:\/\/\S+$/.test(part) ? (
      <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="font-semibold underline underline-offset-4">
        {part.includes("/go/photo/") ? "Photo" : "Link"}
      </a>
    ) : (
      part
    ),
  );

function RequestCard({ card, staff, today, ret, open, canPlan }: { card: Card; staff: StaffMember[]; today: string; ret: string; open: boolean; canPlan: boolean }) {
  const { job, insight, state, customer } = card;
  const prior = priorOrders(job, customer);
  const timer = callTimer(job);
  const current = FLOW[state.index];
  const d = insight?.details ?? {};
  const label = cardLabel(job);
  return (
    <li id={`r-${job.id}`} className={`admin-card scroll-mt-24 ${timer?.tone === "late" ? "border-error/40" : timer?.tone === "soon" ? "border-[#f0d49a]" : ""}`}>
      <details className="group" open={open || undefined}>
        <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-3 gap-y-1 px-5 py-4">
          <Badge tone={job.source === "website_quote" ? "amber" : "blue"}>{job.source === "website_quote" ? "Quote" : job.source === "weekly" ? "Weekly" : "Booking"}</Badge>
          {insight?.firstOrder ? <Badge tone="green">First website order · 10% off</Badge> : null}
          <span className="font-semibold text-navy">{job.customer_name ?? "Customer"}</span>
          <span className="t-small text-secondary">{job.phone}</span>
          <span className="t-small text-secondary">{insight?.service ?? ""}</span>
          <span className="t-small text-secondary">{job.area ?? ""}</span>
          <span className="ml-auto flex items-center gap-2 t-small text-secondary">
            {timer ? (
              <span className={`rounded-full px-2 py-0.5 t-caption font-semibold ${timer.tone === "late" ? "bg-error-soft text-error" : timer.tone === "soon" ? "bg-[#fff1d6] text-[#8a5a00]" : "bg-soft text-navy"}`}>
                Waiting {minutesLabel(timer.minutes)}
              </span>
            ) : null}
            <span className={`rounded-full px-2 py-0.5 t-caption font-semibold ${state.closed ? "bg-error-soft text-error" : state.key === "delivered" ? "bg-success-soft text-success" : "bg-navy text-white"}`}>
              {state.closed ? (state.closed === "merged" ? "Merged" : "Cancelled") : current.label}
            </span>
          </span>
        </summary>
        <div className="space-y-5 border-t border-line px-5 py-5">
          <StageBar state={state} />

          {insight?.firstOrder ? (
            <p className="rounded-md border border-success/40 bg-success-soft px-4 py-3 t-small font-semibold text-navy" data-first-order>
              This number&apos;s first order on the website: apply 10% off (any amount) when you create the order in Velto Ops.
              {insight.details.Notes?.includes(" OR Coupon ") ? " They also hold a goal coupon: apply whichever saves them more, not both." : ""}
            </p>
          ) : null}

          {card.duplicateOf ? (
            <div className="rounded-md border border-[#f0d49a] bg-[#fff8eb] px-4 py-3 t-small text-navy">
              <p>
                The same number sent another request {requestDate(card.duplicateOf.created_at)} ({card.duplicateOf.requested ?? "no preferred time"}). One visit is enough.
              </p>
              {canPlan ? (
                <form action={mergeAction} className="mt-2">
                  <input type="hidden" name="keep_job" value={card.duplicateOf.id} />
                  <input type="hidden" name="remove_job" value={job.id} />
                  <input type="hidden" name="card" value={card.duplicateOf.id} />
                  <input type="hidden" name="label" value={job.customer_name ?? ""} />
                  <input type="hidden" name="return" value={ret} />
                  <button type="submit" className="admin-btn-secondary">
                    Merge this into the first request
                  </button>
                </form>
              ) : null}
            </div>
          ) : null}

          <section aria-label="Next step" className={`rounded-md border p-4 ${state.closed ? "border-error/30 bg-error-soft/40" : "border-blue/30 bg-[#f0f7fc]"}`}>
            <NextStep card={card} staff={staff} today={today} ret={ret} canPlan={canPlan} />
          </section>

          <dl className="grid gap-x-8 gap-y-2 md:grid-cols-2 xl:grid-cols-3">
            <div>
              <dt className="t-caption uppercase tracking-[0.04em] text-secondary">Customer</dt>
              <dd className="text-navy">
                {prior.count > 0 ? (
                  <>
                    Returning · {prior.count} earlier order{prior.count === 1 ? "" : "s"}
                    {prior.last ? <span className="text-secondary"> · last {prior.last}</span> : null}
                  </>
                ) : (
                  "New to Velto (no earlier orders on this number)"
                )}
              </dd>
            </div>
            {card.usual.length ? (
              <div className="md:col-span-2 xl:col-span-3" data-usual-items>
                <dt className="t-caption uppercase tracking-[0.04em] text-secondary">Usually sends</dt>
                <dd className="text-navy">
                  {card.usual.map((u) => `${u.item} (${u.service}, in ${u.orders} orders)`).join(" · ")}
                  {!state.closed ? <span className="block t-small text-secondary">Not in this request? Ask about them on the confirmation call.</span> : null}
                </dd>
              </div>
            ) : null}
            <div>
              <dt className="t-caption uppercase tracking-[0.04em] text-secondary">Address</dt>
              <dd className="text-navy [overflow-wrap:anywhere]">{[job.address, job.area].filter(Boolean).join(", ") || "Not given"}</dd>
            </div>
            <div>
              <dt className="t-caption uppercase tracking-[0.04em] text-secondary">Came in</dt>
              <dd className="text-navy">{requestDate(job.created_at)}</dd>
            </div>
            {Object.entries(d)
              .filter(([k]) => !["Campaign", "Name", "Phone", "Area", "Address"].includes(k))
              .map(([k, v]) => (
                <div key={k}>
                  <dt className="t-caption uppercase tracking-[0.04em] text-secondary">{k}</dt>
                  <dd className="text-navy [overflow-wrap:anywhere]">{linkify(v)}</dd>
                </div>
              ))}
            {insight ? (
              <div>
                <dt className="t-caption uppercase tracking-[0.04em] text-secondary">Source</dt>
                <dd className="text-navy">
                  {CHANNEL_LABELS[insight.channel]}
                  {insight.landing ? ` · ${pageLabel(insight.landing)}` : ""}
                  {insight.device ? ` · ${insight.device}` : ""}
                </dd>
              </div>
            ) : null}
          </dl>

          <div className="grid gap-4 lg:grid-cols-2">
            <form action={noteAction} className="flex items-end gap-2">
              <Hidden job={job.id} ret={ret} label={label} />
              <label className="block min-w-0 flex-1 t-caption font-semibold text-secondary" htmlFor={`n-${job.id}`}>
                Note for the team
                <input id={`n-${job.id}`} name="note" maxLength={300} required placeholder="e.g. Call before coming, 3rd floor" className="admin-input mt-1" />
              </label>
              <button type="submit" className="admin-btn-secondary">
                Add
              </button>
            </form>
            {isOpen(job) && canPlan ? (
              <details className="lg:justify-self-end">
                <summary className="admin-btn-danger cursor-pointer list-none">Cancel…</summary>
                <form action={closeAction} className="mt-2 grid gap-2 rounded-md border border-line bg-soft p-3 sm:w-[340px]">
                  <Hidden job={job.id} ret={ret} label={`${job.source === "website_quote" ? "Quote" : "Pickup"} – ${job.customer_name ?? "customer"}`} />
                  <input type="hidden" name="outcome" value="cancelled" />
                  <label className="block t-caption font-semibold text-secondary" htmlFor={`x-${job.id}-reason`}>
                    Reason
                    <select id={`x-${job.id}-reason`} name="reason" className="admin-input mt-1" defaultValue={job.contact_attempts >= 3 ? CANCEL_REASONS[1] : CANCEL_REASONS[0]}>
                      {CANCEL_REASONS.map((r) => (
                        <option key={r}>{r}</option>
                      ))}
                      <option value="other">Other (write below)</option>
                    </select>
                  </label>
                  <input name="other" maxLength={200} placeholder="Other reason" className="admin-input" aria-label="Other reason" />
                  <button type="submit" className="admin-btn-danger">
                    Cancel this request
                  </button>
                </form>
              </details>
            ) : null}
          </div>

          {job.history.length ? (
            <section aria-label="Timeline" className="border-t border-line pt-4">
              <h3 className="t-caption font-semibold uppercase tracking-[0.04em] text-secondary">Timeline</h3>
              <ol className="mt-2 space-y-1.5">
                {[...job.history].reverse().map((h, i) => (
                  <li key={i} className="grid grid-cols-[7.5rem_minmax(0,1fr)] gap-3 t-small">
                    <span className="tabular-nums text-secondary">{requestDate(h.at)}</span>
                    <span className="text-navy [overflow-wrap:anywhere]">
                      <span className="font-semibold">{h.by}</span> · {h.action}
                      {h.detail ? <span className="text-secondary"> — {h.detail}</span> : null}
                    </span>
                  </li>
                ))}
              </ol>
            </section>
          ) : null}
        </div>
      </details>
    </li>
  );
}

function Breakdown({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="t-caption font-semibold uppercase tracking-[0.04em] text-secondary">{title}</h3>
      <div className="mt-1">{children}</div>
    </div>
  );
}

const bars = (list: { label: string; count: number }[], limit = 6) => list.slice(0, limit).map((x) => ({ key: x.label, label: x.label, value: x.count }));

const PAGE_SIZE = 30;

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const ROUTINE_SERVICE: Record<string, string> = { "dry-cleaning": "Dry cleaning", "wash-and-iron": "Wash & iron", ironing: "Ironing" };
const ROUTINE_BADGE: Record<string, { tone: "amber" | "green" | "neutral" | "blue"; label: string }> = {
  requested: { tone: "amber", label: "To confirm" },
  active: { tone: "green", label: "Running" },
  paused: { tone: "neutral", label: "Paused" },
  declined: { tone: "neutral", label: "Declined" },
  stopped: { tone: "neutral", label: "Stopped" },
};

/**
 * Routine pickups (website_routines.sql): customers ask for a weekly day on their account; confirm it
 * with them on WhatsApp, then Activate: it becomes a Velto Ops weekly pickup and Ops' daily job makes
 * the pickup, delivery and day-before confirmation tasks. Hidden while there are none.
 */
const waitedMinutes = (iso: string) => Math.max(0, Math.floor((Date.now() - Date.parse(iso)) / 60_000));
const OUTCOME_LABEL: Record<string, string> = Object.fromEntries(CALLBACK_OUTCOMES.map((o) => [o.id, o.label]));

/**
 * "Get a call back" requests from the booking form (website_callbacks.sql): visitors who got stuck
 * and asked Velto to call. Call or WhatsApp once, then close with what happened. Hidden while empty.
 */
function CallbacksPanel({ loaded, saved, error }: { loaded: Loaded<CallbackRow[]>; saved?: string; error?: string }) {
  if (loaded.state === "not_configured") return null;
  const rows = loaded.state === "ok" ? loaded.data : [];
  if (loaded.state === "ok" && !rows.length && !saved && !error) return null;
  const open = rows.filter((r) => r.status === "open");
  const handled = rows.filter((r) => r.status === "done");
  return (
    <section id="callbacks" aria-labelledby="callbacks-title" className="admin-card mt-6 scroll-mt-24 p-5 md:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="callbacks-title" className="text-[17px] font-semibold text-navy">
          Call-back requests {open.length ? <Badge tone="amber">{open.length} to call</Badge> : null}
        </h2>
        <p className="t-small text-secondary">Visitors who started a booking and asked us to call</p>
      </div>
      {loaded.state === "error" ? <p role="alert" className="mt-3 t-small text-error">{loaded.message}</p> : null}
      {saved ? (
        <p role="status" className="mt-3 rounded-md border border-success/30 bg-success-soft px-4 py-2 t-small font-medium text-success">
          Saved.
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="mt-3 rounded-md border border-error/30 bg-error-soft px-4 py-2 t-small font-medium text-error">
          {error}
        </p>
      ) : null}
      {open.length ? (
        <ul className="mt-4 divide-y divide-line border-t border-line">
          {open.map((r) => {
            const waited = waitedMinutes(r.created_at);
            const wa = { bn: whatsappLink(r.phone, callbackMessage({ name: r.name }, "bn")), en: whatsappLink(r.phone, callbackMessage({ name: r.name }, "en")) };
            const source = [r.utm_source, r.utm_medium].filter(Boolean).join(" / ") || r.referrer_host || "direct";
            return (
              <li key={r.id} className="py-4" data-callback-row>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <Badge tone={waited < 30 ? "blue" : "amber"}>{`Waiting ${minutesLabel(waited)}`}</Badge>
                  <span className="font-semibold text-navy">{r.name}</span>
                  <a href={`tel:${r.phone}`} className="t-small font-semibold text-navy underline underline-offset-4">
                    {r.phone}
                  </a>
                  <span className="t-small text-secondary">{r.orders ? `${r.orders} orders before` : "new customer"}</span>
                </div>
                <dl className="mt-2 grid gap-x-6 gap-y-1 t-small sm:grid-cols-2">
                  {r.what ? (
                    <div>
                      <dt className="inline text-secondary">Picking up: </dt>
                      <dd className="inline text-navy">{r.what}</dd>
                    </div>
                  ) : null}
                  {r.services ? (
                    <div>
                      <dt className="inline text-secondary">Service: </dt>
                      <dd className="inline text-navy">{r.services}</dd>
                    </div>
                  ) : null}
                  {r.area ? (
                    <div>
                      <dt className="inline text-secondary">Area: </dt>
                      <dd className="inline text-navy">{r.area}</dd>
                    </div>
                  ) : null}
                  {r.preferred ? (
                    <div>
                      <dt className="inline text-secondary">Wanted: </dt>
                      <dd className="inline text-navy">{r.preferred}</dd>
                    </div>
                  ) : null}
                  <div>
                    <dt className="inline text-secondary">Came from: </dt>
                    <dd className="inline text-navy">
                      {source}
                      {r.device ? ` · ${r.device}` : ""}
                    </dd>
                  </div>
                </dl>
                <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 t-small">
                  <a href={`tel:${r.phone}`} className="admin-btn !h-9 !px-3">
                    Call
                  </a>
                  {wa.bn && wa.en ? (
                    <>
                      <span className="font-semibold text-navy">WhatsApp:</span>
                      <a href={wa.bn} target="_blank" rel="noopener noreferrer" className="admin-btn-secondary !h-9 !px-3">
                        <span lang="bn">বাংলা</span>
                      </a>
                      <a href={wa.en} target="_blank" rel="noopener noreferrer" className="admin-btn-secondary !h-9 !px-3">
                        English
                      </a>
                    </>
                  ) : null}
                </div>
                <form action={closeCallbackAction} className="mt-3 flex flex-wrap items-end gap-3">
                  <input type="hidden" name="id" value={r.id} />
                  <input type="hidden" name="label" value={`${r.name} (${r.phone})`} />
                  <label className="block t-small font-semibold text-navy">
                    What happened
                    <select name="outcome" required defaultValue="" className="admin-input mt-1 w-56">
                      <option value="" disabled>
                        Choose…
                      </option>
                      {CALLBACK_OUTCOMES.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block min-w-[12rem] flex-1 t-small font-semibold text-navy">
                    Note (optional)
                    <input name="note" maxLength={300} className="admin-input mt-1 w-full" />
                  </label>
                  <button type="submit" className="admin-btn-secondary">
                    Close
                  </button>
                </form>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-3 t-small text-secondary">Nothing waiting. Handled requests from the last 14 days are below.</p>
      )}
      {handled.length ? (
        <details className="mt-3">
          <summary className="cursor-pointer t-small font-semibold text-secondary">Handled ({handled.length})</summary>
          <ul className="mt-2 divide-y divide-line">
            {handled.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2 t-small">
                <span className="font-semibold text-navy">{r.name}</span>
                <span className="text-secondary">{r.phone}</span>
                <Badge tone={r.outcome === "booked" ? "green" : "neutral"}>{OUTCOME_LABEL[r.outcome ?? ""] ?? r.outcome ?? "Closed"}</Badge>
                {r.note ? <span className="text-secondary">{r.note}</span> : null}
                <span className="ml-auto text-secondary">
                  {r.handled_by ?? ""}
                  {r.handled_at ? ` · ${requestDate(r.handled_at)}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </section>
  );
}

function RoutinesPanel({ loaded, saved, error }: { loaded: Loaded<RoutineRow[]>; saved?: string; error?: string }) {
  if (loaded.state === "not_configured") return null;
  const rows = loaded.state === "ok" ? loaded.data : [];
  if (loaded.state === "ok" && !rows.length && !saved && !error) return null;
  const waiting = rows.filter((r) => r.status === "requested");
  const running = rows.filter((r) => r.status === "active").length;
  return (
    <section id="routines" aria-labelledby="routines-title" className="admin-card mt-6 scroll-mt-24 p-5 md:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="routines-title" className="text-[17px] font-semibold text-navy">
          Routine pickups {waiting.length ? <Badge tone="amber">{waiting.length} to confirm</Badge> : null}
        </h2>
        <p className="t-small text-secondary">{running} running in Velto Ops weekly pickups</p>
      </div>
      {loaded.state === "error" ? <p role="alert" className="mt-3 t-small text-error">{loaded.message}</p> : null}
      {saved ? (
        <p role="status" className="mt-3 rounded-md border border-success/30 bg-success-soft px-4 py-2 t-small font-medium text-success">
          {saved === "activated" ? "Activated. It is now a weekly pickup in Velto Ops." : "Declined. The customer sees your reason on their account."}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="mt-3 rounded-md border border-error/30 bg-error-soft px-4 py-2 t-small font-medium text-error">
          {error}
        </p>
      ) : null}
      <ul className="mt-4 divide-y divide-line border-t border-line">
        {rows.map((r) => {
          const badge = ROUTINE_BADGE[r.status];
          const label = `${r.name} (${r.phone})`;
          const msg = { bn: whatsappLink(r.phone, routineMessage({ name: r.name, weekday: r.weekday, slot: r.window }, "bn")), en: whatsappLink(r.phone, routineMessage({ name: r.name, weekday: r.weekday, slot: r.window }, "en")) };
          return (
            <li key={r.id} className="py-4" data-routine-row={r.status}>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <Badge tone={badge.tone}>{r.change ? "Change to confirm" : badge.label}</Badge>
                <span className="font-semibold text-navy">{r.name}</span>
                <span className="t-small text-secondary">{r.phone}</span>
                <span className="t-small text-secondary">{r.orders ? `${r.orders} orders` : "no orders yet"}</span>
              </div>
              <p className="mt-1.5 text-[15px] text-navy">
                Every <strong>{DAYS[r.weekday]}</strong>, {slotLabel(r.window).toLowerCase()}
                {r.service ? ` · ${ROUTINE_SERVICE[r.service] ?? r.service}` : ""} · {r.address}, {r.area === "outside" ? "outside Uttara" : `Sector ${r.area}`}
              </p>
              {r.note ? <p className="mt-1 t-small text-secondary">Note: {r.note}</p> : null}
              {r.reason && r.status === "declined" ? <p className="mt-1 t-small text-secondary">Declined: {r.reason}</p> : null}
              {r.status === "requested" ? (
                <div className="mt-3 space-y-3">
                  {msg.bn && msg.en ? (
                    <p className="flex flex-wrap items-center gap-x-3 gap-y-2 t-small">
                      <span className="font-semibold text-navy">1. Confirm on WhatsApp:</span>
                      <a href={msg.bn} target="_blank" rel="noopener noreferrer" className="admin-btn-secondary !h-9 !px-3">
                        <span lang="bn">বাংলা</span>
                      </a>
                      <a href={msg.en} target="_blank" rel="noopener noreferrer" className="admin-btn-secondary !h-9 !px-3">
                        English
                      </a>
                    </p>
                  ) : null}
                  <form action={activateRoutineAction} className="flex flex-wrap items-end gap-3">
                    <input type="hidden" name="id" value={r.id} />
                    <input type="hidden" name="label" value={label} />
                    <label className="block t-small font-semibold text-navy">
                      Price per run (৳, optional)
                      <input name="price" inputMode="numeric" pattern="[0-9]*" maxLength={6} className="admin-input mt-1 w-40" placeholder="Leave empty" />
                    </label>
                    <button type="submit" className="admin-btn">
                      2. {r.change ? "Apply change" : "Activate weekly pickup"}
                    </button>
                  </form>
                  <details>
                    <summary className="cursor-pointer t-small font-semibold text-secondary underline underline-offset-4">Decline…</summary>
                    <form action={declineRoutineAction} className="mt-2 flex flex-wrap items-end gap-3">
                      <input type="hidden" name="id" value={r.id} />
                      <input type="hidden" name="label" value={label} />
                      <label className="block min-w-[16rem] flex-1 t-small font-semibold text-navy">
                        Reason (the customer sees it)
                        <input name="reason" required maxLength={300} className="admin-input mt-1 w-full" />
                      </label>
                      <button type="submit" className="admin-btn-secondary">
                        Decline
                      </button>
                    </form>
                  </details>
                </div>
              ) : r.decidedBy ? (
                <p className="mt-1 t-caption text-secondary">
                  {r.status === "active" || r.status === "paused" ? "Activated" : "Handled"} by {r.decidedBy}
                  {r.decidedAt ? ` · ${requestDate(r.decidedAt)}` : ""}
                </p>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export default async function RequestsPage({ searchParams }: { searchParams: SearchParams }) {
  const admin = await requireSection("requests");
  const canPlan = can(admin.role, "dispatch");
  const params = await searchParams;
  const stage = one(params.stage) ?? "action";
  const filter = one(params.filter) ?? "all";
  const q = (one(params.q) ?? "").trim().toLowerCase().slice(0, 60);
  const openId = one(params.open) ?? "";
  const saved = one(params.saved);
  const error = one(params.error);
  const today = dhakaToday();

  const [loaded, jobsLoaded, staff, routines, callbacks] = await Promise.all([getRequests(500), getRequestJobs(), getStaff(), getRoutines(), getCallbacks()]);
  const tasks = loaded.state === "ok" ? loaded.data : [];
  const insights = tasks.map((r) => analyseRequest(r));
  const byTask = new Map(insights.map((i) => [i.request.id, i]));
  const pickups = jobsLoaded.state === "ok" ? jobsLoaded.data.pickups : [];
  const deliveries = jobsLoaded.state === "ok" ? jobsLoaded.data.deliveries : [];
  const deliveryFor = new Map<string, DispatchJob>();
  for (const dj of deliveries) {
    if (!dj.order_number || dj.stage === "cancelled" || dj.stage === "merged") continue;
    const had = deliveryFor.get(dj.order_number);
    if (!had || had.created_at < dj.created_at) deliveryFor.set(dj.order_number, dj);
  }
  const phoneKeys = [...new Set(pickups.filter((j) => isOpen(j)).map((j) => j.phone_key).filter((k): k is string => Boolean(k)))];
  const usualByPhone = await getUsualItemsByPhone(phoneKeys);
  const context = await getRequestContext(
    [...new Set(pickups.map((j) => j.phone_key).filter((k): k is string => Boolean(k)))],
    [...new Set(pickups.map((j) => j.order_number).filter((o): o is string => Boolean(o)))],
  );

  const duplicates = duplicateOf(pickups);
  const cards: Card[] = pickups.map((job) => {
    const order = job.order_number ? (context.orders[job.order_number] ?? null) : null;
    const delivery = job.order_number ? (deliveryFor.get(job.order_number) ?? null) : null;
    return {
      job,
      insight: job.task_id ? (byTask.get(job.task_id) ?? null) : null,
      order,
      delivery,
      customer: job.phone_key ? (context.customers[job.phone_key] ?? null) : null,
      state: flowState(job, order, delivery),
      duplicateOf: duplicates.get(job.id) ?? null,
      usual: job.phone_key ? (usualByPhone[job.phone_key] ?? []) : [],
    };
  });
  const onBoard = new Set(pickups.map((j) => j.task_id).filter(Boolean));
  const older = insights.filter((i) => !onBoard.has(i.request.id));

  const stageFilter = STAGE_FILTERS.find((f) => f.key === stage) ?? STAGE_FILTERS[0];
  const matchesQ = (c: Card) => !q || `${c.job.customer_name ?? ""} ${c.job.phone ?? ""} ${c.job.phone_key ?? ""} ${c.job.area ?? ""} ${c.job.order_number ?? ""}`.toLowerCase().includes(q);
  const matchesFilter = (c: Card) => filter === "all" || (c.insight ? matchesQuickFilter(c.insight, filter) : false);
  const rows = sortCards(cards.filter((c) => stageFilter.match(c) && matchesQ(c) && matchesFilter(c)));
  const shown = Math.min(rows.length, Math.max(PAGE_SIZE, Math.min(Number(one(params.show)) || PAGE_SIZE, 500)));
  const base = { stage, ...(filter !== "all" ? { filter } : {}), ...(q ? { q } : {}) };
  const ret = `/admin/requests?${new URLSearchParams({ ...base, ...(shown > PAGE_SIZE ? { show: String(shown) } : {}) })}`;
  const moreHref = `/admin/requests?${new URLSearchParams({ ...base, show: String(shown + PAGE_SIZE) })}`;

  const summary = requestSummary(insights);
  const toCall = cards.filter((c) => !c.state.closed && c.state.key === "new");
  const late = toCall.filter((c) => (callTimer(c.job)?.tone ?? "ok") !== "ok").length;
  const action = cards.filter((c) => needsAction(c.state)).length;
  const openCard = openId && rows.some((c) => c.job.id === openId) ? openId : rows.length === 1 ? rows[0].job.id : "";
  // Opening this page marks everything shown as seen (the menu badge counts only newer ones).
  const newest = Math.max(0, ...tasks.map((r) => Date.parse(r.created_at)).filter(Number.isFinite), ...pickups.map((j) => Date.parse(j.created_at)).filter(Number.isFinite));

  return (
    <>
      <NotificationRefresher />
      <MarkRequestsSeen newest={newest} />
      <AdminHeader
        title="Bookings & quotes"
        intro="Every pickup booking and household quote from the website, from the first call to delivery. Open a request to see where it is and do the next step right there."
        actions={
          <Link href="/admin/dispatch" className="admin-btn-secondary">
            Today&apos;s plan by person
          </Link>
        }
      />

      {loaded.state === "error" || loaded.state === "not_configured" ? (
        <p role="alert" className="mt-6 t-small text-error">
          {loaded.state === "error" ? loaded.message : "Velto Ops is not connected on this server."}
        </p>
      ) : null}
      {jobsLoaded.state === "error" ? (
        <div className="mt-4">
          <DataNotice state="error" message={jobsLoaded.message} />
        </div>
      ) : null}
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

      <section aria-label="Request totals" className="admin-card mt-6 grid grid-cols-2 divide-line md:grid-cols-5 md:divide-x">
        {[
          { label: "Needs action", value: action, sub: action ? "open a request to do the next step" : "nothing waiting", alert: false },
          { label: "Waiting for a call", value: toCall.length, sub: late ? `${late} waiting over 30 min` : toCall.length ? "all under 30 min" : "none", alert: late > 0 },
          { label: "Today", value: summary.today, sub: null, alert: false },
          { label: "Last 7 days", value: summary.last7, sub: null, alert: false },
          { label: "Bookings / quotes", value: `${fmt(summary.bookings)} / ${fmt(summary.quotes)}`, sub: "last 500", alert: false },
        ].map((s, i) => (
          <div key={s.label} className={`p-5 ${i > 1 ? "border-t border-line md:border-t-0" : ""} ${i === 4 ? "col-span-2 md:col-span-1" : ""}`}>
            <p className="t-small text-secondary">{s.label}</p>
            <p className="mt-1 text-[28px] font-semibold leading-none tabular-nums text-navy">{typeof s.value === "number" ? fmt(s.value) : s.value}</p>
            {s.sub ? <p className={`mt-2 t-caption ${s.alert ? "font-semibold text-error" : "text-secondary"}`}>{s.sub}</p> : null}
          </div>
        ))}
      </section>

      <CallbacksPanel loaded={callbacks} saved={one(params.callback_saved)} error={one(params.callback_error)} />
      <RoutinesPanel loaded={routines} saved={one(params.routine_saved)} error={one(params.routine_error)} />

      <div className="mt-6 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Stage">
          {STAGE_FILTERS.map((f) => {
            const n = cards.filter(f.match).length;
            const active = stageFilter.key === f.key;
            return (
              <Link
                key={f.key}
                href={`/admin/requests?${new URLSearchParams({ stage: f.key, ...(filter !== "all" ? { filter } : {}), ...(q ? { q } : {}) })}`}
                aria-current={active ? "page" : undefined}
                className={`rounded-full border px-3 py-1.5 t-small font-semibold ${active ? "border-navy bg-navy text-white" : "border-line bg-white text-navy hover:border-navy"}`}
              >
                {f.label} <span className={active ? "text-white/70" : "text-secondary"}>{n}</span>
              </Link>
            );
          })}
        </div>
        <form className="flex shrink-0 gap-2">
          <input type="hidden" name="stage" value={stage} />
          {filter !== "all" ? <input type="hidden" name="filter" value={filter} /> : null}
          <input name="q" defaultValue={q} placeholder="Name, phone, area or VEL-" className="admin-input lg:w-64" aria-label="Search requests" />
          <button className="admin-btn-secondary" type="submit">
            Search
          </button>
        </form>
      </div>
      <nav aria-label="More filters" className="mt-3 flex flex-wrap gap-x-4 gap-y-1 t-small">
        <span className="text-secondary">Show only:</span>
        {QUICK_FILTERS.filter((f) => !["new", "open", "done", "today"].includes(f.key)).map((f) => (
          <Link
            key={f.key}
            href={`/admin/requests?${new URLSearchParams({ stage, ...(f.key !== "all" ? { filter: f.key } : {}), ...(q ? { q } : {}) })}`}
            aria-current={filter === f.key ? "page" : undefined}
            className={filter === f.key ? "font-semibold text-navy underline underline-offset-4" : "text-secondary hover:text-navy"}
          >
            {f.label}
          </Link>
        ))}
      </nav>

      <p className="mt-6 t-small text-secondary">
        {rows.length > shown ? `Showing ${shown} of ${rows.length} requests` : `${rows.length} request${rows.length === 1 ? "" : "s"}`}
        {stageFilter.key === "action" && !rows.length ? ". Everything is moving. New requests appear here first." : ""}
      </p>
      <ul className="mt-2 space-y-2">
        {rows.slice(0, shown).map((c) => (
          <RequestCard key={c.job.id} card={c} staff={staff} today={today} ret={ret} open={c.job.id === openCard} canPlan={canPlan} />
        ))}
      </ul>
      {rows.length > shown ? (
        <div className="mt-4 flex justify-center">
          <Link href={moreHref} scroll={false} className="admin-btn-secondary">
            Show {Math.min(PAGE_SIZE, rows.length - shown)} more
          </Link>
        </div>
      ) : null}

      <details className="admin-card group mt-8">
        <summary className="flex cursor-pointer list-none items-center justify-between px-5 py-4 font-semibold text-navy">
          Breakdown by service, area, source, landing page and device
          <span aria-hidden="true" className="text-secondary transition-transform group-open:rotate-180">
            ⌄
          </span>
        </summary>
        <div className="grid gap-6 border-t border-line p-5 md:grid-cols-2 xl:grid-cols-3">
          <Breakdown title="Service">
            <BarList items={bars(summary.byService)} total={insights.length} />
          </Breakdown>
          <Breakdown title="Area">
            <BarList items={bars(summary.byArea)} total={insights.length} />
          </Breakdown>
          <Breakdown title="Source">
            <BarList items={bars(summary.byChannel)} total={insights.length} />
          </Breakdown>
          <Breakdown title="Landing page">
            <BarList items={bars(summary.byLanding.map((l) => ({ ...l, label: l.label.startsWith("/") ? pageLabel(l.label) : l.label })))} total={insights.length} />
          </Breakdown>
          <Breakdown title="Device">
            <BarList items={bars(summary.byDevice)} total={insights.length} />
          </Breakdown>
        </div>
      </details>

      {older.length ? (
        <details className="admin-card mt-4">
          <summary className="cursor-pointer list-none px-5 py-4 font-semibold text-navy">
            Older requests, before this flow ({older.length}) <span className="font-normal text-secondary">· status as in Velto Ops</span>
          </summary>
          <ul className="divide-y divide-line border-t border-line">
            {older.slice(0, 100).map((i) => (
              <li key={i.request.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3 t-small">
                <Badge tone={i.kind === "booking" ? "blue" : "amber"}>{i.kind === "booking" ? "Booking" : "Quote"}</Badge>
                <span className="font-semibold text-navy">{i.details.Name ?? i.request.title}</span>
                <span className="text-secondary">{i.details.Phone}</span>
                <span className="text-secondary">{i.service ?? ""}</span>
                <span className="ml-auto text-secondary">{requestDate(i.request.created_at)}</span>
                <Badge tone={i.request.status === "done" ? "green" : "neutral"}>{i.request.status}</Badge>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </>
  );
}
