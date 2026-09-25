import { redirect } from "next/navigation";
import { Alert } from "@/components/account/Alert";
import { LinkHistoryCard } from "@/components/account/LinkHistoryCard";
import { OrderRow } from "@/components/account/OrderRow";
import { ButtonLink } from "@/components/ui/Button";
import { getCustomerSession, getPortalOrders, type PortalOrder } from "@/lib/customer/portal";

function Group({ id, title, orders, empty }: { id: string; title: string; orders: PortalOrder[]; empty: string }) {
  return (
    <section aria-labelledby={id}>
      <h2 id={id} className="t-label uppercase text-secondary">
        {title} <span className="text-navy">({orders.length})</span>
      </h2>
      {orders.length ? (
        <ul className="mt-3 overflow-hidden rounded-lg border border-line bg-white">
          {orders.map((o) => (
            <OrderRow key={o.orderNumber} order={o} />
          ))}
        </ul>
      ) : (
        <p className="mt-3 rounded-lg border border-dashed border-line-strong bg-white px-5 py-6 t-small text-secondary">{empty}</p>
      )}
    </section>
  );
}

export default async function OrdersPage() {
  const session = await getCustomerSession();
  if (session.kind !== "customer" || session.account.state !== "ready") redirect("/login?next=/account/orders");
  const linked = session.account.link.status === "linked";
  const orders = linked ? await getPortalOrders() : [];

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="t-h1 text-navy">My orders</h1>
          <p className="mt-2 text-body">Orders placed with Velto under your verified number.</p>
        </div>
        <ButtonLink href="/book?source=account-orders" event="book_pickup_click" placement="account_orders" className="!h-12">
          Book a pickup
        </ButtonLink>
      </header>

      {!linked ? (
        <LinkHistoryCard account={session.account} emphasis="page" />
      ) : orders === null ? (
        <Alert tone="error">We couldn&apos;t load your orders just now. Please refresh in a moment.</Alert>
      ) : (
        <>
          <Group id="active-orders" title="In progress" orders={orders.filter((o) => o.active)} empty="Nothing in progress. Book a pickup whenever you're ready." />
          <Group id="past-orders" title="Past orders" orders={orders.filter((o) => !o.active)} empty="Your delivered orders will appear here." />
        </>
      )}
    </div>
  );
}
