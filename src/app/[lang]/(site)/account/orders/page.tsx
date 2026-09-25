import { redirect } from "next/navigation";
import { getLocale, loginRedirectPath } from "@/lib/i18n/server";
import { accountText } from "@/content/i18n/account";
import { localDigits } from "@/lib/i18n/config";
import { Alert } from "@/components/account/Alert";
import { LinkHistoryCard } from "@/components/account/LinkHistoryCard";
import { OrderRow } from "@/components/account/OrderRow";
import { ButtonLink } from "@/components/ui/Button";
import { getCustomerSession, getPortalOrders, type PortalOrder } from "@/lib/customer/portal";

function Group({ id, title, orders, empty, count }: { id: string; title: string; orders: PortalOrder[]; empty: string; count: string }) {
  return (
    <section aria-labelledby={id}>
      <h2 id={id} className="t-label uppercase text-secondary">
        {title} <span className="text-navy">({count})</span>
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
  if (session.kind !== "customer" || session.account.state !== "ready") redirect(await loginRedirectPath("/account/orders"));
  const linked = session.account.link.status === "linked";
  const orders = linked ? await getPortalOrders() : [];
  const locale = await getLocale();
  const t = accountText(locale).orders;
  const active = orders ? orders.filter((o) => o.active) : [];
  const past = orders ? orders.filter((o) => !o.active) : [];

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="t-h1 text-navy">{t.title}</h1>
          <p className="mt-2 text-body">{t.intro}</p>
        </div>
        <ButtonLink href="/book?source=account-orders" event="book_pickup_click" placement="account_orders" className="!h-12">
          {t.book}
        </ButtonLink>
      </header>

      {!linked ? (
        <LinkHistoryCard account={session.account} emphasis="page" />
      ) : orders === null ? (
        <Alert tone="error">{t.failed}</Alert>
      ) : (
        <>
          <Group id="active-orders" title={t.inProgress} orders={active} count={localDigits(active.length, locale)} empty={t.emptyActive} />
          <Group id="past-orders" title={t.past} orders={past} count={localDigits(past.length, locale)} empty={t.emptyPast} />
        </>
      )}
    </div>
  );
}
