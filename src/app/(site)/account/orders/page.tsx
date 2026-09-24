import { OrderSummary } from "@/components/account/OrderSummary";
import { portalMe, portalOrders } from "@/lib/customer-portal";
import { requirePortalIdentity } from "@/lib/supabase/portal-server";

export const metadata = { title: "My orders | Velto Premium Laundry" };

export default async function OrdersPage() {
  const { supabase } = await requirePortalIdentity("/account/orders");
  const [profile, orders] = await Promise.all([portalMe(supabase), portalOrders(supabase, 100)]);
  const active = orders.filter((order) => order.active);
  const past = orders.filter((order) => !order.active);
  return (
    <section className="container-page py-10 md:py-14" aria-labelledby="orders-title">
      <div className="max-w-4xl">
        <p className="t-label uppercase text-blue">My orders</p><h1 id="orders-title" className="mt-3 t-h1 text-navy">Your Velto history</h1><p className="mt-3 max-w-2xl t-body text-body">Only orders linked to this verified account are shown here.</p>
        {profile.link.status !== "linked" ? <div className="mt-7 rounded-md border border-line bg-soft p-5"><strong className="text-navy">{profile.link.status === "pending" ? "History link pending" : "History not linked yet"}</strong><p className="mt-2 t-small text-body">Past orders stay hidden until Velto verifies your account-to-phone link.</p></div> : null}
        <div className="mt-10"><h2 className="t-h3 text-navy">Active</h2>{active.length ? <div className="mt-4">{active.map((order) => <OrderSummary key={order.orderNumber} order={order} />)}</div> : <p className="mt-4 border-y border-line py-5 text-body">No active orders.</p>}</div>
        <div className="mt-12"><h2 className="t-h3 text-navy">Past</h2>{past.length ? <div className="mt-4">{past.map((order) => <OrderSummary key={order.orderNumber} order={order} />)}</div> : <p className="mt-4 border-y border-line py-5 text-body">No past orders are available.</p>}</div>
      </div>
    </section>
  );
}
