import Link from "next/link";
import { redirect } from "next/navigation";
import { Alert } from "@/components/account/Alert";
import { LinkHistoryCard } from "@/components/account/LinkHistoryCard";
import { OrderProgress } from "@/components/account/OrderProgress";
import { OrderRow } from "@/components/account/OrderRow";
import { ButtonLink, WhatsAppButton } from "@/components/ui/Button";
import { formatDay, serviceLabel, statusTitle, taka } from "@/content/order-status";
import { WHATSAPP_URL } from "@/content/site";
import { getCustomerSession, getPortalOrders, type PortalOrder } from "@/lib/customer/portal";
import { areaLabel, displayBdPhone, greetingName } from "@/lib/customer/validation";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function greeting() {
  const hour = Number(new Date().toLocaleString("en-GB", { hour: "numeric", hour12: false, timeZone: "Asia/Dhaka" }));
  return hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
}

function ActiveOrderCard({ order, more }: { order: PortalOrder; more: number }) {
  const expected = order.promisedAt ?? order.deliveryDate;
  return (
    <section aria-labelledby="active-title" className="rounded-lg border border-line bg-white p-5 shadow-[0_12px_32px_-26px_rgba(0,43,78,0.45)] md:p-7" data-active-order>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="t-label uppercase text-secondary">
          In progress · <span className="text-navy">{order.orderNumber}</span>
        </p>
        {order.express ? <p className="t-small font-semibold text-purple">Express</p> : null}
      </div>
      <h2 id="active-title" className="mt-2 text-[34px] font-semibold leading-[1.05] tracking-[-0.02em] text-navy md:text-[40px]">
        {statusTitle(order.status)}
      </h2>
      <div className="mt-6">
        <OrderProgress status={order.status} compact />
      </div>
      <dl className="mt-7 grid grid-cols-2 gap-x-6 gap-y-4 border-t border-line pt-5 md:grid-cols-3">
        <div>
          <dt className="t-caption uppercase tracking-[0.04em] text-secondary">Expected back</dt>
          <dd className="mt-0.5 font-semibold text-navy">{formatDay(expected) ?? "We'll confirm"}</dd>
        </div>
        <div>
          <dt className="t-caption uppercase tracking-[0.04em] text-secondary">{order.due > 0 ? "Amount due" : "Payment"}</dt>
          <dd className={`mt-0.5 font-semibold ${order.due > 0 ? "text-navy" : "text-success"}`}>{order.due > 0 ? taka(order.due) : "Paid"}</dd>
        </div>
        <div className="col-span-2 md:col-span-1">
          <dt className="t-caption uppercase tracking-[0.04em] text-secondary">Service</dt>
          <dd className="mt-0.5 font-semibold text-navy">
            {order.services.map(serviceLabel).join(", ") || "Laundry"}
            {order.items ? <span className="font-normal text-secondary"> · {order.items} items</span> : null}
          </dd>
        </div>
      </dl>
      <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3">
        <Link href={`/account/orders/${order.orderNumber}`} className="font-semibold text-navy underline decoration-blue/50 underline-offset-4 hover:decoration-blue">
          View this order
        </Link>
        {more > 0 ? (
          <Link href="/account/orders" className="t-small font-semibold text-secondary underline underline-offset-4 hover:text-navy">
            {more} more order{more === 1 ? "" : "s"} in progress
          </Link>
        ) : null}
      </div>
    </section>
  );
}

