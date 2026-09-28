import { ButtonLink } from "@/components/ui/Button";
import { accountText, orderFormat } from "@/content/i18n/account";
import { fill, localDigits, type Locale } from "@/lib/i18n/config";
import { daysLeft, goalStatus, monthName, type GoalCoupon, type GoalSettings } from "@/lib/customer/goal";
import { inLang } from "@/lib/customer/loyalty";
import type { GoalRead } from "@/lib/customer/portal";

/**
 * The customer's monthly goal: what they've spent so far, the next rung and the reward it earns
 * (a progress bar, so the target is visible), and the rewards they already hold. Amounts come
 * from their own Velto orders and the admin's ladder; nothing here promises more than the owner wrote.
 */
export function GoalCard({ settings, goal, locale }: { settings: GoalSettings; goal: GoalRead; locale: Locale }) {
  const t = accountText(locale).goal;
  const f = orderFormat(locale);
  const s = goalStatus(settings, goal.spend);
  const month = monthName(goal.month, locale);
  const label = (r: { label: string; labelBn: string }) => inLang(r.label, r.labelBn, locale);
  const money = (n: number) => localDigits(n.toLocaleString("en-IN"), locale);
  const { left } = daysLeft(goal.today);
  const target = s.next?.spend ?? s.reached?.spend ?? 0;
  const done = Math.min(goal.spend, target);
  const held = goal.coupons.filter((c) => c.status === "open" || c.status === "used");

  return (
    <section aria-labelledby="goal-title" className="overflow-hidden rounded-lg border border-line bg-white" data-goal-card>
      <div className="px-5 pt-5 md:px-7 md:pt-6">
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
          <h2 id="goal-title" className="t-label uppercase text-secondary">
            {fill(t.label, { month }, locale)}
          </h2>
          <p className="t-small text-secondary">{left === 1 ? fill(t.daysLeftOne, { month }, locale) : fill(t.daysLeft, { n: left, month }, locale)}</p>
        </div>
        <p className="mt-1 text-[30px] font-semibold leading-[1.05] tracking-[-0.02em] text-navy md:text-[36px]">{fill(t.spent, { spend: money(goal.spend) }, locale)}</p>
        {goal.firstDoubled > 0 ? <p className="mt-1 t-small text-secondary">{fill(t.headStart, { n: money(goal.firstDoubled) }, locale)}</p> : null}

        <div className="mt-4">
          <p className="font-semibold text-navy">
            {s.next
              ? s.reached
                ? fill(t.reachedNext, { reward: label(s.reached), n: money(s.toNext), next: label(s.next) }, locale)
                : fill(t.toNext, { n: money(s.toNext), reward: label(s.next) }, locale)
              : s.reached
                ? fill(t.reachedTop, { month, reward: label(s.reached) }, locale)
                : ""}
          </p>
          <div
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={target}
            aria-valuenow={done}
            aria-label={fill(t.progressAria, { done: money(done), total: money(target), reward: s.next ? label(s.next) : s.reached ? label(s.reached) : "" }, locale)}
            className="mt-2.5 h-2.5 overflow-hidden rounded-full bg-soft"
          >
            <div className="h-full rounded-full bg-action" style={{ width: `${Math.max(3, Math.round(s.progress * 100))}%` }} />
          </div>
        </div>

        {/* The whole ladder, so the customer can see what a bigger month earns. */}
        <ol className="mt-4 divide-y divide-line border-y border-line" aria-label={t.rungs}>
          {settings.rungs.map((r) => {
            const got = goal.spend >= r.spend;
            return (
              <li key={r.spend} className="flex items-baseline justify-between gap-4 py-2 t-small">
                <span className={got ? "font-semibold text-navy" : "text-body"}>
                  {got ? "✓ " : ""}
                  {label(r)}
                </span>
                <span className={`shrink-0 tabular-nums ${got ? "text-navy" : "text-secondary"}`}>৳{money(r.spend)}</span>
              </li>
            );
          })}
        </ol>
      </div>

      {held.length ? (
        <div className="mt-5 border-t border-line bg-soft px-5 py-5 md:px-7">
          <h3 className="t-small font-semibold uppercase tracking-[0.04em] text-secondary">{t.couponsTitle}</h3>
          <ul className="mt-2 space-y-2">
            {held.map((c) => (
              <CouponRow key={c.id} c={c} locale={locale} day={(d) => f.day(d) ?? d} />
            ))}
          </ul>
          {held.some((c) => c.status === "open") ? (
            <>
              <p className="mt-3 t-small text-body">{t.couponHow}</p>
              <ButtonLink href="/book?source=account_goal" event="book_pickup_click" placement="account_goal" className="mt-3 !h-11 !px-5">
                {t.bookWith}
              </ButtonLink>
            </>
          ) : null}
        </div>
      ) : null}

      <p className="px-5 py-4 t-caption text-secondary md:px-7">{t.howItWorks}</p>
    </section>
  );
}

function CouponRow({ c, locale, day }: { c: GoalCoupon; locale: Locale; day: (iso: string) => string }) {
  const t = accountText(locale).goal;
  const open = c.status === "open";
  return (
    <li className={`flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 rounded-md border bg-white px-4 py-3 ${open ? "border-action" : "border-line"}`} data-coupon={c.status}>
      <span className="min-w-0">
        <span className="block font-semibold text-navy">{inLang(c.label, c.labelBn, locale)}</span>
        <span className="block t-small text-secondary">
          {open ? fill(t.couponOpen, { date: day(c.validTo) }, locale) : fill(t.couponUsed, { order: "" }, locale)}
        </span>
      </span>
      <span className={`shrink-0 rounded-sm px-2 py-0.5 text-[13px] font-semibold tabular-nums tracking-[0.04em] ${open ? "bg-action text-white" : "bg-soft text-secondary line-through"}`}>{c.code}</span>
    </li>
  );
}
