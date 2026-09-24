import Link from "next/link";
import type { PortalOrder } from "@/lib/customer-portal";

const money = (value: number | null) => value == null ? "—" : `৳${Math.round(value).toLocaleString("en-BD")}`;
const date = (value: string | null) => value ? new Intl.DateTimeFormat("en-BD", { day: "numeric", month: "short", year: "numeric" }).format(new Date(value)) : "—";

export function OrderSummary({ order, compact = false }: { order: PortalOrder; compact?: boolean }) {
  return (
    <Link href={`/account/orders/${encodeURIComponent(order.orderNumber)}`} className="block border-b border-line py-5 first:border-t first:border-navy hover:bg-soft/60 focus:outline-2 focus:outline-blue focus:outline-offset-2 md:px-2">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-semibold text-navy">{order.orderNumber}</p>
          <p className="mt-1 t-small text-secondary">{date(order.orderDate)} · {order.services?.join(", ") || "Laundry service"}</p>
        </div>
        <span className="rounded-full bg-soft px-3 py-1 text-[12px] font-semibold text-navy">{order.statusLabel || order.status}</span>
      </div>
      <div className={`mt-4 grid gap-3 text-[14px] ${compact ? "grid-cols-3" : "grid-cols-2 sm:grid-cols-4"}`}>
        <div><span className="block text-secondary">Items</span><strong className="font-semibold text-navy">{order.items ?? "—"}</strong></div>
        {!compact ? <div><span className="block text-secondary">Outlet</span><strong className="font-semibold text-navy">{order.outlet?.name || order.outlet?.code || "—"}</strong></div> : null}
        <div><span className="block text-secondary">Total</span><strong className="font-semibold text-navy">{money(order.total)}</strong></div>
        <div><span className="block text-secondary">Due</span><strong className="font-semibold text-navy">{money(order.due)}</strong></div>
      </div>
    </Link>
  );
}

export { money, date };
