"use client";

import { useEffect, useRef, useState } from "react";
import { track } from "@/components/layout/Analytics";
import { WhatsAppButton } from "@/components/ui/Button";
import { WHATSAPP_URL } from "@/content/site";
import { ORDER_STAGES as STAGES } from "@/content/order-status";
import { formatAmount } from "@/lib/format-price";
import { useLocale } from "@/components/i18n/LocaleProvider";
import type { FormText } from "@/content/i18n/forms/en";
import { fill, format, localDigits, type Locale } from "@/lib/i18n/config";
import { TextField } from "./fields";

type Text = FormText["track"];
type Common = FormText["common"];

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

/** Dates and amounts in the page language. Order numbers and phone numbers never change digits. */
function formatters(c: Common, locale: Locale) {
  const date = (value: string | null) => {
    if (!value) return null;
    const d = new Date(value.length === 10 ? `${value}T00:00:00` : value);
    if (locale === "en") return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
    return fill(c.dayMonth, { weekday: c.weekdays[d.getDay()], day: d.getDate(), month: c.months[d.getMonth()] }, locale);
  };
  const taka = (n: number | null) => (n === null ? null : localDigits(formatAmount(Math.round(n * 100)), locale));
  return { date, taka };
}

/** A stage's customer-facing text, by Ops status. */
const stageText = (t: Text, status: string) => t.stages[status] ?? { title: status, copy: "" };

function Result({ order, t, c, locale }: { order: Order; t: Text; c: Common; locale: Locale }) {
  const { date, taka } = formatters(c, locale);
  const cancelled = order.status === "Cancelled";
  const current = STAGES.findIndex((s) => s.status === order.status);
  const currentStage = stageText(t, STAGES[Math.max(current, 0)].status);
  const expected = date(order.promisedAt) ?? date(order.deliveryDate);
  const facts = [
    { label: t.factItems, value: order.items ? localDigits(order.items, locale) : null },
    {
      label: t.factService,
      // Service names come from Ops as they are.
      value: order.services?.length
        ? order.services.map((x) => x.replace("Wash + Iron", "Wash & Iron")).join(", ") + (order.express ? t.express : "")
        : null,
    },
    { label: t.factCollected, value: date(order.pickupDate) },
    // "Expected back" leads the result instead; only the delivered date stays in the facts.
    { label: t.factDelivered, value: date(order.deliveredAt) },
    { label: t.factTotal, value: taka(order.total) },
    {
      label: t.factPayment,
      value:
        order.due && order.due > 0
          ? format(t.due, { amount: taka(order.due) ?? "" })
          : order.paymentStatus === "Paid" || order.due === 0
            ? t.paid
            : order.paymentStatus,
    },
  ].filter((f) => f.value);

  return (
    <div className="rounded-md border border-line bg-white p-5 md:p-8">
      <p className="t-label uppercase text-secondary">
        {format(t.orderLabel, { n: order.orderNumber })}
        <span className="text-action">{t.currentStatus}</span>
      </p>
      <h2 className="mt-3 t-h1 text-navy">{cancelled ? t.cancelled : currentStage.title}</h2>
      {cancelled ? (
        <p className="mt-3 t-body-lg text-body">{t.cancelledBody}</p>
      ) : (
        <>
          <p className="mt-3 t-body-lg text-body">{currentStage.copy}</p>
          {expected && !order.deliveredAt ? (
            <p className="mt-2 font-semibold text-navy">{format(t.expectedBack, { date: expected })}</p>
          ) : null}
        </>
      )}
      {cancelled ? null : (
        <ol aria-label={t.progressAria} className="mt-8 grid gap-0 border-t border-line pt-6 md:grid-cols-5 md:gap-3">
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
                  {done ? "✓" : localDigits(i + 1, locale)}
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
                    {stageText(t, stage.status).title}
                    <span className="sr-only">{done ? t.done : t.notYet}</span>
                  </span>
                  <span className="block t-small text-secondary">{stageText(t, stage.status).copy}</span>
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
function StatusGuide({ t }: { t: Text }) {
  return (
    <div className="border-t border-line pt-6">
      <h2 className="t-label uppercase text-navy">{t.guideTitle}</h2>
      <dl className="mt-3">
        {STAGES.map((stage) => (
          <div key={stage.status} className="grid grid-cols-[7.5rem_1fr] gap-4 border-b border-line py-3 md:grid-cols-[10rem_1fr]">
            <dt className="t-small font-semibold text-navy">{stageText(t, stage.status).title}</dt>
            <dd className="t-small text-body">{stageText(t, stage.status).copy}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-4 t-small text-secondary">{t.guideNoReceipt}</p>
    </div>
  );
}

export function TrackOrder({ t, common: c }: { t: Text; common: Common }) {
  const locale = useLocale();
  const [state, setState] = useState<State>({ kind: "idle" });
  const [errors, setErrors] = useState<{ orderNumber?: string; phone?: string }>({});
  const resultRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    track("track_order_open");
  }, []);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const orderNumber = String(form.get("orderNumber") ?? "").trim();
    const phone = String(form.get("phone") ?? "").trim();
    const next: typeof errors = {};
    if (!/\d/.test(orderNumber)) next.orderNumber = t.errorOrderNumber;
    if (phone.replace(/\D/g, "").length < 11) next.phone = t.errorPhone;
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
        setState({ kind: "error", message: t.tooMany });
      } else if (!res.ok) {
        setState({ kind: "error", message: t.failed });
      } else {
        const data = (await res.json()) as { found: boolean; order?: Order };
        setState(data.found && data.order ? { kind: "found", order: data.order } : { kind: "not_found" });
      }
    } catch {
      setState({ kind: "error", message: t.failed });
    }
    requestAnimationFrame(() => resultRef.current?.focus());
  }

  return (
    <div>
      <form onSubmit={onSubmit} noValidate className="grid gap-5 md:grid-cols-[1fr_1fr_auto] md:items-end">
        <TextField
          id="orderNumber"
          label={t.orderNumberLabel}
          helper={t.orderNumberHelp}
          placeholder="VEL-01940"
          autoComplete="off"
          autoCapitalize="characters"
          error={errors.orderNumber}
        />
        <TextField
          id="phone"
          label={t.phoneLabel}
          helper={t.phoneHelp}
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
              {t.checking}
            </>
          ) : (
            t.submit
          )}
        </button>
      </form>

      <div ref={resultRef} tabIndex={-1} aria-live="polite" className="mt-8 outline-none empty:hidden">
        {state.kind === "found" ? <Result order={state.order} t={t} c={c} locale={locale} /> : null}
        {state.kind === "not_found" ? (
          <div className="border-t border-line pt-6">
            <p className="t-h4 text-navy">{t.notFoundTitle}</p>
            <p className="mt-2 max-w-[52ch] text-secondary">{t.notFoundBody}</p>
            <WhatsAppButton href={WHATSAPP_URL} placement="track_not_found" className="mt-5" />
          </div>
        ) : null}
        {state.kind === "idle" ? <StatusGuide t={t} /> : null}
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
