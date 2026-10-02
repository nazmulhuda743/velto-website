import Link from "@/components/i18n/Link";
import { redirect } from "next/navigation";
import { getLocale, loginRedirectPath } from "@/lib/i18n/server";
import { accountText, orderFormat, type AccountText } from "@/content/i18n/account";
import { fill, format, type Locale } from "@/lib/i18n/config";
import { Alert } from "@/components/account/Alert";
import { LinkHistoryCard } from "@/components/account/LinkHistoryCard";
import { PlanBanner, planWhen } from "@/components/account/PlanBanner";
import { RewardsStrip } from "@/components/account/RewardsStrip";
import { NextPickupCard } from "@/components/account/NextPickupCard";
import { QuickRepeat } from "@/components/account/QuickRepeat";
import { RoutineCard } from "@/components/account/RoutineCard";
import { UpcomingPickups } from "@/components/account/UpcomingPickups";
import { OrderProgress } from "@/components/account/OrderProgress";
import { OrderRow } from "@/components/account/OrderRow";
import { ButtonLink, WhatsAppButton } from "@/components/ui/Button";
import { serviceLabel } from "@/content/order-status";
import { WHATSAPP_URL } from "@/content/site";
import { getCustomerSession, getDispatchPlans, getFeedbackList, getGoal, getLoyaltyCounts, getPickups, getPortalOrders, type DispatchPlan, type PortalOrder } from "@/lib/customer/portal";
import { orderToRate } from "@/lib/customer/extras";
import { getSiteContent } from "@/lib/site-content";
import { laundryRhythm, repeatHref } from "@/lib/customer/rhythm";
import { quickRepeatFor } from "@/lib/customer/quick-repeat";
import { getRoutine } from "@/lib/customer/routine";
import { formText } from "@/content/i18n/forms";
import { FIRST_ORDER_OFFER } from "@/lib/first-order-offer";
import { firstWebsiteBooking } from "@/lib/first-order-lookup";
import { usableCoupon } from "@/lib/customer/goal";
import { areaLabel, displayBdPhone, greetingName } from "@/lib/customer/validation";
import { NotifyCard } from "@/components/notify/NotifyCard";
import { notifyText } from "@/content/i18n/notify";
import { pushPrefsFromStatus, type PushPrefs } from "@/lib/push/prefs";
import { supabaseRpc } from "@/lib/supabase-server";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

type Home = AccountText["home"];

function greeting(t: Home) {
  const hour = Number(new Date().toLocaleString("en-GB", { hour: "numeric", hour12: false, timeZone: "Asia/Dhaka" }));
  return hour < 12 ? t.morning : hour < 17 ? t.afternoon : t.evening;
}

/** "Uttara Sector 7" in the page language (validation.areaLabel is the English form). */
const areaText = (area: string | null | undefined, locale: Locale, t: AccountText["forms"]) =>
  locale === "en" ? areaLabel(area) : !area ? null : area === "outside" ? t.areaOutside : fill(t.areaSector, { n: area }, locale);

