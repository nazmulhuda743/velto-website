import Link from "@/components/i18n/Link";
import { redirect } from "next/navigation";
import { getLocale, loginRedirectPath } from "@/lib/i18n/server";
import { accountText, orderFormat, type AccountText } from "@/content/i18n/account";
import { fill, format, localizeHref, type Locale } from "@/lib/i18n/config";
import { Alert } from "@/components/account/Alert";
import { LinkHistoryCard } from "@/components/account/LinkHistoryCard";
import { NextPickupCard } from "@/components/account/NextPickupCard";
import { OrderProgress } from "@/components/account/OrderProgress";
import { OrderRow } from "@/components/account/OrderRow";
import { ButtonLink, WhatsAppButton } from "@/components/ui/Button";
import { serviceLabel } from "@/content/order-status";
import { WHATSAPP_URL } from "@/content/site";
import { getCustomerSession, getPortalOrders, type PortalOrder } from "@/lib/customer/portal";
import { laundryRhythm, ROUTINE_DAYS } from "@/lib/customer/rhythm";
import { formText } from "@/content/i18n/forms";
import { areaLabel, displayBdPhone, greetingName } from "@/lib/customer/validation";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

type Home = AccountText["home"];

function greeting(t: Home) {
  const hour = Number(new Date().toLocaleString("en-GB", { hour: "numeric", hour12: false, timeZone: "Asia/Dhaka" }));
  return hour < 12 ? t.morning : hour < 17 ? t.afternoon : t.evening;
}

/** "Uttara Sector 7" in the page language (validation.areaLabel is the English form). */
const areaText = (area: string | null | undefined, locale: Locale, t: AccountText["forms"]) =>
  locale === "en" ? areaLabel(area) : !area ? null : area === "outside" ? t.areaOutside : fill(t.areaSector, { n: area }, locale);

function ActiveOrderCard({ order, more, t, locale }: { order: PortalOrder; more: number; t: Home; locale: Locale }) {
  const { day, taka, statusTitle } = orderFormat(locale);
  const expected = order.promisedAt ?? order.deliveryDate;
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
        <div>
          <dt className="t-caption uppercase tracking-[0.04em] text-secondary">{t.expectedBack}</dt>
          <dd className="mt-0.5 font-semibold text-navy">{day(expected) ?? t.weConfirm}</dd>
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
  const orders = linked ? await getPortalOrders() : [];
  const active = (orders ?? []).filter((o) => o.active);
  const recent = (orders ?? []).filter((o) => o !== active[0]).slice(0, 3);
  const rhythm = laundryRhythm(orders ?? []);
  // From the second order on: turning repeat orders into a fixed day is what makes them a habit.
  const suggestRegular = linked && rhythm.count >= 2;
  const name = greetingName(account.fullName);
  const hasAddress = Boolean(account.address && account.area);
  const locale = await getLocale();
  const a = accountText(locale);
  const t = a.home;
  const f = formText(locale);

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

      {params.password === "updated" ? <Alert tone="success">{t.passwordUpdated}</Alert> : null}
      {params.welcome ? <Alert tone="success">{t.welcome}</Alert> : null}
      {orders === null ? <Alert tone="error">{t.ordersFailed}</Alert> : null}

      {/* 1. What's happening with my laundry, or 2. the next pickup (first → the same again) */}
      {active[0] ? (
        <>
          <ActiveOrderCard order={active[0]} more={active.length - 1} t={t} locale={locale} />
          <div className="flex flex-col gap-3 sm:flex-row">
            <ButtonLink href="/book?source=account" event="book_pickup_click" placement="account_home" className="sm:!px-8">
              {t.bookAnother}
            </ButtonLink>
            <ButtonLink href="/account/orders" variant="secondary">
              {t.viewAll}
            </ButtonLink>
          </div>
        </>
      ) : orders !== null ? (
        <NextPickupCard rhythm={rhythm} locale={locale} firstTime={linked} />
      ) : null}

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

      {suggestRegular ? (
        <section aria-labelledby="regular-title" className="rounded-lg bg-navy p-5 text-white md:p-6" data-routine>
          <h2 id="regular-title" className="text-[20px] font-semibold tracking-[-0.01em]">
            {t.regularTitle}
          </h2>
          <p className="mt-1.5 max-w-[56ch] t-small text-white/80">{t.regularBody}</p>
          {/* A plain GET form: no script needed, and /book re-validates both values. */}
          <form action={localizeHref("/book", locale)} className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
            <input type="hidden" name="source" value="account_routine" />
            <label className="block t-small font-semibold">
              {t.routineEvery}
              <select name="routine" defaultValue={(rhythm.everyDays ?? 7) > 10 ? "fortnightly" : "weekly"} className="mt-1 block h-11 w-full rounded-md border border-white/40 bg-navy px-3 text-white sm:w-48">
                <option value="weekly">{t.routineWeekly}</option>
                <option value="fortnightly">{t.routineFortnightly}</option>
              </select>
            </label>
            <label className="block t-small font-semibold">
              {t.routineDay}
              <select name="day" defaultValue={ROUTINE_DAYS[rhythm.usualWeekday ?? 6]} className="mt-1 block h-11 w-full rounded-md border border-white/40 bg-navy px-3 text-white sm:w-44">
                {ROUTINE_DAYS.map((d, i) => (
                  <option key={d} value={d}>
                    {f.bookPage.routineDays[i]}
                  </option>
                ))}
              </select>
            </label>
            <button type="submit" data-analytics="book_pickup_click" data-placement="account_routine" className="inline-flex h-11 items-center justify-center rounded-md bg-white px-5 font-semibold text-navy hover:bg-white/90">
              {t.routineButton}
            </button>
          </form>
          <Link href="/regular-laundry" className="mt-3 inline-block t-small font-semibold text-white underline decoration-white/50 underline-offset-4 hover:decoration-white">
            {t.routineMore}
          </Link>
        </section>
      ) : null}
    </div>
  );
}
