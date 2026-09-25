import Link from "@/components/i18n/Link";
import { formatDay, serviceLabel, statusTitle, taka } from "@/content/order-status";
import type { PortalOrder } from "@/lib/customer/portal";

const TONE: Record<string, string> = {
  Delivered: "bg-soft text-secondary",
  Cancelled: "bg-soft text-secondary line-through decoration-secondary/60",
  Ready: "bg-success-soft text-success",
};

export function StatusPill({ status }: { status: string }) {
  return (
    <span className={`inline-flex h-7 items-center rounded-full px-3 text-[13px] font-semibold ${TONE[status] ?? "bg-[#e8f3fa] text-blue"}`}>
      {statusTitle(status)}
    </span>
  );
}

/** One order in a list: the whole row opens the order. */
export function OrderRow({ order }: { order: PortalOrder }) {
  const services = order.services.map(serviceLabel).join(", ") + (order.express ? " · Express" : "");
  return (
    <li className="border-b border-line last:border-0">
      <Link
        href={`/account/orders/${order.orderNumber}`}
        className="group grid grid-cols-[1fr_auto] gap-x-4 gap-y-1.5 px-4 py-4 hover:bg-soft/60 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_auto_auto] md:items-center md:px-6"
      >
        <span className="min-w-0">
          <span className="block font-semibold text-navy group-hover:text-blue">{order.orderNumber}</span>
          <span className="block truncate t-small text-secondary">
            {formatDay(order.orderDate, true)}
            {order.outlet ? ` · ${order.outlet.name}` : ""}
          </span>
        </span>
        <span className="row-start-2 min-w-0 t-small text-body md:row-start-auto">
          <span className="block truncate">{services || "Laundry"}</span>
          <span className="block text-secondary">{order.items ? `${order.items} item${order.items === 1 ? "" : "s"}` : "Items being counted"}</span>
        </span>
        <span className="col-start-2 row-start-1 justify-self-end md:col-start-auto md:row-start-auto">
          <StatusPill status={order.status} />
        </span>
        <span className="col-start-2 row-start-2 text-right md:col-start-auto md:row-start-auto md:min-w-[112px]">
          <span className="block font-semibold text-navy">{taka(order.total)}</span>
          <span className={`block t-small ${order.due > 0 && order.status !== "Cancelled" ? "font-medium text-error" : "text-secondary"}`}>
            {order.status === "Cancelled" ? "Cancelled" : order.due > 0 ? `${taka(order.due)} due` : "Paid"}
          </span>
        </span>
      </Link>
    </li>
  );
}
