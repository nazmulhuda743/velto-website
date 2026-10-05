import Link from "next/link";
import { redirect } from "next/navigation";
import { LinkHistoryCard } from "@/components/account/LinkHistoryCard";
import { WeeklyOffer } from "@/components/app/orders/WeeklyOffer";
import { appOrderFormat, type AppOrderFormat } from "@/components/app/orders/format";
import { Banner, ButtonLink, Card, Eyebrow, WhatsAppButton } from "@/components/app/ui";
import { accountText, type AccountText } from "@/content/i18n/account";
import { careText } from "@/content/i18n/care";
import { formText } from "@/content/i18n/forms";
import { customerRoutes } from "@/lib/app-routes";
import { signInFor } from "@/lib/app-routes-server";
import { completedCount, expectedReturn, homeState, lastOrder, reachedAt, serviceList, showFirstOrderLine, showWeeklyOnHome, stepIndex, STEPS } from "@/lib/customer/app-logic";
import { getCarePending } from "@/lib/customer/care";
import { getCustomerSession, getPickups, getPortalOrder, getPortalOrders, type PortalOrder, type PortalPickup } from "@/lib/customer/portal";
import { quickRepeatFor } from "@/lib/customer/quick-repeat";
import { bookingServiceFor, repeatHref } from "@/lib/customer/rhythm";
import { getRoutine } from "@/lib/customer/routine";
import { areaLabel, displayBdPhone, greetingName } from "@/lib/customer/validation";
import { FIRST_ORDER_OFFER } from "@/lib/first-order-offer";
import { firstWebsiteBooking } from "@/lib/first-order-lookup";
import { fill, format, localDigits } from "@/lib/i18n/config";
import { getLocale } from "@/lib/i18n/server";
import { ROUTINE_SERVICES, ROUTINE_WINDOWS } from "@/lib/routine";
import { RebookCard } from "./RebookCard";

const routes = customerRoutes("/app");

function greeting(t: AccountText["home"], name: string | null) {
  const hour = Number(new Date().toLocaleString("en-GB", { hour: "numeric", hour12: false, timeZone: "Asia/Dhaka" }));
  return `${hour < 12 ? t.morning : hour < 17 ? t.afternoon : t.evening}${name ? format(t.greetingName, { name }) : ""}${t.greetingEnd}`;
}

/** The dark card for what Velto is working on now: step, honest return date, bar, then See order and WhatsApp. */
function HeroCard({ eyebrow, step, headline, facts, href, f }: { eyebrow: string; step: number; headline: string; facts: string[]; href?: string; f: AppOrderFormat }) {
  const { t } = f;
  const key = STEPS[step].key;
  return (
    <Card tone="hero" className="space-y-3.5" data-app-hero>
      <div className="flex items-center justify-between gap-3">
        <p className="a-eyebrow text-[#8fc3ec]">{eyebrow}</p>
        <span className="rounded-full bg-white/15 px-2.5 py-1 a-meta font-semibold">{t.steps[key]}</span>
      </div>
      <p className="text-[24px] font-bold leading-[1.2]">{headline}</p>
      <div className="space-y-2 py-1">
        <div className="flex gap-1" aria-hidden="true">
          {STEPS.map((s, i) => (
            <span key={s.key} className={`h-1 flex-1 rounded-sm ${i <= step ? "bg-white" : "bg-white/25"}`} />
          ))}
        </div>
        <p className="a-cap font-semibold">
          {t.steps[key]} · {fill(t.stepOf, { n: step + 1 }, f.locale)}
        </p>
      </div>
      {facts.length ? <p className="a-sec text-[#c9dcee]">{facts.join(" · ")}</p> : null}
      <div className="flex gap-2.5">
        {href ? (
          <Link href={href} className="flex h-[46px] flex-1 items-center justify-center rounded-xl bg-white a-body font-semibold text-navy">
            {t.seeOrder}
          </Link>
        ) : null}
        <WhatsAppButton placement="app_home_hero" variant="inverse" icon={false} className="!h-[46px] flex-1 !px-2 !text-[15px]">
          {formText(f.locale).common.appBar.whatsapp}
        </WhatsAppButton>
      </div>
    </Card>
  );
}

