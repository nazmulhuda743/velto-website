"use client";

import { useEffect, useState } from "react";
import { FREE_DELIVERY_THRESHOLD } from "@/content/site";
import { FREE_DELIVERY_MIN_MINOR, MIXED_ITEM, type ItemService } from "@/lib/booking-items";
import { progressToFree, smartAddOns, type SmartAddOn, type UpsellHints } from "@/lib/booking-upsell";
import { FIRST_ORDER_OFFER } from "@/lib/first-order-offer";
import { fill, format, localDigits, type Locale } from "@/lib/i18n/config";
import { lineUnit, money, type PriceItem } from "./BookingItems";
import { estimateOf, NO_HINTS, withCoupon, type Coupon, type FirstOrderLine, type FormState, type Text } from "./booking-form-model";

/** The order summary right above Confirm: items and prices, pickup & delivery, and the estimated total. */
export function OrderSummary({
  s,
  t,
  locale,
  chargeMinor,
  offer,
  coupon,
  firstOrder,
  signInHref,
  popular = [],
  hints = NO_HINTS,
  onAdd,
}: {
  s: FormState;
  t: Text;
  locale: Locale;
  chargeMinor: number | null;
  offer?: string;
  coupon?: Coupon;
  firstOrder?: FirstOrderLine;
  signInHref?: string;
  popular?: PriceItem[];
  /** What this customer usually sends and what customers send together (smart add-ons). */
  hints?: UpsellHints;
  /** Adds one of an item on a service (the add-ons); `reason` says why it was offered. */
  onAdd?: (item: PriceItem, service: ItemService, reason: SmartAddOn["reason"]["kind"]) => void;
}) {
  const e = withCoupon(estimateOf(s, chargeMinor), coupon);
  const threshold = localDigits(FREE_DELIVERY_THRESHOLD, locale);
  const priced = e.subtotalMinor > 0;
  const gap = FREE_DELIVERY_MIN_MINOR - e.subtotalMinor;
  const addOns = priced && onAdd ? smartAddOns(s.items, popular, e.free ? 0 : gap, hints, s.services) : [];
  const row = "flex items-baseline justify-between gap-4 py-2";
  const addOnsView = addOns.length ? (
    <div className="mt-3" data-add-ons>
      <p className="t-small font-semibold text-navy">{addOns.some((a) => a.reason.kind !== "popular") ? t.addOnsTitleOften : t.addOnsTitle}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {addOns.map((a) => {
          const listed = popular.find((p) => p.name === a.item);
          const why = a.reason.kind === "usual" ? t.addOnUsual : a.reason.kind === "pair" ? format(t.addOnPair, { item: a.reason.with }) : null;
          return (
            <button
              key={`${a.item}-${a.service}`}
              type="button"
              onClick={() => listed && onAdd?.(listed, a.service as ItemService, a.reason.kind)}
              className="inline-flex min-h-11 flex-col items-start justify-center rounded-2xl border border-line-strong bg-white px-3.5 py-1.5 text-left t-small text-navy hover:border-navy"
              data-add-on={a.reason.kind}
            >
              <span className="inline-flex items-center gap-1.5">
                <span aria-hidden="true" className="font-semibold text-action">+</span>
                <span className="font-semibold">{a.item}</span>
                <span className="text-secondary">
                  · {t.services[a.service]} · {money(a.amountMinor, locale)}
                </span>
              </span>
              {why ? <span className="t-caption text-secondary">{why}</span> : null}
            </button>
          );
        })}
      </div>
    </div>
  ) : null;
  return (
    <section aria-labelledby="booking-summary-title" className="rounded-md border border-line bg-soft p-4 md:p-5" data-order-summary>
      <h2 id="booking-summary-title" className="t-h4 text-navy">
        {t.summaryTitle}
      </h2>
      {s.items.length ? (
        <ul className="mt-3 divide-y divide-line border-y border-line">
          {s.items.map((l) => {
            const unit = lineUnit(l);
            return (
              <li key={l.id} className={`${row} t-small`}>
                <span className="min-w-0 text-body">
                  {localDigits(l.quantity, locale)} × {l.item === MIXED_ITEM ? t.mixedItem : l.item}
                  <span className="text-secondary"> · {l.service ? t.services[l.service] : t.itemNotSure}</span>
                </span>
                <span className={`shrink-0 tabular-nums ${unit === null ? "text-secondary" : "text-navy"}`}>
                  {unit === null ? t.items.atPickup : money(unit * l.quantity, locale)}
                </span>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-2 t-small text-body">{t.summaryEmpty}</p>
      )}
      {priced ? (
        <dl className="mt-1">
          <div className={row}>
            <dt className="t-small text-body">{t.summaryItems}</dt>
            <dd className="t-small tabular-nums text-navy">{money(e.subtotalMinor, locale)}</dd>
          </div>
          <div className={`${row} border-b border-line`}>
            <dt className="t-small text-body">{t.summaryDelivery}</dt>
            <dd className="t-small tabular-nums text-navy">
              {e.free ? t.summaryFree : e.chargeMinor !== null ? money(e.chargeMinor, locale) : t.summaryChargeUnknown}
            </dd>
          </div>
          <div className={`${row} pt-3`}>
            <dt className="font-semibold text-navy">{t.summaryTotal}</dt>
            <dd className="text-[20px] font-semibold tabular-nums text-navy" data-estimate-total>
              {/* Keyed on the amount: a new total ticks in, so the change is noticed. */}
              <span key={e.totalMinor} className="inline-block" data-tick>
                {money(e.totalMinor, locale)}
              </span>
            </dd>
          </div>
        </dl>
      ) : null}
      <div className="mt-2 space-y-1.5 t-small">
        {priced && !e.free ? (
          <div data-free-progress>
            <p className="font-semibold text-navy">{format(t.summaryChargeNote, { amount: threshold, more: money(gap, locale) })}</p>
            <div
              role="progressbar"
              aria-label={t.freeProgressLabel}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={progressToFree(e.subtotalMinor, FREE_DELIVERY_MIN_MINOR)}
              className="mt-2 h-2 overflow-hidden rounded-full bg-line"
            >
              <div
                className="h-full origin-left rounded-full bg-action"
                style={{ transform: `scaleX(${progressToFree(e.subtotalMinor, FREE_DELIVERY_MIN_MINOR) / 100})` }}
                data-progress-fill
              />
            </div>
            <p className="mt-1 t-caption tabular-nums text-secondary">
              {money(e.subtotalMinor, locale)} / {money(FREE_DELIVERY_MIN_MINOR, locale)}
            </p>
            {!e.free ? addOnsView : null}
          </div>
        ) : priced && e.free && !coupon ? (
          <div>
            <p className="font-semibold text-success" data-free-unlocked>
              ✓ {t.freeUnlocked}
            </p>
            {addOnsView}
          </div>
        ) : !priced ? (
          <p className="text-navy">{format(t.summaryFreeNote, { amount: threshold })}</p>
        ) : null}
        {priced && e.unpricedLines ? (
          <p className="text-secondary">{e.unpricedLines === 1 ? t.summaryUnpricedOne : fill(t.summaryUnpricedMany, { n: e.unpricedLines }, locale)}</p>
        ) : null}
        {coupon ? (
          <p className="font-semibold text-navy" data-coupon={coupon.code}>
            {format(t.summaryCoupon, { code: coupon.code, what: coupon.kind === "delivery" ? t.couponDelivery : fill(t.couponTaka, { n: coupon.amount }, locale) })}
          </p>
        ) : null}
        {firstOrder ? (
          <p className="font-semibold text-navy" data-first-order={firstOrder}>
            {fill(firstOrder === "guest" ? t.firstOrderGuest : coupon ? t.firstOrderOrCoupon : t.firstOrderYours, { percent: FIRST_ORDER_OFFER.percent }, locale)}
            {firstOrder === "guest" && signInHref ? (
              <>
                {" "}
                <a href={signInHref} className="underline decoration-blue/50 underline-offset-4 hover:decoration-blue">
                  {t.firstOrderSignIn}
                </a>
              </>
            ) : null}
          </p>
        ) : null}
        {offer ? (
          // The website's current offer (the top bar), so it is still in view at the moment of booking.
          <p className="font-semibold text-navy" data-offer>
            <span className="text-secondary">{t.summaryOffer} </span>
            {offer}
          </p>
        ) : null}
        <p className="text-secondary">{t.summaryNote}</p>
      </div>
    </section>
  );
}


/**
 * Phones only: once items are added, a slim bar keeps the count and estimate in view while the
 * customer fills in the rest, and jumps to the order summary. Hidden from md up, where the
 * summary sits close to the form.
 */
export function MobileTotalBar({ s, t, locale, chargeMinor, coupon }: { s: FormState; t: Text; locale: Locale; chargeMinor: number | null; coupon?: Coupon }) {
  // Steps aside once the summary is on screen, so it never covers the summary, Confirm or the footer.
  const [beforeSummary, setBeforeSummary] = useState(true);
  useEffect(() => {
    const summary = document.getElementById("booking-summary-title");
    if (!summary) return;
    const check = () => setBeforeSummary(summary.getBoundingClientRect().top > window.innerHeight);
    check();
    window.addEventListener("scroll", check, { passive: true });
    window.addEventListener("resize", check);
    return () => {
      window.removeEventListener("scroll", check);
      window.removeEventListener("resize", check);
    };
  }, []);
  if (!s.items.length || !beforeSummary) return null;
  const e = withCoupon(estimateOf(s, chargeMinor), coupon);
  const count = s.items.reduce((n, l) => n + l.quantity, 0);
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white/95 px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 shadow-[0_-8px_24px_rgba(0,49,83,0.08)] backdrop-blur md:hidden" data-total-bar>
      <div className="flex items-center justify-between gap-3">
        <p className="min-w-0 t-small text-body">
          {count === 1 ? t.barItemsOne : fill(t.barItems, { n: count }, locale)}
          {e.subtotalMinor > 0 ? <span key={e.totalMinor} className="ml-2 inline-block font-semibold tabular-nums text-navy" data-tick>{money(e.totalMinor, locale)}</span> : null}
          {e.subtotalMinor > 0 && !e.free ? (
            <span className="block t-caption text-action" data-bar-to-free>
              {fill(t.barToFree, { more: money(FREE_DELIVERY_MIN_MINOR - e.subtotalMinor, locale) }, locale)}
            </span>
          ) : null}
        </p>
        <a href="#booking-summary-title" className="inline-flex h-11 shrink-0 items-center rounded-md bg-action px-5 font-semibold text-white hover:bg-action-hover">
          {t.barReview}
        </a>
      </div>
    </div>
  );
}
