import Link from "next/link";
import { notFound } from "next/navigation";
import { date, money } from "@/components/account/OrderSummary";
import { portalOrder } from "@/lib/customer-portal";
import { requirePortalIdentity } from "@/lib/supabase/portal-server";

export const metadata = { title: "Order details | Velto Premium Laundry" };

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await requirePortalIdentity("/account/orders");
  const order = await portalOrder(supabase, decodeURIComponent(id));
  if (!order) notFound();
  const rows = [
    ["Service", order.services?.join(", ") || "Laundry service"], ["Items", String(order.items ?? "—")], ["Pickup date", date(order.pickupDate)], ["Promised / delivery", date(order.promisedAt || order.deliveryDate)], ["Total", money(order.total)], ["Paid", money(order.paid)], ["Due", money(order.due)], ["Payment", order.paymentStatus || "—"], ["Outlet", order.outlet?.name || order.outlet?.code || "—"], ["Express", order.express ? "Yes" : "No"],
  ];
  return (
    <section className="container-page py-10 md:py-14" aria-labelledby="order-title"><div className="grid-page gap-y-10"><div className="col-span-4 md:col-span-8 xl:col-span-7"><Link href="/account/orders" className="t-small font-semibold text-navy underline decoration-blue/50 underline-offset-4">Back to orders</Link><p className="mt-8 t-label uppercase text-blue">Order</p><h1 id="order-title" className="mt-2 t-h1 text-navy">{order.orderNumber}</h1><div className="mt-4 flex flex-wrap items-center gap-3"><span className="rounded-full bg-soft px-3 py-1 text-[13px] font-semibold text-navy">{order.statusLabel || order.status}</span>{order.express ? <span className="text-[13px] font-semibold text-blue">Express</span> : null}</div>
      <h2 className="mt-10 t-h3 text-navy">Status timeline</h2>{order.timeline?.length ? <ol className="mt-5 border-l border-line pl-6">{order.timeline.map((item, index) => <li key={`${item.status}-${item.at}-${index}`} className="relative pb-6 last:pb-0"><span className="absolute -left-[29px] top-1.5 size-2.5 rounded-full bg-navy" /><p className="font-semibold text-navy">{item.label}</p><p className="mt-1 t-small text-secondary">{date(item.at)}</p></li>)}</ol> : <p className="mt-4 text-body">No customer-safe timeline updates are available yet.</p>}
      </div><aside className="col-span-4 md:col-span-8 xl:col-span-4 xl:col-start-9"><h2 className="t-label uppercase text-secondary">Order summary</h2><dl className="mt-4 border-t border-navy">{rows.map(([label,value]) => <div key={label} className="grid grid-cols-[8rem_1fr] gap-4 border-b border-line py-3.5 text-[14px]"><dt className="text-secondary">{label}</dt><dd className="font-semibold text-navy">{value}</dd></div>)}</dl></aside></div></section>
  );
}