function ActiveOrderCard({ order, more, t, locale, plan }: { order: PortalOrder; more: number; t: Home; locale: Locale; plan?: DispatchPlan }) {
  const { day, taka, statusTitle } = orderFormat(locale);
  const expected = order.promisedAt ?? order.deliveryDate;
  const p = accountText(locale).plan;
  // The planned delivery window from the dispatch board, when a manager has set one.
  const window = plan ? (planWhen(plan, locale) ?? `${day(plan.slotDate)}, ${p.slots[plan.slot]}${plan.assigneeName ? ` · ${fill(p.with, { name: plan.assigneeName }, locale)}` : ""}`) : null;
  return (
    <section aria-labelledby="active-title" className="rounded-lg border border-line bg-white p-5 shadow-[0_12px_32px_-26px_rgba(0,43,78,0.45)] md:p-7" data-active-order>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="t-label uppercase text-secondary">
          {t.inProgress}
          <span className="text-navy">{order.orderNumber}</span>
        </p>
        {order.express ? <p className="t-small font-semibold text-purple">{accountText(locale).order.express}</p> : null}
      </div>
      <h2 id="active-title" className="mt-2 text-[34px] font-semibold leading-[1.05] tracking-[-0.02em] text-navy md:text-[40px]">
        {statusTitle(order.status)}
      </h2>
      <div className="mt-6">
        <OrderProgress status={order.status} compact />
      </div>
      <dl className="mt-7 grid grid-cols-2 gap-x-6 gap-y-4 border-t border-line pt-5 md:grid-cols-3">
        <div className={window ? "col-span-2 md:col-span-3" : ""}>
          <dt className="t-caption uppercase tracking-[0.04em] text-secondary">{window ? p.windowLabel : t.expectedBack}</dt>
          <dd className="mt-0.5 font-semibold text-navy" data-delivery-window={window ? "" : undefined}>
            {window ?? day(expected) ?? t.weConfirm}
          </dd>
        </div>
        <div>
          <dt className="t-caption uppercase tracking-[0.04em] text-secondary">{order.due > 0 ? t.amountDue : t.payment}</dt>
          <dd className={`mt-0.5 font-semibold ${order.due > 0 ? "text-navy" : "text-success"}`}>{order.due > 0 ? taka(order.due) : t.paid}</dd>
        </div>
        <div className="col-span-2 md:col-span-1">
          <dt className="t-caption uppercase tracking-[0.04em] text-secondary">{t.service}</dt>
          <dd className="mt-0.5 font-semibold text-navy">
            {order.services.map(serviceLabel).join(", ") || t.laundry}
            {order.items ? <span className="font-normal text-secondary">{fill(t.items, { n: order.items }, locale)}</span> : null}
          </dd>
        </div>
      </dl>
      <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3">
        <Link href={`/account/orders/${order.orderNumber}`} className="font-semibold text-navy underline decoration-blue/50 underline-offset-4 hover:decoration-blue">
          {t.viewOrder}
        </Link>
        {more > 0 ? (
          <Link href="/account/orders" className="t-small font-semibold text-secondary underline underline-offset-4 hover:text-navy">
            {fill(more === 1 ? t.moreOne : t.moreMany, { n: more }, locale)}
          </Link>
        ) : null}
      </div>
    </section>
  );
}