export default async function AccountHome({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const session = await getCustomerSession();
  if (session.kind !== "customer" || session.account.state !== "ready") redirect("/login?next=/account");
  const account = session.account;
  const linked = account.link.status === "linked";
  const orders = linked ? await getPortalOrders() : [];
  const active = (orders ?? []).filter((o) => o.active);
  const recent = (orders ?? []).filter((o) => o !== active[0]).slice(0, 3);
  const name = greetingName(account.fullName);
  const hasAddress = Boolean(account.address && account.area);

  return (
    <div className="space-y-5 md:space-y-6">
      <header>
        <h1 className="t-h1 text-navy">
          {greeting()}
          {name ? `, ${name}` : ""}.
        </h1>
        <p className="mt-1.5 t-body-lg text-body">
          {active.length
            ? `You have ${active.length === 1 ? "an order" : `${active.length} orders`} with Velto right now.`
            : linked
              ? "Nothing in progress right now."
              : "Your Velto account is ready."}
        </p>
      </header>

      {params.password === "updated" ? <Alert tone="success">Your password has been updated. Other devices have been signed out.</Alert> : null}
      {params.welcome ? <Alert tone="success">Your email is confirmed. Welcome to your Velto account.</Alert> : null}
      {orders === null ? <Alert tone="error">We couldn&apos;t load your orders just now. Please refresh in a moment.</Alert> : null}

      {/* 1. What's happening with my laundry */}
      {active[0] ? <ActiveOrderCard order={active[0]} more={active.length - 1} /> : null}

      {/* 2. What can I do next */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <ButtonLink href="/book?source=account" event="book_pickup_click" placement="account_home" className="sm:!px-8">
          {orders?.length ? "Book another pickup" : "Book a pickup"}
        </ButtonLink>
        {linked ? (
          <ButtonLink href="/account/orders" variant="secondary">
            View all orders
          </ButtonLink>
        ) : null}
      </div>

      {linked && recent.length ? (
        <section aria-labelledby="recent-title">
          <div className="flex items-baseline justify-between">
            <h2 id="recent-title" className="text-[20px] font-semibold tracking-[-0.01em] text-navy">
              Recent orders
            </h2>
            <Link href="/account/orders" className="t-small font-semibold text-navy underline decoration-blue/50 underline-offset-4">
              See all
            </Link>
          </div>
          <ul className="mt-3 overflow-hidden rounded-lg border border-line bg-white">
            {recent.map((o) => (
              <OrderRow key={o.orderNumber} order={o} />
            ))}
          </ul>
        </section>
      ) : null}

      {/* 3. Pickup details, 4. support */}
      <div className="grid gap-4 md:grid-cols-2 md:gap-5">
        <section aria-labelledby="details-title" className="rounded-lg border border-line bg-white p-5" data-pickup-details>
          <div className="flex items-baseline justify-between gap-4">
            <h2 id="details-title" className="font-semibold text-navy">
              {hasAddress ? "Pickup details" : "Complete your pickup details"}
            </h2>
            <Link href="/account/profile" className="t-small font-semibold text-navy underline decoration-blue/50 underline-offset-4">
              {hasAddress ? "Edit" : "Add"}
            </Link>
          </div>
          <dl className="mt-3 space-y-2.5 t-small">
            <div>
              <dt className="text-secondary">Name</dt>
              <dd className="font-medium text-navy">{account.fullName}</dd>
            </div>
            <div>
              <dt className="text-secondary">Mobile</dt>
              <dd className="font-medium text-navy">
                {displayBdPhone(account.phone)}
                {linked ? <span className="ml-2 font-semibold text-success">Verified</span> : null}
              </dd>
            </div>
            <div>
              <dt className="text-secondary">Address</dt>
              <dd className="font-medium text-navy">
                {[account.address, areaLabel(account.area)].filter(Boolean).join(", ") || (
                  <span className="font-normal text-secondary">Add your address and area so pickups are filled in for you.</span>
                )}
              </dd>
            </div>
          </dl>
        </section>

        <section aria-labelledby="help-title" className="rounded-lg border border-line bg-white p-5">
          <h2 id="help-title" className="font-semibold text-navy">
            Need help with an order?
          </h2>
          <p className="mt-2 t-small text-body">Message Velto on WhatsApp with your order number and we&apos;ll help.</p>
          <WhatsAppButton href={WHATSAPP_URL} placement="account_help" className="mt-4 !h-11 !px-5" />
        </section>
      </div>

      {/* 5. Secondary setup */}
      <LinkHistoryCard account={account} />

      {linked && (orders?.length ?? 0) >= 3 ? (
        <section aria-labelledby="regular-title" className="rounded-lg bg-navy p-5 text-white md:p-6">
          <h2 id="regular-title" className="text-[20px] font-semibold tracking-[-0.01em]">
            Sending laundry every week?
          </h2>
          <p className="mt-1.5 max-w-[56ch] t-small text-white/80">A fixed weekly or fortnightly pickup means one less thing to arrange.</p>
          <ButtonLink href="/regular-laundry" variant="secondary-inverse" className="mt-4 !h-11">
            See regular pickups
          </ButtonLink>
        </section>
      ) : null}
    </div>
  );
}
