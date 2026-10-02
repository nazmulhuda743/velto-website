import type { Metadata } from "next";
import Link from "@/components/i18n/Link";
import { OrderProgress } from "@/components/account/OrderProgress";
import { StatusPill } from "@/components/account/OrderRow";
import { PrintButton } from "@/components/invoice/PrintButton";
import { WhatsAppButton } from "@/components/ui/Button";
import { serviceLabel } from "@/content/order-status";
import { accountText, orderFormat } from "@/content/i18n/account";
import { invoiceText } from "@/content/i18n/invoice";
import { WHATSAPP_URL } from "@/content/site";
import { getCustomerSession, getPortalOrder } from "@/lib/customer/portal";
import { fill, localDigits } from "@/lib/i18n/config";
import { getLocale } from "@/lib/i18n/server";
import { invoiceSums } from "@/lib/invoice";
import { getInvoice, invoicesReady, type InvoiceView } from "@/lib/invoice-server";

/**
 * The invoice link staff send on WhatsApp (docs/technical/INVOICES.md). Opens without sign-in, so
 * it shows the first name only: never the phone or the address. Signing in with the same number
 * puts this and every other order in the customer's account. `/i/preview0` shows example data.
 */
export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return { title: invoiceText(await getLocale()).metaTitle, robots: { index: false, follow: false } };
}

const PREVIEW: InvoiceView = {
  ok: true,
  orderNumber: "VEL-01234",
  status: "Ready",
  orderDate: "2026-09-29",
  pickupDate: "2026-09-29",
  deliveryDate: "2026-10-02",
  promisedAt: null,
  deliveredAt: null,
  services: ["Ironing", "Dry Cleaning"],
  express: false,
  expressFee: 0,
  total: 420,
  paid: 200,
  due: 220,
  paymentStatus: "Partial",
  outlet: { code: "S11", name: "Velto Sector 11" },
  firstName: "Nazmul",
  lines: [
    { item: "Shirt", service: "Ironing", quantity: 8, price: 15 },
    { item: "Pant", service: "Ironing", quantity: 4, price: 15 },
    { item: "Blazer", service: "Dry Cleaning", quantity: 1, price: 250 },
  ],
  payments: [{ amount: 200, method: "Bkash", on: "2026-09-29" }],
};

function Closed({ title, body, whatsapp, signIn }: { title: string; body: string; whatsapp: string; signIn: string }) {
  return (
    <div className="space-y-4" data-invoice-state="closed">
      <h1 id="page-title" className="font-serif text-[30px] leading-[1.15] text-navy">
        {title}
      </h1>
      <p className="text-body">{body}</p>
      <div className="flex flex-col gap-2.5 sm:flex-row">
        <Link href="/login?next=%2Faccount%2Forders" className="inline-flex min-h-12 items-center justify-center rounded-md bg-action px-6 font-semibold text-white hover:bg-action-hover">
          {signIn}
        </Link>
        <WhatsAppButton href={whatsapp} placement="invoice_link" className="!h-12 !px-5" />
      </div>
    </div>
  );
}

function Row({ label, value, strong, tone }: { label: string; value: string | null; strong?: boolean; tone?: "error" | "success" }) {
  return (
    <div className="flex justify-between gap-4 py-2">
      <dt className={strong ? "font-semibold text-navy" : "text-body"}>{label}</dt>
      <dd className={`shrink-0 font-semibold ${tone === "error" ? "text-error" : tone === "success" ? "text-success" : "text-navy"}`}>{value}</dd>
    </div>
  );
}

