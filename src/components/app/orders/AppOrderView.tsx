import { notFound, redirect } from "next/navigation";
import type { ReactNode } from "react";
import { CareDecision } from "@/components/account/CareDecision";
import { Tracker, type TrackerItem } from "@/components/app/Tracker";
import { Banner, ButtonLink, Card, WhatsAppButton, WhatsAppIcon, whatsappHref } from "@/components/app/ui";
import { accountText, orderFormat } from "@/content/i18n/account";
import { careText } from "@/content/i18n/care";
import { formText } from "@/content/i18n/forms";
import { LOCATIONS } from "@/content/site";
import { customerRoutes } from "@/lib/app-routes";
import { signInFor } from "@/lib/app-routes-server";
import { askFeedback, dhakaDate, expectedReturn, isMixed, readyLine, reachedAt, serviceList, stepIndex, STEPS, trackerSteps } from "@/lib/customer/app-logic";
import { getCare, signedRiskPhotos } from "@/lib/customer/care";
import { happy } from "@/lib/customer/extras";
import { getCustomerSession, getDispatchPlans, getFeedbackList, getPickups, getPortalOrder } from "@/lib/customer/portal";
import { bookingServiceFor, repeatHref } from "@/lib/customer/rhythm";
import { getRoutine } from "@/lib/customer/routine";
import { validOrderNumber } from "@/lib/customer/validation";
import { ROUTINE_SERVICES, ROUTINE_WINDOWS } from "@/lib/routine";
import { fill, format, localDigits } from "@/lib/i18n/config";
import { getLocale } from "@/lib/i18n/server";
import { appOrderFormat } from "./format";
import { OrderFeedback } from "./OrderFeedback";
import { WeeklyOffer } from "./WeeklyOffer";

const routes = customerRoutes("/app");

function Row({ label, value, strong, tone }: { label: string; value: ReactNode; strong?: boolean; tone?: "green" | "amber" }) {
  const color = tone === "green" ? "text-app-green" : tone === "amber" ? "text-app-amber" : "text-navy";
  return (
    <div className={`flex justify-between gap-3 ${strong ? "a-body font-semibold" : "a-sec text-body"}`}>
      <dt className={strong ? "text-navy" : undefined}>{label}</dt>
      <dd className={`font-semibold ${color}`}>{value}</dd>
    </div>
  );
}

/**
 * One order in the app (design: "Order detail, every status"): the current step as the title and
 * its line under it, money due first, "Book this again" once delivered, then three blocks: the
 * tracker (times only where Ops recorded one), what was collected and what it costs, and help.
 */