export default async function AccountHome({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const session = await getCustomerSession();
  if (session.kind !== "customer" || session.account.state !== "ready") redirect(await loginRedirectPath("/account"));
  const account = session.account;
  const linked = account.link.status === "linked";
  const [{ loyalty }, pickupData] = await Promise.all([getSiteContent(), getPickups()]);
  const pickups = pickupData?.verified ? pickupData.pickups : [];
  const [orders, counts, feedback, goal, plans] = linked
    ? await Promise.all([getPortalOrders(), loyalty.enabled ? getLoyaltyCounts(loyalty.windowMonths) : null, getFeedbackList(), loyalty.goal.enabled ? getGoal(loyalty.goal.doubleFirst) : null, getDispatchPlans()])
    : [[], null, [], null, []];
  // A coupon a booking would carry today (as on /book): staff apply it or the 10%, whichever saves more.
  const holdsCoupon = goal ? usableCoupon(goal.coupons, goal.today) !== null : false;
  // The first-order 10% banner: only while this number has no website booking yet.
  const firstOrder = account.phone ? (await firstWebsiteBooking(account.phone)) === "first" : false;
  // A delivered order from the last two weeks that isn't rated yet: ask once, on the home.
  const toRate = orderToRate(orders ?? [], new Set(feedback.map((f) => f.orderNumber)));
  const active = (orders ?? []).filter((o) => o.active);
  const recent = (orders ?? []).filter((o) => o !== active[0]).slice(0, 3);
  const rhythm = laundryRhythm(orders ?? []);
  const name = greetingName(account.fullName);
  const hasAddress = Boolean(account.address && account.area);
  const locale = await getLocale();
  // Nothing in progress and a last order: book it again with a day and a time, no form.
  const quick = !active[0] && !pickups.length && rhythm.last && linked ? await quickRepeatFor(account, rhythm.last.orderNumber, rhythm.repeatService, locale) : null;
  const routineRead = linked ? await getRoutine() : null;
  const routine = routineRead === "error" ? null : routineRead;
  // From the second order on (or once they have one): a fixed weekly day is what makes it a habit.
  const showRoutine = linked && routineRead !== "error" && (Boolean(routine) || rhythm.count >= 2);
  const a = accountText(locale);
  const t = a.home;
  const f = formText(locale);
  // Notifications on this login's phones (the card itself checks this browser).
  const push = await supabaseRpc<{ devices: number } & Partial<PushPrefs>>("website_push_status", { p_auth_user_id: session.user.id }).catch(() => null);

  return (
    <div className="space-y-5 md:space-y-6">
      <header>
        <h1 className="t-h1 text-navy">
          {greeting(t)}
          {name ? format(t.greetingName, { name }) : ""}
          {t.greetingEnd}
        </h1>
        <p className="mt-1.5 t-body-lg text-body">
          {active.length
            ? active.length === 1
              ? t.activeOne
              : fill(t.activeMany, { n: active.length }, locale)
            : linked
              ? t.nothing
              : t.ready}
        </p>
      </header>

      {params.welcome ? <Alert tone="success">{t.welcome}</Alert> : null}
      {params.restored ? <Alert tone="success">{a.welcomeBack.restored}</Alert> : null}
      {orders === null ? <Alert tone="error">{t.ordersFailed}</Alert> : null}

      {/* 0. The rider is coming today or tomorrow: say so first. */}
      <PlanBanner plans={plans} locale={locale} />
      {/* 0. A pickup already booked on the website: when it is, and change or cancel it. */}
      {pickups.length ? <UpcomingPickups pickups={pickups} locale={locale} /> : null}

      {/* 1. What's happening with my laundry, or 2. the next pickup (first → the same again) */}
      {active[0] ? (
        <>
          <ActiveOrderCard order={active[0]} more={active.length - 1} t={t} locale={locale} plan={plans.find((x) => x.kind === "delivery" && x.orderNumber === active[0].orderNumber)} />
          <div className="flex flex-col gap-3 sm:flex-row">
            <ButtonLink href="/book?source=account" event="book_pickup_click" placement="account_home" className="sm:!px-8">
              {t.bookAnother}
            </ButtonLink>
            <ButtonLink href="/account/orders" variant="secondary">
              {t.viewAll}
            </ButtonLink>
          </div>
        </>
      ) : orders !== null && !pickups.length ? (
        <NextPickupCard
          rhythm={rhythm}
          locale={locale}
          firstTime={linked}
          quick={
            quick && rhythm.last ? (
              <QuickRepeat {...quick} t={a.quick} changeHref={repeatHref(rhythm, `account_${rhythm.stage}`)} placement={`account_quick_${rhythm.stage}`} />
            ) : undefined
          }
        />
      ) : null}

      {/* 10% off the first website order (lib/first-order-offer.ts). */}
      {firstOrder ? (
      <section aria-labelledby="offer-title" className="rounded-lg border border-line bg-white p-5 md:p-6" data-first-order-banner>
        <h2 id="offer-title" className="font-semibold text-navy">
          {fill(t.offerTitle, { percent: FIRST_ORDER_OFFER.percent }, locale)}
        </h2>
        <p className="mt-1 t-small text-body">
          {t.offerBody}
          {holdsCoupon ? ` ${t.offerCoupon}` : null}
        </p>
      </section>
      ) : null}

      {toRate ? (
        <section aria-labelledby="rate-title" className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-line bg-white p-5 md:p-6" data-rate-ask>
          <div>
            <h2 id="rate-title" className="font-semibold text-navy">
              {format(a.feedback.askTitle, { n: toRate.orderNumber })}
            </h2>
            <p className="mt-1 t-small text-body">{a.feedback.askBody}</p>
          </div>
          <ButtonLink href={`/account/orders/${toRate.orderNumber}#rate`} variant="secondary" className="!h-11 !px-5">
            {a.feedback.askButton}
          </ButtonLink>
        </section>
      ) : null}

      {/* Order updates and reminders on the phone: the value first, then the phone's own prompt. */}
      <NotifyCard t={notifyText(locale)} lang={locale === "bn" ? "bn" : "en"} initialPrefs={pushPrefsFromStatus(push)} />

      {linked ? <RewardsStrip loyalty={loyalty} counts={counts} goal={goal} locale={locale} /> : null}

      {linked && recent.length ? (
        <section aria-labelledby="recent-title">
          <div className="flex items-baseline justify-between">
            <h2 id="recent-title" className="text-[20px] font-semibold tracking-[-0.01em] text-navy">
              {t.recent}
            </h2>
            <Link href="/account/orders" className="t-small font-semibold text-navy underline decoration-blue/50 underline-offset-4">
              {t.seeAll}
            </Link>
          </div>
          <ul className="mt-3 overflow-hidden rounded-lg border border-line bg-white">
            {recent.map((o) => (
              <OrderRow key={o.orderNumber} order={o} />
            ))}
          </ul>
        </section>
      ) : null}

      {/* 3. Pickup details, 4. support */}
      <div className="grid gap-4 md:grid-cols-2 md:gap-5">
        <section aria-labelledby="details-title" className="rounded-lg border border-line bg-white p-5" data-pickup-details>
          <div className="flex items-baseline justify-between gap-4">
            <h2 id="details-title" className="font-semibold text-navy">
              {hasAddress ? t.pickupDetails : t.completeDetails}
            </h2>
            <Link href="/account/profile" className="t-small font-semibold text-navy underline decoration-blue/50 underline-offset-4">
              {hasAddress ? t.edit : t.add}
            </Link>
          </div>
          <dl className="mt-3 space-y-2.5 t-small">
            <div>
              <dt className="text-secondary">{t.name}</dt>
              <dd className="font-medium text-navy">{account.fullName}</dd>
            </div>
            <div>
              <dt className="text-secondary">{t.mobile}</dt>
              <dd className="font-medium text-navy">
                {displayBdPhone(account.phone)}
                {linked ? <span className="ml-2 font-semibold text-success">{t.verified}</span> : null}
              </dd>
            </div>
            <div>
              <dt className="text-secondary">{t.address}</dt>
              <dd className="font-medium text-navy">
                {[account.address, areaText(account.area, locale, a.forms)].filter(Boolean).join(", ") || (
                  <span className="font-normal text-secondary">{t.addressMissing}</span>
                )}
              </dd>
            </div>
          </dl>
        </section>

        <section aria-labelledby="help-title" className="rounded-lg border border-line bg-white p-5">
          <h2 id="help-title" className="font-semibold text-navy">
            {t.helpTitle}
          </h2>
          <p className="mt-2 t-small text-body">{t.helpBody}</p>
          <WhatsAppButton href={WHATSAPP_URL} placement="account_help" className="mt-4 !h-11 !px-5" />
        </section>
      </div>

      {/* 5. Secondary setup */}
      <LinkHistoryCard account={account} />

      {showRoutine ? (
        <RoutineCard
          routine={routine}
          hasAddress={hasAddress}
          t={a.routine}
          days={f.bookPage.routineDays}
          windows={f.booking.slots}
          services={f.booking.services}
          nextOnLabel={routine?.nextOn ? orderFormat(locale).day(routine.nextOn) : null}
          suggestedDay={rhythm.usualWeekday}
          suggestedService={rhythm.repeatService}
        />
      ) : null}
    </div>
  );
}
