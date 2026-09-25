import Link from "@/components/i18n/Link";
import { serviceLabel } from "@/content/order-status";
import { accountText, orderFormat } from "@/content/i18n/account";
import { fill, format, type Locale } from "@/lib/i18n/config";
import { getLocale } from "@/lib/i18n/server";
import type { PortalOrder } from "@/lib/customer/portal";

const TONE: Record<string, string> = {
  Delivered: "bg-soft text-secondary",
  Cancelled: "bg-soft text-secondary line-through decoration-secondary/60",
  Ready: "bg-success-soft text-success",
};

export async function StatusPill({ status }: { status: string }) {
  const { statusTitle } = orderFormat(await getLocale());
  return (
    <span className={`inline-flex h-7 items-center rounded-full px-3 text-[13px] font-semibold ${TONE[status] ?? "bg-[#e8f3fa] text-blue"}`}>
      {statusTitle(status)}
    </span>
  );
}

/** One order in a list: the whole row opens the order. Ops names (services, outlet) show as they are. */
export async function OrderRow({ order }: { order: PortalOrder }) {
  const locale: Locale = await getLocale();
  const t = accountText(locale).row;
  const { day, taka } = orderFormat(locale);
  const services = order.services.map(serviceLabel).join(", ") + (order.express ? t.express : "");
  return (
    <li className="border-b border-line last:border-0">
      <Link
        href={`/account/orders/${order.orderNumber}`}
        className="group grid grid-cols-[1fr_auto] gap-x-4 gap-y-1.5 px-4 py-4 hover:bg-soft/60 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_auto_auto] md:items-center md:px-6"
      >
        <span className="min-w-0">
          <span className="block font-semibold text-navy group-hover:text-blue">{order.orderNumber}</span>
          <span className="block truncate t-small text-secondary">
            {day(order.orderDate, true)}
            {order.outlet ? ` · ${order.outlet.name}` : ""}
          </span>
        </span>
        <span className="row-start-2 min-w-0 t-small text-body md:row-start-auto">
          <span className="block truncate">{services || t.laundry}</span>
          <span className="block text-secondary">
            {order.items ? fill(order.items === 1 ? t.itemsOne : t.itemsMany, { n: order.items }, locale) : t.beingCounted}
          </span>
        </span>
        <span className="col-start-2 row-start-1 justify-self-end md:col-start-auto md:row-start-auto">
          <StatusPill status={order.status} />
        </span>
        <span className="col-start-2 row-start-2 text-right md:col-start-auto md:row-start-auto md:min-w-[112px]">
          <span className="block font-semibold text-navy">{taka(order.total)}</span>
          <span className={`block t-small ${order.due > 0 && order.status !== "Cancelled" ? "font-medium text-error" : "text-secondary"}`}>
            {order.status === "Cancelled" ? t.cancelled : order.due > 0 ? format(t.due, { amount: taka(order.due) ?? "" }) : t.paid}
          </span>
        </span>
      </Link>
    </li>
  );
}