/** A row in "Recent orders": service and date, price and where it stands. */
function RecentRow({ order, f, cancelled }: { order: PortalOrder; f: AppOrderFormat; cancelled: string }) {
  const { t } = f;
  const key = STEPS[stepIndex(order.status)].key;
  const isCancelled = order.status === "Cancelled";
  const status = isCancelled ? cancelled : order.status === "Delivered" && order.due > 0 ? format(t.dueShort, { amt: f.money(order.due) }) : t.steps[key];
  const tone = isCancelled ? "text-muted" : order.status === "Delivered" ? (order.due > 0 ? "text-app-amber" : "text-app-green") : "text-action";
  return (
    <li className="border-b border-line last:border-b-0">
      <Link href={routes.order(order.orderNumber)} className="flex min-h-13 justify-between gap-3 px-4 py-3.5">
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="a-body font-semibold text-navy">{order.services.length ? f.services(order.services) : order.orderNumber}</span>
          <span className="a-cap text-muted">{f.day(order.deliveredAt ?? order.orderDate)}</span>
        </span>
        <span className="flex shrink-0 flex-col items-end gap-0.5">
          {order.total > 0 ? <span className="a-body font-semibold text-navy">{f.money(order.total)}</span> : null}
          <span className={`a-meta ${tone}`}>{status}</span>
        </span>
      </Link>
    </li>
  );
}

/**
 * The app's Home (design "Home, four states"): one state card (an order in progress; the same as
 * last time within 60 days; welcome back after that; or the first pickup), then recent orders,
 * then nothing. A weekly pickup is offered once two orders were completed and none exists.
 */
