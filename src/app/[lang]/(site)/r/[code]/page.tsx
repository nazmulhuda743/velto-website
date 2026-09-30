import type { Metadata } from "next";
import Link from "@/components/i18n/Link";
import { RepeatByLink } from "@/components/rhythm/RepeatByLink";
import { formText } from "@/content/i18n/forms";
import { WHATSAPP_URL } from "@/content/site";
import { rhythmText, type RhythmText } from "@/content/i18n/rhythm";
import { notifyText } from "@/content/i18n/notify";
import { fill } from "@/lib/i18n/config";
import { getLocale } from "@/lib/i18n/server";
import { sectorOf } from "@/lib/capacity-logic";
import { bookingData, linkView, rhythmReady, type LinkView } from "@/lib/rhythm-server";

/**
 * The one-tap reminder page (docs/technical/RHYTHM.md). Opened from a reminder SMS: no sign-in.
 * It shows the first name and the usual service only; never the address or the phone, in case
 * the number changed owner. Staff confirm every pickup by phone, as always.
 * `/r/preview0` shows example details with booking switched off (for checking the design).
 */
export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return { title: rhythmText(await getLocale()).metaTitle, robots: { index: false, follow: false } };
}

const PREVIEW: LinkView = { ok: true, state: "open", firstName: "Nazmul", service: "Ironing", cadenceDays: 12, daysSince: 13, lang: "bn" };

function Closed({ t, title, body }: { t: RhythmText; title: string; body: string }) {
  return (
    <div className="space-y-4" data-rhythm="closed">
      <h1 id="page-title" className="font-serif text-[30px] leading-[1.15] text-navy">
        {title}
      </h1>
      <p className="text-body">{body}</p>
      <div className="flex flex-col gap-2.5 sm:flex-row">
        <Link href="/book?source=reminder_link" className="inline-flex min-h-12 items-center justify-center rounded-md bg-action px-6 font-semibold text-white hover:bg-action-hover">
          {t.bookPickup}
        </Link>
        <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" data-analytics="whatsapp_click" data-placement="reminder_link" className="inline-flex min-h-12 items-center justify-center rounded-md border border-line-strong px-6 font-semibold text-navy hover:border-navy">
          WhatsApp
        </a>
      </div>
    </div>
  );
}

export default async function ReminderPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const locale = await getLocale();
  const t = rhythmText(locale);
  const f = formText(locale);
  const preview = code === "preview0";
  const view: LinkView = preview ? PREVIEW : rhythmReady() ? await linkView(code).catch((): LinkView => ({ ok: false, reason: "unknown" })) : { ok: false, reason: "unknown" };

  let content: React.ReactNode;
  if (!view.ok || view.state === "expired") content = <Closed t={t} title={t.expiredTitle} body={t.expiredBody} />;
  else if (view.state === "booked") content = <Closed t={t} title={t.bookedTitle} body={view.bookingRef ? `${t.bookedBody} ${view.bookingRef}` : t.bookedBody} />;
  else if (view.state === "stopped") content = <Closed t={t} title={t.stoppedTitle} body={t.stoppedBody} />;
  else {
    // The sector (for live pickup windows) is read from the Ops address on the server; the address itself never reaches the page.
    const data = preview ? null : await bookingData(code).catch(() => null);
    const sector = data?.ok ? sectorOf(data.address) : null;
    const service = view.service ? (t.services[view.service] ?? view.service) : t.laundry;
    content = (
      <div className="space-y-6">
        {preview ? <p className="rounded-md bg-soft px-3 py-2 t-caption font-semibold text-secondary">{t.preview}</p> : null}
        <div>
          <p className="t-small font-semibold text-secondary">{view.firstName ? fill(t.hi, { name: view.firstName }, locale) : t.hiNoName}</p>
          <h1 id="page-title" className="mt-1 font-serif text-[32px] leading-[1.1] text-navy md:text-[38px]">
            {t.title}
          </h1>
        </div>
        <dl className="grid grid-cols-[auto_1fr] gap-x-5 gap-y-1.5 rounded-lg bg-soft p-4 text-[15px]">
          <dt className="text-secondary">{t.service}</dt>
          <dd className="font-semibold text-navy">{service}</dd>
          {view.cadenceDays ? (
            <>
              <dt className="text-secondary">{t.usually}</dt>
              <dd className="font-semibold text-navy">{fill(t.everyDays, { n: view.cadenceDays }, locale)}</dd>
            </>
          ) : null}
          {typeof view.daysSince === "number" ? (
            <>
              <dt className="text-secondary">{t.lastOrder}</dt>
              <dd className="font-semibold text-navy">{fill(t.daysAgo, { n: view.daysSince }, locale)}</dd>
            </>
          ) : null}
        </dl>
        <RepeatByLink
          code={code}
          sector={sector}
          t={t}
          preview={preview}
          notify={notifyText(locale)}
          whatsappHref={`${WHATSAPP_URL}?text=${encodeURIComponent(fill(t.whatsappText, { code }, locale))}`}
          slotLabels={f.booking.slots}
          words={{ today: f.booking.today, tomorrow: f.booking.tomorrow, weekdays: f.common.weekdays, months: f.common.months, dayMonth: f.common.dayMonth, locale }}
        />
      </div>
    );
  }

  return (
    <section aria-labelledby="page-title" className="bg-warm py-8 md:py-14">
      <div className="container-page">
        <div className="mx-auto max-w-[480px] rounded-lg border border-line bg-white p-5 shadow-[0_12px_32px_-24px_rgba(0,43,78,0.35)] md:p-8">{content}</div>
      </div>
    </section>
  );
}
