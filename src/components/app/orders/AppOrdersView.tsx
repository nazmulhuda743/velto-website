import Link from "next/link";
import { redirect } from "next/navigation";
import { LinkHistoryCard } from "@/components/account/LinkHistoryCard";
import { Banner, ButtonLink, Card, Eyebrow, Pill } from "@/components/app/ui";
import { accountText } from "@/content/i18n/account";
import { customerRoutes } from "@/lib/app-routes";
import { signInFor } from "@/lib/app-routes-server";
import { expectedReturn, reachedAt, serviceList, stepIndex, STEPS } from "@/lib/customer/app-logic";
import { getCustomerSession, getPortalOrder, getPortalOrders, type PortalOrder, type PortalOrderDetail } from "@/lib/customer/portal";
import { fill, format } from "@/lib/i18n/config";
import { getLocale } from "@/lib/i18n/server";
import { appOrderFormat, type AppOrderFormat } from "./format";

const routes = customerRoutes("/app");

/**
 * An order Ops is still working on: the step, an honest "Usually back by" (only with a Collected
 * time), a five-part bar, and items · service · price (each only when Ops has it).
 */
export function InProgressCard({ order, detail, f }: { order: PortalOrder; detail: PortalOrderDetail | null; f: AppOrderFormat }) {
  const { t } = f;
  const step = stepIndex(order.status);
  const key = STEPS[step].key;
  const collectedAt = detail ? reachedAt(detail.timeline, "Picked") : null;
  const back = expectedReturn(collectedAt, detail ? serviceList(detail.lines, order.services) : order.services, order.status);
  const headline = back ? fill(t.backBy, { date: f.day(back.date) ?? "" }, f.locale) : key === "booked" ? t.lineWaitingCall : key === "ready" ? t.subReady : t.titles[key];
  const since = collectedAt ? format(t.listCollected, { date: f.day(collectedAt) ?? "" }) : format(t.listBooked, { date: f.day(order.orderDate) ?? "" });
  const facts = [
    order.items ? f.items(order.items) : null,
    order.services.length ? f.services(detail ? serviceList(detail.lines, order.services) : order.services) : null,
    order.total > 0 ? f.money(order.total) : null,
  ].filter(Boolean);
  return (
    <Link href={routes.order(order.orderNumber)} className="block rounded-2xl border-[1.5px] border-action bg-app-card p-4" data-app-active-order>
      <span className="flex items-center justify-between gap-3">
        <span className="a-cap text-muted">
          {order.orderNumber} · {since}
        </span>
        <Pill tone={key === "booked" ? "neutral" : "progress"}>{t.steps[key]}</Pill>
      </span>
      <span className="mt-2.5 block a-section">{headline}</span>
      <span className="mt-2.5 flex gap-1" aria-hidden="true">
        {STEPS.map((s, i) => (
          <span key={s.key} className={`h-1 flex-1 rounded-sm ${i <= step ? "bg-action" : "bg-line"}`} />
        ))}
      </span>
      <span className="sr-only">{fill(t.stepOf, { n: step + 1 }, f.locale)}</span>
      {facts.length ? <span className="mt-2.5 block a-sec text-secondary">{facts.join(" · ")}</span> : null}
    </Link>
  );
}

/** A finished order in the list: service, date, number; price and "Delivered · Paid" or what is due. */
function PastRow({ order, f, cancelled }: { order: PortalOrder; f: AppOrderFormat; cancelled: string }) {
  const { t } = f;
  const isCancelled = order.status === "Cancelled";
  const status = isCancelled ? cancelled : order.due > 0 ? `${t.steps.delivered} · ${format(t.dueShort, { amt: f.money(order.due) })}` : `${t.steps.delivered} · ${t.paid}`;
  return (
    <li className="border-b border-line last:border-b-0">
      <Link href={routes.order(order.orderNumber)} className="flex min-h-13 justify-between gap-3 px-4 py-3.5">
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="a-body font-semibold text-navy">{order.services.length ? f.services(order.services) : t.steps.delivered}</span>
          <span className="a-cap text-muted">{f.day(order.deliveredAt ?? order.orderDate)}</span>
          <span className="a-meta text-app-off-text">{order.orderNumber}</span>
        </span>
        <span className="flex shrink-0 flex-col items-end gap-0.5">
          {order.total > 0 ? <span className="a-body font-semibold text-navy">{f.money(order.total)}</span> : null}
          <span className={`a-meta ${isCancelled ? "text-muted" : order.due > 0 ? "text-app-amber" : "text-app-green"}`}>{status}</span>
        </span>
      </Link>
    </li>
  );
}

/** The app's Orders: in progress first (as cards), then past orders; one card when there are none. */
export async function AppOrdersView() {
  const session = await getCustomerSession();
  if (session.kind !== "customer" || session.account.state !== "ready") redirect(await signInFor("/app", routes.orders));
  const locale = await getLocale();
  const f = appOrderFormat(locale);
  const { t } = f;
  const a = accountText(locale);
  const linked = session.account.link.status === "linked";
  const orders = linked ? await getPortalOrders() : [];
  const active = orders ? orders.filter((o) => o.active) : [];
  const past = orders ? orders.filter((o) => !o.active) : [];
  // The list has no timeline; the few orders in progress are read in full for their Collected time.
  const details = await Promise.all(active.slice(0, 6).map(async (o) => {
    const d = await getPortalOrder(o.orderNumber);
    return d && d !== "error" ? d : null;
  }));

  return (
    <div>
      <h1 className="a-title">{t.ordersTitle}</h1>
      {!linked ? (
        <div className="mt-6">
          <LinkHistoryCard account={session.account} emphasis="page" base="/app" />
        </div>
      ) : orders === null ? (
        <Banner tone="error" className="mt-6">
          {a.orders.failed}
        </Banner>
      ) : orders.length === 0 ? (
        <Card className="mt-6 space-y-3 px-5 py-6">
          <p className="a-row text-body">{t.ordersEmpty}</p>
          <ButtonLink href={routes.book({ source: "app-orders" })} className="!h-12" data-analytics="book_pickup_click" data-placement="app_orders_empty">
            {t.bookPickup}
          </ButtonLink>
        </Card>
      ) : (
        <>
          {active.length ? (
            <section aria-labelledby="app-active" className="mt-6">
              <Eyebrow className="mb-2 text-muted">
                <span id="app-active">{t.inProgressLabel}</span>
              </Eyebrow>
              <div className="space-y-3">
                {active.map((o, i) => (
                  <InProgressCard key={o.orderNumber} order={o} detail={details[i] ?? null} f={f} />
                ))}
              </div>
            </section>
          ) : (
            <p className="mt-5 a-sec text-muted">{t.nothingInProgress}</p>
          )}
          {past.length ? (
            <section aria-labelledby="app-past" className="mt-6">
              <Eyebrow className="mb-2 text-muted">
                <span id="app-past">{t.pastLabel}</span>
              </Eyebrow>
              <ul className="overflow-hidden rounded-2xl border border-line bg-app-card">
                {past.map((o) => (
                  <PastRow key={o.orderNumber} order={o} f={f} cancelled={a.status.cancelled} />
                ))}
              </ul>
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}