export async function AppHomeView({ params }: { params: Record<string, string | string[] | undefined> }) {
  const session = await getCustomerSession();
  if (session.kind !== "customer" || session.account.state !== "ready") redirect(await signInFor("/app", routes.home));
  const account = session.account;
  const locale = await getLocale();
  const f = appOrderFormat(locale);
  const { t } = f;
  const a = accountText(locale);
  const fm = formText(locale);
  const linked = account.link.status === "linked";
  const [orders, pickupData, carePending] = await Promise.all([linked ? getPortalOrders() : Promise.resolve([] as PortalOrder[]), getPickups(), getCarePending()]);
  const list = orders ?? [];
  // A pickup booked on the website that Ops hasn't turned into an order yet counts as in progress.
  const pending: PortalPickup | null = pickupData?.verified ? (pickupData.pickups[0] ?? null) : null;
  const state = pending && !list.some((o) => o.active) ? "pending" : homeState(list);
  const active = list.find((o) => o.active) ?? null;
  const last = lastOrder(list);
  const lastWindow = pickupData?.pickups.find((p) => p.plannedSlot)?.plannedSlot ?? null;

  // ---- The state card ----
  let card: React.ReactNode = null;
  if (state === "in_progress" && active) {
    const detail = await getPortalOrder(active.orderNumber);
    const d = detail && detail !== "error" ? detail : null;
    const step = stepIndex(active.status);
    const key = STEPS[step].key;
    const services = d ? serviceList(d.lines, active.services) : active.services;
    const back = expectedReturn(d ? reachedAt(d.timeline, "Picked") : null, services, active.status);
    const headline = back ? fill(t.backBy, { date: f.day(back.date) ?? "" }, locale) : key === "booked" ? t.lineWaitingCall : key === "ready" ? t.subReady : t.titles[key];
    const facts = [active.items ? f.items(active.items) : null, services.length ? f.services(services) : null, active.total > 0 ? f.money(active.total) : null].filter((x): x is string => Boolean(x));
    card = <HeroCard eyebrow={format(t.inProgressEyebrow, { id: active.orderNumber })} step={step} headline={headline} facts={facts} href={routes.order(active.orderNumber)} f={f} />;
  } else if (state === "pending" && pending) {
    card = <HeroCard eyebrow={format(t.inProgressEyebrow, { id: pending.reference })} step={0} headline={t.lineWaitingCall} facts={[]} f={f} />;
  } else if ((state === "regular" || state === "lapsed") && last) {
    const quick = await quickRepeatFor(account, last.orderNumber, bookingServiceFor(last.services), locale);
    const changeHref = repeatHref({ last, repeatService: bookingServiceFor(last.services) }, `app_home_${state}`, routes.book());
    const items = quick?.data.items?.reduce((n, l) => n + l.quantity, 0) ?? last.items ?? 0;
    const services = f.services(last.services);
    if (quick) {
      const lapsed = state === "lapsed";
      const month = Number(last.orderDate.slice(5, 7)) - 1;
      card = (
        <RebookCard
          data={quick.data}
          sector={quick.sector}
          lastWindow={lastWindow}
          address={[account.address, areaLabel(account.area)].filter(Boolean).join(", ")}
          changeHref={changeHref}
          otherHref={lapsed ? routes.book({ source: "app-home-lapsed" }) : undefined}
          phone={displayBdPhone(account.phone) ?? account.phone}
          locale={locale}
          placement={lapsed ? "app_home_lapsed" : "app_home_regular"}
          t={{
            eyebrow: lapsed ? t.lapsedEyebrow : t.sameEyebrow,
            title: lapsed
              ? fill(t.lapsedTitle, { services: last.services.map(f.service).join(t.servicesAnd), month: t.monthsFull[month] ?? "" }, locale)
              : items
                ? format(t.sameTitle, { services, items: f.items(items) })
                : services,
            body: lapsed ? t.lapsedBody : undefined,
            pickupFrom: t.pickupFrom,
            pickupWhen: t.pickupWhen,
            change: t.change,
            bookThis: t.bookThis,
            confirmNote: t.confirmNote,
            somethingElse: t.somethingElse,
            tomorrow: t.tomorrow,
            whenTomorrow: t.whenTomorrow,
            whenDay: t.whenDay,
            windows: t.windows,
            windowWords: t.weeklyWindows,
            pickupTime: t.pickupTime,
            pickupDay: t.pickupDay,
            timeWindow: t.timeWindow,
            close: t.close,
            successTitle: t.successTitle,
            successBody: t.successBody,
            successRef: t.successRef,
            sending: a.quick.sending,
            failed: a.quick.failed,
            duplicate: a.quick.duplicate,
            slotTaken: fm.booking.slotTaken,
            noWindows: a.quick.noWindows,
            weekdays: fm.common.weekdays,
            months: fm.common.months,
            dayMonth: fm.common.dayMonth,
          }}
        />
      );
    } else {
      // No saved pickup address yet: the same order again through the prefilled booking form.
      card = (
        <Card className="space-y-3.5" data-app-rebook="form">
          <Eyebrow>{state === "lapsed" ? t.lapsedEyebrow : t.sameEyebrow}</Eyebrow>
          <h2 className="a-card text-navy">{items ? format(t.sameTitle, { services, items: f.items(items) }) : services}</h2>
          <ButtonLink href={changeHref}>{t.bookThis}</ButtonLink>
          <p className="a-cap text-muted">{t.confirmNote}</p>
        </Card>
      );
    }
  } else if (state === "first") {
    const firstOrder = showFirstOrderLine(list.length) && account.phone ? (await firstWebsiteBooking(account.phone)) === "first" : false;
    card = (
      <>
        <Card className="space-y-3" data-app-first>
          <Eyebrow>{t.firstEyebrow}</Eyebrow>
          <h2 className="a-card text-navy">{t.firstTitle}</h2>
          <p className="a-body text-secondary">{t.firstBody}</p>
          {firstOrder ? <Banner>{fill(a.home.offerTitle, { percent: FIRST_ORDER_OFFER.percent }, locale)}</Banner> : null}
          <ButtonLink href={routes.book({ source: "app-home-first" })} className="mt-1" data-analytics="book_pickup_click" data-placement="app_home_first">
            {t.bookPickup}
          </ButtonLink>
          <ButtonLink href={routes.prices} variant="text" className="w-full">
            {t.seePricesFirst}
          </ButtonLink>
        </Card>
        <Card tone="dashed" className="space-y-3 !p-4">
          <h2 className="a-body font-semibold text-navy">{t.howItWorks}</h2>
          <ol className="space-y-2.5">
            {t.how.map((line, i) => (
              <li key={line} className="flex gap-2.5 a-sec text-body">
                <span aria-hidden="true" className="flex size-[22px] shrink-0 items-center justify-center rounded-full bg-app-tint a-meta font-bold text-action">
                  {localDigits(i + 1, locale)}
                </span>
                {line}
              </li>
            ))}
          </ol>
        </Card>
      </>
    );
  }

  // ---- Recent orders and the weekly offer ----
  const recent = list.filter((o) => o !== (state === "in_progress" ? active : null)).slice(0, 3);
  const routine = linked && list.length ? await getRoutine() : null;
  const hasRoutine = routine === "error" || (routine !== null && routine.status !== "stopped" && routine.status !== "declined");
  const service = last ? bookingServiceFor(last.services) : null;
  let weekly: React.ReactNode = null;
  if (last && service && (ROUTINE_SERVICES as readonly string[]).includes(service) && showWeeklyOnHome(completedCount(list), hasRoutine)) {
    const weekday = new Date(`${(last.pickupDate ?? last.orderDate).slice(0, 10)}T12:00:00Z`).getUTCDay();
    const win = lastWindow && (ROUTINE_WINDOWS as readonly string[]).includes(lastWindow) ? lastWindow : "evening";
    const day = fm.bookPage.routineDays[weekday];
    weekly = (
      <WeeklyOffer
        weekday={weekday}
        window={win}
        service={service}
        t={{
          title: t.weeklyTitle,
          body: fill(t.weeklyBody, { day, window: t.weeklyWindows[win] }, locale),
          requested: fill(a.routine.requestedBody, { day, time: fm.booking.slots[win] }, locale),
          failed: a.routine.failed,
          needAddress: a.routine.needAddress,
        }}
      />
    );
  }
  const ct = careText(locale);

  return (
    <div className="space-y-3">
      <header className="space-y-1.5 pb-2">
        <h1 className="a-title">{greeting(a.home, greetingName(account.fullName))}</h1>
        {state === "regular" ? <p className="a-body text-muted">{t.nothingInProgress}</p> : null}
      </header>

      {carePending.length ? (
        <Banner tone="warning" title={ct.banner(carePending.length)}>
          <Link href={routes.order(carePending[0].orderNumber, "care")} className="font-semibold underline underline-offset-4">
            {ct.review}
          </Link>
        </Banner>
      ) : null}
      {params.welcome ? <Banner tone="success">{a.home.welcome}</Banner> : null}
      {params.restored ? <Banner tone="success">{a.welcomeBack.restored}</Banner> : null}
      {orders === null ? <Banner tone="error">{a.home.ordersFailed}</Banner> : null}

      {card}

      {linked ? null : <LinkHistoryCard account={account} base="/app" />}

      {recent.length ? (
        <section aria-labelledby="app-recent" className="pt-4">
          <div className="flex items-baseline justify-between pb-2.5">
            <h2 id="app-recent" className="a-section">
              {t.recentOrders}
            </h2>
            <Link href={routes.orders} className="inline-flex min-h-11 items-center a-sec font-semibold text-action">
              {t.seeAll}
            </Link>
          </div>
          <ul className="overflow-hidden rounded-2xl border border-line bg-app-card">
            {recent.map((o) => (
              <RecentRow key={o.orderNumber} order={o} f={f} cancelled={a.status.cancelled} />
            ))}
          </ul>
        </section>
      ) : null}

      {weekly ? <div className="pt-3">{weekly}</div> : null}
    </div>
  );
}
