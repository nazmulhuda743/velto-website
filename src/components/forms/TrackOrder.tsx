"use client";

import { useRef, useState } from "react";
import { WhatsAppButton } from "@/components/ui/Button";
import { WHATSAPP_URL } from "@/content/site";
import { formatAmount } from "@/lib/format-price";
import { TextField } from "./fields";

type Order = {
  orderNumber: string;
  status: string;
  orderDate: string | null;
  pickupDate: string | null;
  deliveryDate: string | null;
  promisedAt: string | null;
  deliveredAt: string | null;
  items: number | null;
  services: string[] | null;
  express: boolean | null;
  total: number | null;
  due: number | null;
  paymentStatus: string | null;
};

type State =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "found"; order: Order }
  | { kind: "not_found" }
  | { kind: "error"; message: string };

/** Ops status → customer-facing stage. */
const STAGES = [
  { status: "New", title: "Booked", copy: "Your order is booked." },
  { status: "Picked", title: "Collected", copy: "We've collected it from your address." },
  { status: "In Velto Facility", title: "Being cleaned", copy: "Checked in, tagged and being cleaned." },
  { status: "Ready", title: "Ready", copy: "Cleaned, checked and packed for return." },
  { status: "Delivered", title: "Delivered", copy: "Returned to you." },
];

const date = (value: string | null) =>
  value
    ? new Date(value.length === 10 ? `${value}T00:00:00` : value).toLocaleDateString("en-GB", {
        weekday: "short",
        day: "numeric",
        month: "short",
      })
    : null;

const taka = (n: number | null) => (n === null ? null : formatAmount(Math.round(n * 100)));