export default async function InvoicePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const locale = await getLocale();
  const t = invoiceText(locale);
  const o = accountText(locale).order;
  const { day, taka, statusTitle } = orderFormat(locale);
  const preview = code === "preview0";
  const view: InvoiceView = preview ? PREVIEW : invoicesReady() ? await getInvoice(code).catch((): InvoiceView => ({ ok: false, reason: "unknown" })) : { ok: false, reason: "unknown" };

  const shell = (content: React.ReactNode) => (
    <section aria-labelledby="page-title" className="bg-warm py-8 md:py-14 print:bg-white print:py-0">
      <div className="container-page">
        <div className="mx-auto max-w-[640px] rounded-lg border border-line bg-white p-5 shadow-[0_12px_32px_-24px_rgba(0,43,78,0.35)] md:p-8 print:max-w-none print:border-0 print:p-0 print:shadow-none" data-invoice>
          {content}
        </div>
      </div>
    </section>
  );

  if (!view.ok) {
    const n = view.orderNumber ?? "";
    const whatsapp = `${WHATSAPP_URL}?text=${encodeURIComponent(fill(t.whatsapp, { n }, locale))}`;
    return shell(view.reason === "expired" ? <Closed title={t.expiredTitle} body={t.expiredBody} whatsapp={whatsapp} signIn={t.keepButton} /> : <Closed title={t.unknownTitle} body={t.unknownBody} whatsapp={WHATSAPP_URL} signIn={t.keepButton} />);
  }

  const sums = invoiceSums(view.lines, view.total, view.express ? view.expressFee : 0);
  const cancelled = view.status === "Cancelled";
  // Already this customer's order in their account: offer to open it there. Signed out: offer the sign-in.
  const session = preview ? null : await getCustomerSession();
  const theirs = session?.kind === "customer" && session.account.state === "ready" ? await getPortalOrder(view.orderNumber).then((x) => (x && x !== "error" ? x : null)).catch(() => null) : null;
  const signedOut = preview || session?.kind === "anonymous";
  const accountHref = `/account/orders/${encodeURIComponent(view.orderNumber)}`;
  const whatsapp = `${WHATSAPP_URL}?text=${encodeURIComponent(fill(t.whatsapp, { n: view.orderNumber }, locale))}`;
  const expected = view.promisedAt ?? view.deliveryDate;

  return shell(
    <div className="space-y-7">
      {preview ? <p className="rounded-md bg-soft px-3 py-2 t-caption font-semibold text-secondary print:hidden">{t.preview}</p> : null}

      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-navy pb-5">
        <div>
          <p className="t-label uppercase text-secondary">
            {t.label} · {view.orderNumber}
          </p>
          <h1 id="page-title" className="mt-2 font-serif text-[30px] leading-[1.1] text-navy md:text-[36px]">
            {cancelled ? o.cancelledTitle : statusTitle(view.status)}
          </h1>
          {view.firstName ? <p className="mt-2 t-small text-secondary">{fill(t.hi, { name: view.firstName }, locale)}</p> : null}
        </div>
        <StatusPill status={view.status} />
      </header>

      {!cancelled ? (
        <div className="print:hidden">
          <OrderProgress status={view.status} compact />
        </div>
      ) : null}

      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 md:grid-cols-3">
        <div>
          <dt className="t-caption uppercase tracking-[0.04em] text-secondary">{o.ordered}</dt>
          <dd className="mt-0.5 font-semibold text-navy">{day(view.orderDate, true)}</dd>
        </div>
        {view.deliveredAt ? (
          <div>
            <dt className="t-caption uppercase tracking-[0.04em] text-secondary">{o.delivered}</dt>
            <dd className="mt-0.5 font-semibold text-navy">{day(view.deliveredAt, true)}</dd>
          </div>
        ) : !cancelled ? (
          <div>
            <dt className="t-caption uppercase tracking-[0.04em] text-secondary">{o.expectedBack}</dt>
            <dd className="mt-0.5 font-semibold text-navy">{day(expected) ?? o.weConfirm}</dd>
          </div>
        ) : null}
        {view.outlet ? (
          <div>
            <dt className="t-caption uppercase tracking-[0.04em] text-secondary">{o.outlet}</dt>
            <dd className="mt-0.5 font-semibold text-navy">{view.outlet.name}</dd>
          </div>
        ) : null}
      </dl>

      <section aria-labelledby="items-title">
        <h2 id="items-title" className="t-label uppercase text-navy">
          {t.itemsTitle}
        </h2>
        {sums.lines.length ? (
          <ul className="mt-2 divide-y divide-line border-y border-line">
            {sums.lines.map((line, i) => (
              <li key={`${line.item}-${i}`} className="flex items-start justify-between gap-4 py-3">
                <span className="min-w-0">
                  <span className="block font-medium text-navy">
                    {line.item} <span className="font-normal text-secondary">× {localDigits(line.quantity, locale)}</span>
                  </span>
                  <span className="block t-small text-secondary">
                    {line.service ? serviceLabel(line.service) : null}
                    {line.price !== null && line.quantity > 1 ? ` · ${fill(t.each, { price: taka(line.price) ?? "" }, locale)}` : null}
                  </span>
                </span>
                <span className="shrink-0 font-semibold text-navy">{line.amount !== null ? taka(line.amount) : <span className="t-small font-normal text-secondary">{t.priceLater}</span>}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 t-small text-secondary">{o.beingCounted}</p>
        )}

        <dl className="mt-3">
          {sums.subtotal !== null && (sums.express > 0 || sums.adjustment) ? <Row label={t.subtotal} value={taka(sums.subtotal)} /> : null}
          {sums.express > 0 ? <Row label={t.express} value={taka(sums.express)} /> : null}
          {sums.adjustment ? <Row label={sums.adjustment < 0 ? t.discount : t.otherCharges} value={`${sums.adjustment < 0 ? "−" : "+"}${taka(Math.abs(sums.adjustment))}`} /> : null}
          <div className="mt-1 border-t border-navy" />
          <Row label={o.total} value={taka(view.total)} strong />
          <Row label={o.paidRow} value={taka(view.paid)} />
          <Row
            label={cancelled ? o.status : o.due}
            value={cancelled ? o.cancelled : view.due > 0 ? taka(view.due) : o.paidInFull}
            strong
            tone={cancelled ? undefined : view.due > 0 ? "error" : "success"}
          />
        </dl>
      </section>

      {view.payments.length ? (
        <section aria-labelledby="payments-title">
          <h2 id="payments-title" className="t-label uppercase text-navy">
            {t.paymentsTitle}
          </h2>
          <ul className="mt-2 space-y-1 t-small text-body">
            {view.payments.map((p, i) => (
              <li key={i}>
                {[taka(p.amount), p.method ? (t.methods[p.method] ?? p.method) : null, day(p.on)].filter(Boolean).join(" · ")}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {theirs ? (
        <section className="flex flex-wrap items-center justify-between gap-4 rounded-lg bg-soft p-5 print:hidden" data-invoice-account="open">
          <p className="font-semibold text-navy">{t.openTitle}</p>
          <Link href={accountHref} className="inline-flex min-h-12 items-center justify-center rounded-md bg-action px-6 font-semibold text-white hover:bg-action-hover">
            {t.openButton}
          </Link>
        </section>
      ) : signedOut ? (
        <section aria-labelledby="keep-title" className="rounded-lg border border-navy/15 bg-soft p-5 md:p-6 print:hidden" data-invoice-account="sign-in">
          <h2 id="keep-title" className="font-semibold text-navy">
            {t.keepTitle}
          </h2>
          <p className="mt-1.5 t-small text-body">{t.keepBody}</p>
          <Link
            href={`/login?next=${encodeURIComponent(accountHref)}`}
            className="mt-4 inline-flex min-h-12 w-full items-center justify-center rounded-md bg-action px-6 font-semibold text-white hover:bg-action-hover sm:w-auto"
          >
            {t.keepButton}
          </Link>
        </section>
      ) : null}

      <div className="flex flex-col gap-2.5 border-t border-line pt-5 sm:flex-row sm:items-center sm:justify-between print:hidden">
        <p className="t-small text-secondary">{t.question}</p>
        <div className="flex flex-col gap-2.5 sm:flex-row">
          <PrintButton label={t.print} />
          <WhatsAppButton href={whatsapp} placement="invoice_link" className="!h-12 !px-5" />
        </div>
      </div>
    </div>,
  );
}
