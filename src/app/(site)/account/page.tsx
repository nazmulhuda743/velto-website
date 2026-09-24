import Link from "next/link";
import { OrderSummary, money, date } from "@/components/account/OrderSummary";
import { portalMe, portalOrders } from "@/lib/customer-portal";
import { requirePortalIdentity } from "@/lib/supabase/portal-server";
import { WHATSAPP_URL } from "@/content/site";
import { requestLinkAction } from "../auth-actions";

export const metadata = { title: "My account | Velto Premium Laundry" };

export default async function AccountPage() {
  const { supabase } = await requirePortalIdentity("/account");
  const [profile, orders] = await Promise.all([portalMe(supabase), portalOrders(supabase, 8)]);
  const active = orders.find((order) => order.active);
  const name = profile.fullName?.trim().split(/\s+/)[0] || profile.veltoProfile?.name?.trim().split(/\s+/)[0] || "there";

  return (
    <section className="container-page py-10 md:py-14" aria-labelledby="account-title">
      <div className="grid-page gap-y-10">
        <div className="col-span-4 md:col-span-8 xl:col-span-7">
          <p className="t-label uppercase text-blue">Your Velto account</p>
          <h1 id="account-title" className="mt-3 t-h1 text-navy">Hi {name}</h1>
          <p className="mt-3 max-w-xl t-body text-body">Orders, pickup details and your saved information, without the clutter.</p>

          {profile.link.status !== "linked" ? (
            <div className="mt-8 rounded-md border border-line bg-soft p-5 md:p-6">
              <p className="font-semibold text-navy">{profile.link.status === "pending" ? "Velto history verification is pending" : "Link your Velto history"}</p>
              <p className="mt-2 t-small text-body">{profile.link.status === "pending" ? "Your account stays usable while Velto verifies the phone history. Orders remain hidden until that check is complete." : "Creating an account does not automatically unlock past orders. Ask Velto to verify the phone on your profile first."}</p>
              {profile.link.status !== "pending" ? <form action={requestLinkAction}><button className="mt-4 min-h-11 rounded-md border border-navy px-4 text-[14px] font-semibold text-navy hover:bg-white">Request history link</button></form> : null}
            </div>
          ) : null}

          <div className="mt-9">
            <div className="flex items-end justify-between gap-4"><div><p className="t-label uppercase text-secondary">Current order</p><h2 className="mt-2 t-h3 text-navy">{active ? active.statusLabel : "Nothing active right now"}</h2></div>{active ? <Link href={`/account/orders/${active.orderNumber}`} className="t-small font-semibold text-navy underline decoration-blue/50 underline-offset-4">View order</Link> : null}</div>
            {active ? (
              <div className="mt-5 border-y border-navy py-5">
                <div className="flex flex-wrap items-baseline justify-between gap-3"><strong className="text-lg text-navy">{active.orderNumber}</strong>{active.express ? <span className="rounded-full bg-soft px-3 py-1 text-[12px] font-semibold text-navy">Express</span> : null}</div>
                <dl className="mt-5 grid grid-cols-2 gap-x-5 gap-y-4 text-[14px] sm:grid-cols-4"><div><dt className="text-secondary">Expected</dt><dd className="mt-1 font-semibold text-navy">{date(active.promisedAt || active.deliveryDate)}</dd></div><div><dt className="text-secondary">Items</dt><dd className="mt-1 font-semibold text-navy">{active.items ?? "—"}</dd></div><div><dt className="text-secondary">Total</dt><dd className="mt-1 font-semibold text-navy">{money(active.total)}</dd></div><div><dt className="text-secondary">Due</dt><dd className="mt-1 font-semibold text-navy">{money(active.due)}</dd></div></dl>
              </div>
            ) : <div className="mt-5 border-y border-line py-6 t-body text-body">When an order is active, its latest customer-safe status will appear here.</div>}
          </div>

          <div className="mt-10"><div className="flex items-center justify-between gap-4"><h2 className="t-h3 text-navy">Recent orders</h2><Link href="/account/orders" className="t-small font-semibold text-navy underline decoration-blue/50 underline-offset-4">All orders</Link></div>{orders.length ? <div className="mt-4">{orders.slice(0, 3).map((order) => <OrderSummary key={order.orderNumber} order={order} compact />)}</div> : <p className="mt-4 border-y border-line py-6 t-body text-body">No orders are available for this account yet.</p>}</div>
        </div>

        <aside className="col-span-4 md:col-span-8 xl:col-span-4 xl:col-start-9"><div className="xl:sticky xl:top-28"><Link href="/book" className="flex h-[52px] w-full items-center justify-center rounded-md bg-action px-6 font-semibold text-white hover:bg-action-hover">Book another pickup</Link><div className="mt-6 border-t border-line pt-5"><Link href="/account/profile" className="font-semibold text-navy underline decoration-blue/50 underline-offset-4">Profile and saved details</Link><p className="mt-2 t-small text-secondary">Update the details Velto can safely reuse.</p></div><div className="mt-6 border-t border-line pt-5"><a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className="font-semibold text-navy underline decoration-blue/50 underline-offset-4">Need help on WhatsApp?</a><p className="mt-2 t-small text-secondary">For order questions, changes or anything that needs a person.</p></div></div></aside>
      </div>
    </section>
  );
}
