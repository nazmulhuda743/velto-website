import Link from "@/components/i18n/Link";
import { ButtonLink, WhatsAppButton } from "@/components/ui/Button";
import { serviceLabel } from "@/content/order-status";
import { accountText, orderFormat } from "@/content/i18n/account";
import { WHATSAPP_URL } from "@/content/site";
import { fill, format, localDigits, type Locale } from "@/lib/i18n/config";
import { repeatHref, type Rhythm } from "@/lib/customer/rhythm";

/**
 * The account's main next step when nothing is in progress: first pickup, then "the same
 * again" with the customer's own pace. One primary action; WhatsApp stays one tap away for
 * customers who would rather message. Everything shown comes from their own orders.
 */
export function NextPickupCard({ rhythm, locale, firstTime }: { rhythm: Rhythm; locale: Locale; firstTime: boolean }) {
  const a = accountText(locale);
  const t = a.next;
  const { day } = orderFormat(locale);
  const last = rhythm.last;

  if (!last) {
    return (
      <section aria-labelledby="next-title" className="rounded-lg border border-line bg-white p-5 shadow-[0_12px_32px_-26px_rgba(0,43,78,0.45)] md:p-7" data-next-pickup="first">
        {/* Not linked yet: they may have ordered before, so don't call it their first. */}
        <p className="t-label uppercase text-action">{firstTime ? t.firstEyebrow : t.eyebrow}</p>
        <h2 id="next-title" className="mt-2 text-[28px] font-semibold leading-[1.1] tracking-[-0.02em] text-navy md:text-[36px]">
          {firstTime ? t.firstTitle : a.home.book}
        </h2>
        <p className="mt-2 max-w-[52ch] text-body">{t.firstBody}</p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <ButtonLink href="/book?source=account_first" event="book_pickup_click" placement="account_first" className="sm:!px-8">
            {firstTime ? t.firstButton : a.home.book}
          </ButtonLink>
          <WhatsAppButton href={`${WHATSAPP_URL}?text=${encodeURIComponent(firstTime ? t.whatsappFirst : a.next.whatsappAny)}`} placement="account_first">
            {t.orWhatsApp}
          </WhatsAppButton>
        </div>
      </section>
    );
  }

  const services = last.services.map(serviceLabel).join(", ");
  const since = rhythm.daysSince ?? 0;
  const back = rhythm.sinceDelivery
    ? since === 0
      ? t.backToday
      : fill(since === 1 ? t.backOne : t.backMany, { n: since }, locale)
    : since === 0
      ? t.placedToday
      : fill(since === 1 ? t.placedOne : t.placedMany, { n: since }, locale);
  const nextDay = day(rhythm.nextOn);
  const pace =
    rhythm.due === "now"
      ? t.dueNow
      : rhythm.due && nextDay
        ? format(rhythm.due === "overdue" ? t.dueOverdue : rhythm.due === "soon" ? t.dueSoon : t.dueLater, { date: nextDay })
        : null;
  const whatsapp = `${WHATSAPP_URL}?text=${encodeURIComponent(format(t.whatsappText, { n: last.orderNumber }))}`;

  return (
    <section aria-labelledby="next-title" className="rounded-lg border border-line bg-white p-5 shadow-[0_12px_32px_-26px_rgba(0,43,78,0.45)] md:p-7" data-next-pickup={rhythm.stage}>
      <div className="grid gap-x-10 gap-y-6 md:grid-cols-[1fr_auto]">
        <div>
          <p className="t-label uppercase text-action">{t.eyebrow}</p>
          <h2 id="next-title" className="mt-2 text-[28px] font-semibold leading-[1.1] tracking-[-0.02em] text-navy md:text-[36px]">
            {t.title}
          </h2>
          <p className="mt-2 text-body">
            {back}
            {rhythm.everyDays ? <> {fill(t.rhythm, { n: rhythm.everyDays }, locale)}</> : null}
          </p>
          {pace ? (
            <p className={`mt-1 font-semibold ${rhythm.due === "now" || rhythm.due === "overdue" ? "text-action" : "text-navy"}`}>{pace}</p>
          ) : null}
        </div>

        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 border-t border-line pt-4 md:w-[240px] md:grid-cols-1 md:border-l md:border-t-0 md:pl-6 md:pt-0">
          <div>
            <dt className="t-caption uppercase tracking-[0.04em] text-secondary">{t.lastOrder}</dt>
            <dd className="mt-0.5">
              <Link href={`/account/orders/${last.orderNumber}`} className="font-semibold text-navy underline decoration-blue/40 underline-offset-4 hover:decoration-blue">
                {last.orderNumber}
              </Link>
              <span className="block t-small text-secondary">
                {[day(last.orderDate), services].filter(Boolean).join(" · ")}
              </span>
            </dd>
          </div>
          <div>
            <dt className="t-caption uppercase tracking-[0.04em] text-secondary">{t.ordersSoFar}</dt>
            <dd className="mt-0.5 font-semibold text-navy tabular-nums">{localDigits(rhythm.count, locale)}</dd>
          </div>
        </dl>
      </div>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <ButtonLink href={repeatHref(rhythm, `account_${rhythm.stage}`)} event="book_pickup_click" placement={`account_repeat_${rhythm.stage}`} className="sm:!px-8">
          {t.same}
        </ButtonLink>
        <WhatsAppButton href={whatsapp} placement={`account_repeat_${rhythm.stage}`}>
          {t.orWhatsApp}
        </WhatsAppButton>
      </div>
      <p className="mt-3 t-small text-secondary">
        {services ? format(t.sameWith, { services }) : null}{" "}
        <Link href="/book?source=account" className="font-semibold text-navy underline decoration-blue/40 underline-offset-4 hover:decoration-blue">
          {t.fresh}
        </Link>
      </p>
    </section>
  );
}