function Result({ order }: { order: Order }) {
  const cancelled = order.status === "Cancelled";
  const current = STAGES.findIndex((s) => s.status === order.status);
  const expected = date(order.promisedAt) ?? date(order.deliveryDate);
  const facts = [
    { label: "Items", value: order.items ? String(order.items) : null },
    { label: "Service", value: order.services?.length ? order.services.map((x) => x.replace("Wash + Iron", "Wash & Iron")).join(", ") + (order.express ? " · Express" : "") : null },
    { label: "Collected", value: date(order.pickupDate) },
    { label: order.deliveredAt ? "Delivered" : "Expected back", value: date(order.deliveredAt) ?? expected },
    { label: "Order total", value: taka(order.total) },
    {
      label: "Payment",
      value: order.due && order.due > 0 ? `${taka(order.due)} due` : order.paymentStatus === "Paid" || order.due === 0 ? "Paid" : order.paymentStatus,
    },
  ].filter((f) => f.value);

  return (
    <div className="rounded-lg border border-line bg-white p-5 md:p-8">
      <p className="t-label uppercase text-secondary">Order {order.orderNumber}</p>
      <h2 className="mt-2 t-h3 text-navy">
        {cancelled ? "This order was cancelled." : STAGES[Math.max(current, 0)].title}
      </h2>
      {cancelled ? (
        <p className="mt-2 text-secondary">If this doesn&apos;t look right, message Velto on WhatsApp.</p>
      ) : (
        <ol className="mt-6 grid gap-0 md:grid-cols-5 md:gap-3">
          {STAGES.map((stage, i) => {
            const done = i <= current;
            return (
              <li
                key={stage.status}
                aria-current={i === current ? "step" : undefined}
                className="relative flex gap-3 pb-5 last:pb-0 md:block md:pb-0"
              >
                <span
                  aria-hidden="true"
                  className={`relative z-10 mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-full border-2 text-[12px] font-semibold ${
                    done ? "border-blue bg-blue text-white" : "border-line-strong bg-white text-secondary"
                  }`}
                >
                  {done ? "✓" : i + 1}
                </span>
                {i < STAGES.length - 1 ? (
                  <span
                    aria-hidden="true"
                    className={`absolute left-[11px] top-7 h-[calc(100%-1.5rem)] w-0.5 md:left-7 md:top-3 md:h-0.5 md:w-[calc(100%-1rem)] ${
                      i < current ? "bg-blue" : "bg-line"
                    }`}
                  />
                ) : null}
                <span className="md:mt-3 md:block">
                  <span className={`block font-semibold ${done ? "text-navy" : "text-secondary"}`}>
                    {stage.title}
                    <span className="sr-only">{done ? " (done)" : " (not yet)"}</span>
                  </span>
                  <span className="block t-small text-secondary">{stage.copy}</span>
                </span>
              </li>
            );
          })}
        </ol>
      )}
      {facts.length ? (
        <dl className="mt-8 grid grid-cols-2 gap-x-6 border-t border-line pt-5 md:grid-cols-3">
          {facts.map((f) => (
            <div key={f.label} className="py-2">
              <dt className="t-caption uppercase tracking-[0.04em] text-secondary">{f.label}</dt>
              <dd className="mt-0.5 font-semibold text-navy">{f.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </div>
  );
}

/** Shown before a lookup, so the statuses mean something before the customer needs them. */
function StatusGuide() {
  return (
    <div className="border-t border-line pt-6">
      <h2 className="t-label uppercase text-navy">What each status means</h2>
      <dl className="mt-3">
        {STAGES.map((stage) => (
          <div key={stage.status} className="grid grid-cols-[7.5rem_1fr] gap-4 border-b border-line py-3 md:grid-cols-[10rem_1fr]">
            <dt className="t-small font-semibold text-navy">{stage.title}</dt>
            <dd className="t-small text-body">{stage.copy}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-4 t-small text-secondary">Can&apos;t find your receipt? Message Velto from the number you booked with.</p>
    </div>
  );
}

export function TrackOrder() {
  const [state, setState] = useState<State>({ kind: "idle" });
  const [errors, setErrors] = useState<{ orderNumber?: string; phone?: string }>({});
  const resultRef = useRef<HTMLDivElement>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const orderNumber = String(form.get("orderNumber") ?? "").trim();
    const phone = String(form.get("phone") ?? "").trim();
    const next: typeof errors = {};
    if (!/\d/.test(orderNumber)) next.orderNumber = "Enter the order number from your receipt, for example VEL-01940.";
    if (phone.replace(/\D/g, "").length < 11) next.phone = "Enter the phone number used for the order.";
    setErrors(next);
    if (Object.keys(next).length) return;

    setState({ kind: "loading" });
    try {
      const res = await fetch("/api/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderNumber, phone }),
      });
      if (res.status === 429) {
        setState({ kind: "error", message: "Too many attempts. Please wait a few minutes, or ask Velto on WhatsApp." });
      } else if (!res.ok) {
        setState({ kind: "error", message: "We couldn't check your order just now. Please try again, or ask Velto on WhatsApp." });
      } else {
        const data = (await res.json()) as { found: boolean; order?: Order };
        setState(data.found && data.order ? { kind: "found", order: data.order } : { kind: "not_found" });
      }
    } catch {
      setState({ kind: "error", message: "We couldn't check your order just now. Please try again, or ask Velto on WhatsApp." });
    }
    requestAnimationFrame(() => resultRef.current?.focus());
  }

  return (
    <div>
      <form onSubmit={onSubmit} noValidate className="grid gap-5 md:grid-cols-[1fr_1fr_auto] md:items-end">
        <TextField
          id="orderNumber"
          label="Order number"
          helper="You'll find it on your Velto receipt."
          placeholder="VEL-01940"
          autoComplete="off"
          autoCapitalize="characters"
          error={errors.orderNumber}
        />
        <TextField
          id="phone"
          label="Phone number"
          helper="The one you gave when booking."
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="01XXXXXXXXX"
          error={errors.phone}
        />
        <button
          type="submit"
          disabled={state.kind === "loading"}
          aria-busy={state.kind === "loading" || undefined}
          className={`inline-flex h-[54px] items-center justify-center rounded-md bg-action px-6 font-semibold text-white hover:bg-action-hover disabled:opacity-70 md:h-[52px] ${
            errors.orderNumber || errors.phone ? "md:mb-[30px]" : ""
          }`}
        >
          {state.kind === "loading" ? (
            <>
              <span aria-hidden="true" className="mr-2.5 size-4 animate-spin rounded-full border-2 border-white/40 border-t-white motion-reduce:animate-none" />
              Checking…
            </>
          ) : (
            "Track Order"
          )}
        </button>
      </form>

      <div ref={resultRef} tabIndex={-1} aria-live="polite" className="mt-8 outline-none empty:hidden">
        {state.kind === "found" ? <Result order={state.order} /> : null}
        {state.kind === "not_found" ? (
          <div className="border-t border-line pt-6">
            <p className="t-h4 text-navy">We couldn&apos;t find that order.</p>
            <p className="mt-2 max-w-[52ch] text-secondary">
              Check the order number on your receipt and use the phone number you gave when booking. If it still
              doesn&apos;t show, message Velto and we&apos;ll check for you.
            </p>
            <WhatsAppButton href={WHATSAPP_URL} placement="track_not_found" className="mt-5" />
          </div>
        ) : null}
        {state.kind === "idle" ? <StatusGuide /> : null}
        {state.kind === "error" ? (
          <div role="alert" className="border-t border-line pt-6">
            <p className="t-h4 text-navy">{state.message}</p>
            <WhatsAppButton href={WHATSAPP_URL} placement="track_error" className="mt-5" />
          </div>
        ) : null}
      </div>
    </div>
  );
}