export async function AppOrderView({ id, care: careParam }: { id: string; care?: string | string[] }) {
  const number = validOrderNumber(id);
  if (!number) notFound();
  const session = await getCustomerSession();
  if (session.kind !== "customer" || session.account.state !== "ready") redirect(await signInFor("/app", routes.order(number)));
  const locale = await getLocale();
  const f = appOrderFormat(locale);
  const { t } = f;
  const a = accountText(locale);
  const order = await getPortalOrder(number);
  if (order === "error") return <Banner tone="error">{a.order.loadFailed}</Banner>;
  if (!order) notFound();

  const status = order.status;
  const cancelled = status === "Cancelled";
  const delivered = status === "Delivered";
  const key = STEPS[stepIndex(status)].key;
  const today = dhakaDate(new Date());
  const lineServices = serviceList(order.lines, order.services);
  const collectedAt = reachedAt(order.timeline, "Picked");
  const deliveredAt = order.deliveredAt ?? reachedAt(order.timeline, "Delivered");
  const back = expectedReturn(collectedAt, lineServices, status);
  const backDate = back ? f.day(back.date) : null;
  const counted = order.items !== null && order.items !== undefined;
  const hasLines = order.lines.length > 0;
  // Before the items are counted there is nothing to owe yet: the total is set after counting.
  const beforeCount = !delivered && !cancelled && !counted && !hasLines && order.total <= 0;
  const [plans, feedbackList, routine, care] = await Promise.all([
    key === "ready" ? getDispatchPlans() : Promise.resolve([]),
    delivered ? getFeedbackList() : Promise.resolve([]),
    delivered ? getRoutine() : Promise.resolve(null),
    getCare(order.orderNumber),
  ]);
  const ready = key === "ready" ? readyLine(plans, order.orderNumber, today) : null;
  const readyWindow = ready?.kind === "today" ? t.windows[ready.window] : undefined;

  // ---- Title and the line under it ----
  const phone = session.account.phone;
  let title: string = cancelled ? a.order.cancelledTitle : t.titles[key];
  let sub: string | null = null;
  let subTone: "amber" | undefined;
  if (cancelled) sub = a.order.cancelledBody;
  else if (key === "booked") sub = phone ? format(t.subBookedPhone, { phone }) : t.lineWaitingCall;
  else if (key === "collected") sub = [backDate ? fill(t.subBackBy, { date: backDate }, locale) : null, !counted && !hasLines ? t.subAfterCheck : null].filter(Boolean).join(" ") || null;
  else if (key === "cleaning") sub = backDate ? fill(t.subBackBy, { date: backDate }, locale) : null;
  else if (key === "ready") sub = ready?.kind === "notPlanned" ? t.subReadyNotPlanned : readyWindow ? fill(t.subReadyToday, { window: readyWindow }, locale) : t.subReady;
  else if (delivered) {
    const when = deliveredAt ? f.stamp(deliveredAt, true) : null;
    // An older order Ops didn't count: say only when it came back (the money block explains the rest).
    const recorded = counted || hasLines;
    const pay = order.due > 0 ? format(t.subDue, { amt: f.money(order.due) }) : recorded && order.total > 0 && order.paid >= order.total ? t.subPaidInFull : null;
    sub = [when ? format(t.subReturned, { when }) : null, pay].filter(Boolean).join(" ") || null;
    if (order.due > 0) subTone = "amber";
  }
  if (cancelled) title = a.order.cancelledTitle;

  // ---- Tracker ----
  const steps = trackerSteps(status, order.timeline);
  const doneLine: Record<string, string> = {
    booked: t.lineBooked,
    collected: counted ? fill(t.lineCollected, { n: order.items ?? 0 }, locale) : t.lineCollectedNoCount,
    cleaning: t.lineCleaning,
    ready: t.lineReady,
    delivered: t.lineDelivered,
  };
  const waitLine: Record<string, string> = {
    booked: t.lineBooked,
    collected: t.lineCollectedWait,
    cleaning: t.lineCleaningWait,
    ready: t.lineReadyWait,
    delivered: t.lineDeliveredWait,
  };
  const trackerItems: TrackerItem[] = steps.map((s) => ({
    key: s.key,
    title: t.steps[s.key],
    state: s.state,
    time: s.at ? f.stamp(s.at) : undefined,
    line:
      s.state === "upcoming"
        ? waitLine[s.key]
        : s.state === "current" && s.key === "booked"
          ? t.lineWaitingCall
          : s.state === "current" && s.key === "collected" && !counted
            ? t.lineCollectedWait
            : doneLine[s.key],
    extra:
      s.state === "current" && s.key === "ready" && ready ? (
        <p className="a-cap font-semibold text-action">{ready.kind === "notPlanned" ? t.delivNotPlanned : fill(t.delivToday, { window: readyWindow ?? "" }, locale)}</p>
      ) : undefined,
  }));

  // ---- Money and feedback ----
  const dueText = f.money(order.due);
  const dueMessage = format(t.waDue, { n: order.orderNumber, amt: dueText });
  const feedback = delivered ? (feedbackList.find((x) => x.orderNumber === order.orderNumber) ?? null) : null;
  const askable = delivered && askFeedback(deliveredAt ?? order.orderDate, Boolean(feedback));
  // Reviews go to the Google profile of the outlet that served the order (never named here).
  const outletId = /18/.test(`${order.outlet?.code ?? ""} ${order.outlet?.name ?? ""}`) ? "sector-18" : "sector-11";
  const reviewsUrl = (LOCATIONS.find((l) => l.id === outletId) ?? LOCATIONS[0]).reviewsUrl;

  // "Make this weekly?": after "All good", when no weekly pickup exists and the service can repeat weekly.
  const routineService = bookingServiceFor(order.services);
  const canWeekly = routineService && (ROUTINE_SERVICES as readonly string[]).includes(routineService) && routine !== "error" && (!routine || routine.status === "stopped" || routine.status === "declined");
  let weekly: ReactNode = null;
  if (delivered && canWeekly && routineService) {
    const weekday = new Date(`${(order.pickupDate ?? order.orderDate).slice(0, 10)}T12:00:00Z`).getUTCDay();
    const pickups = await getPickups();
    const lastSlot = pickups?.pickups.find((p) => p.plannedSlot && (ROUTINE_WINDOWS as readonly string[]).includes(p.plannedSlot))?.plannedSlot ?? "evening";
    const fb = formText(locale);
    const day = fb.bookPage.routineDays[weekday];
    weekly = (
      <WeeklyOffer
        weekday={weekday}
        window={lastSlot}
        service={routineService}
        t={{
          title: t.weeklyTitle,
          body: fill(t.weeklyBody, { day, window: t.weeklyWindows[lastSlot] }, locale),
          requested: fill(a.routine.requestedBody, { day, time: fb.booking.slots[lastSlot] }, locale),
          failed: a.routine.failed,
          needAddress: a.routine.needAddress,
        }}
      />
    );
  }
  const thanks = (
    <>
      <Card className="space-y-2 !p-4" data-app-thanks>
        <p className="flex items-center gap-2.5 a-body font-semibold text-navy">
          <span aria-hidden="true" className="flex size-6 items-center justify-center rounded-full bg-app-green-tint">
            <svg viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ color: "#1e7a46" }}>
              <path d="M5 12l5 5L20 7" />
            </svg>
          </span>
          {t.thanksTitle}
        </p>
        <p className="a-sec text-secondary">{t.thanksBody}</p>
        <a href={reviewsUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center a-sec font-semibold text-action">
          {t.googleReview}
        </a>
      </Card>
      {weekly}
    </>
  );

  // Care approval (wash-risk advisory) keeps working in the app: waiting comes first.
  const helpText = format(a.order.whatsapp, { n: order.orderNumber });
  const carePhotos = care ? await Promise.all(care.risks.map((r) => signedRiskPhotos(r.photos ?? []))) : [];
  const { day: careDay, time: careTime } = orderFormat(locale);
  const careSection = care ? (
    <CareDecision
      base="/app"
      care={care}
      photos={carePhotos}
      t={careText(locale)}
      whatsapp={whatsappHref(helpText)}
      result={typeof careParam === "string" ? careParam : undefined}
      when={care.decidedAt ? `${careDay(care.decidedAt)}, ${careTime(care.decidedAt)}` : undefined}
    />
  ) : null;

  const mixed = isMixed(order.lines, order.services);
  const totalLabel = beforeCount ? t.estimateLabel : t.totalLabel;

  return (
    <div className="space-y-3" data-app-order data-status={key}>
      <header className="space-y-1.5 pb-1">
        <h1 className="a-title">{title}</h1>
        {sub ? <p className={`a-body ${subTone === "amber" ? "text-app-amber" : "text-secondary"}`}>{sub}</p> : null}
      </header>

      {care?.status === "pending" ? careSection : null}

      {delivered && order.due > 0 ? (
        <section aria-labelledby="app-due" className="space-y-2.5 rounded-2xl border border-[#f5d78e] bg-app-amber-tint p-4" data-app-due>
          <div className="flex items-baseline justify-between gap-3 text-[#7a4a05]">
            <h2 id="app-due" className="a-body font-semibold">
              {t.dueTitle}
            </h2>
            <strong className="a-card">{dueText}</strong>
          </div>
          <p className="a-sec text-[#5c3a05]">{t.payDueNote}</p>
          <a
            href={whatsappHref(dueMessage)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-[46px] items-center justify-center gap-2 rounded-xl border border-[#e8c97a] bg-app-card a-body font-semibold text-navy"
            data-analytics="whatsapp_click"
            data-placement="app_order_due"
          >
            <WhatsAppIcon className="size-[18px] text-whatsapp" />
            {t.payOnWa}
          </a>
          <p className="text-[12.5px] leading-snug text-[#7a4a05]">{format(t.waPrefill, { id: order.orderNumber, amt: dueText })}</p>
        </section>
      ) : null}

      {delivered ? (
        <ButtonLink
          href={repeatHref({ last: order, repeatService: routineService }, "app_order", routes.book())}
          className="!h-12"
          data-analytics="book_pickup_click"
          data-placement="app_order_rebook"
        >
          {t.bookAgain}
        </ButtonLink>
      ) : null}

      {cancelled ? null : (
        <Card className="!px-4 !py-[18px]">
          <Tracker steps={trackerItems} label={t.ordersTitle} />
        </Card>
      )}

      {care && care.status !== "pending" ? careSection : null}

      <Card className="space-y-3 !p-4" data-app-collected>
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="a-body font-semibold text-navy">{t.collectedTitle}</h2>
          {lineServices.length ? <span className="a-cap text-muted">{f.services(lineServices)}</span> : null}
        </div>
        {hasLines ? (
          <ul className="space-y-1.5">
            {order.lines.map((line, i) => (
              <li key={`${line.item}-${i}`} className="flex items-baseline justify-between gap-3 a-sec text-body">
                <span className="flex min-w-0 flex-col">
                  {/* Item names come from Velto Ops as they are. */}
                  <span>{line.item}</span>
                  {mixed ? <span className="a-meta text-muted">{f.service(line.service)}</span> : null}
                </span>
                <span className="shrink-0 font-semibold text-navy">× {localDigits(line.quantity, locale)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="a-sec text-muted">{delivered && !counted ? t.missingItems : t.lineCollectedWait}</p>
        )}
        <dl className="space-y-1.5 border-t border-line pt-3">
          <Row label={totalLabel} value={beforeCount ? t.toBeSet : f.money(order.total)} />
          <Row label={t.paid} value={f.money(order.paid)} />
          {beforeCount || cancelled ? null : <Row label={t.due} value={f.money(order.due)} strong tone={order.due > 0 ? (delivered ? "amber" : undefined) : "green"} />}
        </dl>
        {!delivered && !cancelled && !beforeCount && order.due > 0 ? <p className="a-cap text-muted">{t.payCash}</p> : null}
        {delivered && !counted && !hasLines ? <p className="a-cap text-muted">{t.missingNote}</p> : null}
      </Card>

      {askable ? (
        <OrderFeedback orderNumber={order.orderNumber} offText={format(t.waOff, { n: order.orderNumber })} t={t} thanks={thanks} />
      ) : feedback && happy(feedback.rating) ? (
        thanks
      ) : null}

      <section aria-labelledby="app-help" className="flex items-center justify-between gap-3 rounded-2xl bg-app-tint px-4 py-3.5">
        <div className="min-w-0">
          <h2 id="app-help" className="a-sec font-semibold text-navy">
            {t.helpTitle}
          </h2>
          <p className="a-cap text-secondary">{t.helpBody}</p>
        </div>
        <WhatsAppButton text={helpText} placement="app_order_help" className="!h-11 !w-auto shrink-0 !px-3.5 !text-[14px]">
          WhatsApp
        </WhatsAppButton>
      </section>
    </div>
  );
}
