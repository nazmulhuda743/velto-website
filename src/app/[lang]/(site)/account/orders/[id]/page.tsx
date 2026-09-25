import Link from "@/components/i18n/Link";
import { notFound } from "next/navigation";
import { Alert } from "@/components/account/Alert";
import { OrderProgress } from "@/components/account/OrderProgress";
import { StatusPill } from "@/components/account/OrderRow";
import { WhatsAppButton } from "@/components/ui/Button";
import { formatDay, formatTime, serviceLabel, statusTitle, taka } from "@/content/order-status";
import { WHATSAPP_URL } from "@/content/site";
import { getPortalOrder } from "@/lib/customer/portal";
import { validOrderNumber } from "@/lib/customer/validation";

type Params = Promise<{ id: string }>;

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="py-2.5">
      <dt className="t-caption uppercase tracking-[0.04em] text-secondary">{label}</dt>
      <dd className="mt-0.5 font-semibold text-navy">{children}</dd>
    </div>
  );
}

/**
 * One order. The order number in the URL is only a lookup key: the database returns the
 * order only if it belongs to the signed-in customer's verified Velto record.
 */
export default async function OrderPage({ params }: { params: Params }) {
  const number = validOrderNumber((await params).id);
  if (!number) notFound();
  const order = await getPortalOrder(number);
  if (order === "error") {
    return <Alert tone="error">We couldn&apos;t load this order just now. Please refresh in a moment.</Alert>;
  }
  if (!order) notFound();

  const cancelled = order.status === "Cancelled";
  const expected = order.promisedAt ?? order.deliveryDate;
  const whatsapp = `${WHATSAPP_URL}?text=${encodeURIComponent(`Hi Velto, I have a question about order ${order.orderNumber}.`)}`;

  return (
    <div className="space-y-6 md:space-y-8">
      <nav aria-label="Breadcrumb" className="t-small">
        <Link href="/account/orders" className="font-semibold text-navy underline decoration-blue/50 underline-offset-4">
          ← My orders
        </Link>
      </nav>

      <section aria-labelledby="order-title" className="rounded-lg border border-line bg-white p-5 md:p-8">
        <div className="flex flex-wrap items-center gap-3">
          <p className="t-label uppercase text-secondary">Order {order.orderNumber}</p>
          <StatusPill status={order.status} />
          {order.express ? <span className="t-small font-semibold text-purple">Express</span> : null}
        </div>
        <h1 id="order-title" className="mt-3 t-h1 text-navy">
          {cancelled ? "This order was cancelled." : statusTitle(order.status)}
        </h1>
        {cancelled ? (
          <p className="mt-3 text-body">If this doesn&apos;t look right, message Velto on WhatsApp.</p>
        ) : (
          <div className="mt-7">
            <OrderProgress status={order.status} />
          </div>
        )}

        <dl className="mt-8 grid grid-cols-2 gap-x-6 border-t border-line pt-4 md:grid-cols-3">
          <Fact label="Ordered">{formatDay(order.orderDate, true)}</Fact>
          {order.pickupDate ? <Fact label="Collected">{formatDay(order.pickupDate)}</Fact> : null}
          {order.deliveredAt ? (
            <Fact label="Delivered">{formatDay(order.deliveredAt)}</Fact>
          ) : !cancelled ? (
            <Fact label="Expected back">{formatDay(expected) ?? "We'll confirm"}</Fact>
          ) : null}
          <Fact label="Service">{order.services.map(serviceLabel).join(", ") || "Laundry"}</Fact>
          <Fact label="Items">{order.items ?? "Being counted"}</Fact>
          {order.outlet ? <Fact label="Outlet">{order.outlet.name}</Fact> : null}
        </dl>
      </section>

      <div className="grid gap-6 md:grid-cols-2">
        <section aria-labelledby="payment-title" className="rounded-lg border border-line bg-white p-5 md:p-6">
          <h2 id="payment-title" className="font-semibold text-navy">
            Payment
          </h2>
          <dl className="mt-3 divide-y divide-line">
            <div className="flex justify-between py-2.5">
              <dt className="text-body">Order total</dt>
              <dd className="font-semibold text-navy">{taka(order.total)}</dd>
            </div>
            <div className="flex justify-between py-2.5">
              <dt className="text-body">Paid</dt>
              <dd className="font-semibold text-navy">{taka(order.paid)}</dd>
            </div>
            <div className="flex justify-between py-2.5">
              <dt className="font-semibold text-navy">{cancelled ? "Status" : "Due"}</dt>
              <dd className={`font-semibold ${!cancelled && order.due > 0 ? "text-error" : "text-success"}`}>
                {cancelled ? "Cancelled" : order.due > 0 ? taka(order.due) : "Paid in full"}
              </dd>
            </div>
          </dl>
          {order.paymentStatus && !cancelled ? <p className="mt-2 t-small text-secondary">Payment status: {order.paymentStatus}</p> : null}
        </section>

        {order.lines.length ? (
          <section aria-labelledby="items-title" className="rounded-lg border border-line bg-white p-5 md:p-6">
            <h2 id="items-title" className="font-semibold text-navy">
              What&apos;s in this order
            </h2>
            <ul className="mt-3 divide-y divide-line">
              {order.lines.map((line, i) => (
                <li key={`${line.item}-${i}`} className="flex justify-between gap-4 py-2.5">
                  <span className="min-w-0 text-body">
                    <span className="block font-medium text-navy">{line.item}</span>
                    <span className="block t-small text-secondary">{serviceLabel(line.service)}</span>
                  </span>
                  <span className="shrink-0 font-semibold text-navy">× {line.quantity}</span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>

      {order.timeline.length ? (
        <section aria-labelledby="history-title" className="rounded-lg border border-line bg-white p-5 md:p-6">
          <h2 id="history-title" className="font-semibold text-navy">
            Order history
          </h2>
          <ol className="mt-3 space-y-3">
            {[...order.timeline].reverse().map((event, i) => (
              <li key={`${event.status}-${event.at}-${i}`} className="flex flex-wrap justify-between gap-x-4 t-small">
                <span className="font-semibold text-navy">{event.label}</span>
                <time dateTime={event.at} className="text-secondary">
                  {formatDay(event.at)}, {formatTime(event.at)}
                </time>
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      <section aria-labelledby="order-help" className="flex flex-wrap items-center justify-between gap-4 rounded-lg bg-soft p-5 md:p-6">
        <div>
          <h2 id="order-help" className="font-semibold text-navy">
            Question about this order?
          </h2>
          <p className="mt-1 t-small text-body">We&apos;ll include the order number for you.</p>
        </div>
        <WhatsAppButton href={whatsapp} placement="account_order" className="!h-12 !px-5" />
      </section>
    </div>
  );
}
