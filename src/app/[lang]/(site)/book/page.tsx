import { pageMetadata } from "@/lib/seo/page-metadata";
import { BookingSection } from "@/components/forms/BookingSection";
import { Breadcrumbs } from "@/components/pages/Breadcrumbs";
import { WhatsAppButton } from "@/components/ui/Button";
import { WHATSAPP_URL } from "@/content/site";
import { dictionary } from "@/content/i18n";
import { formText } from "@/content/i18n/forms";
import { localDigits } from "@/lib/i18n/config";
import { getLocale } from "@/lib/i18n/server";

export const generateMetadata = () => pageMetadata("/book");

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** Primary booking route (spec §22). The mobile conversion bar is intentionally absent here. */
export default async function BookPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const locale = await getLocale();
  const f = formText(locale);
  const t = f.bookPage;

  return (
    <section aria-labelledby="page-title" className="group/book pb-(--space-section) pt-7 md:pt-10 xl:pt-12">
      <div className="container-page">
        <div className="hidden md:block">
          <Breadcrumbs items={[{ label: dictionary(locale).common.home, href: "/" }, { label: t.crumb }]} />
        </div>
        <div className="grid-page gap-y-10 md:mt-8">
          <div className="col-span-4 md:col-span-8 xl:col-span-7">
            <div className="max-w-[640px]">
              <BookingSection params={params} />
            </div>
          </div>

          <aside aria-label={t.asideLabel} className="group-has-[[data-booking-success]]/book:hidden col-span-4 md:col-span-8 xl:col-span-4 xl:col-start-9">
            <div className="xl:sticky xl:top-[calc(100px+var(--promo-h,0px))]">
              <div className="hidden xl:block">
                <h2 className="t-label uppercase text-navy">{t.howTitle}</h2>
                <ol className="mt-4 border-t border-navy">
                  {f.booking.nextSteps.map((step, i) => (
                    <li key={step} className="flex gap-3 border-b border-line py-3.5 t-small text-body">
                      <span className="t-label pt-[2px] text-action">{localDigits(String(i + 1).padStart(2, "0"), locale)}</span>
                      {step}
                    </li>
                  ))}
                </ol>
                <p className="mt-4 t-small text-secondary">{t.pickupNote}</p>
              </div>
              <div className="border-t border-line pt-6 xl:mt-8">
                <p className="font-semibold text-navy">{t.ratherTitle}</p>
                <p className="mt-1 t-small text-secondary">{t.ratherBody}</p>
                <WhatsAppButton href={WHATSAPP_URL} placement="booking_aside" className="mt-4" />
              </div>
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}
