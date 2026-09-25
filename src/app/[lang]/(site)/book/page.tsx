import Link from "@/components/i18n/Link";
import { pageMetadata } from "@/lib/seo/page-metadata";
import { getCustomerSession } from "@/lib/customer/portal";
import { BookingForm } from "@/components/forms/BookingForm";
import { Breadcrumbs } from "@/components/pages/Breadcrumbs";
import { WhatsAppButton } from "@/components/ui/Button";
import { WHATSAPP_URL } from "@/content/site";
import { dictionary } from "@/content/i18n";
import { formText } from "@/content/i18n/forms";
import { format, localDigits } from "@/lib/i18n/config";
import { getLocale } from "@/lib/i18n/server";

export const generateMetadata = () => pageMetadata("/book");

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** Primary booking route (spec §22). The mobile conversion bar is intentionally absent here. */
export default async function BookPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const service = one(params.service);
  // Development-only QA hook: simulate the adapter result without any backend.
  const preview = process.env.NODE_ENV !== "production" ? one(params.preview) : undefined;
  const previewOutcome = preview === "success" || preview === "error" ? preview : undefined;
  const session = await getCustomerSession();
  const account = session.kind === "customer" && session.account.state === "ready" ? session.account : null;
  const returnTo = `/book${service ? `?service=${encodeURIComponent(service)}` : ""}`;
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
              <BookingForm
                t={f.booking}
                common={f.common}
                intro={
                  <>
                    {t.intro}
                    {account ? (
                      <span className="mt-3 block t-small text-secondary" data-prefilled>
                        {format(t.signedIn, { name: account.fullName })}
                      </span>
                    ) : session.kind === "anonymous" ? (
                      <span className="mt-3 block t-small text-secondary">
                        {t.haveAccount}
                        <Link href={`/login?next=${encodeURIComponent(returnTo)}`} className="font-semibold text-navy underline decoration-blue/50 underline-offset-4">
                          {t.signInLink}
                        </Link>
                        {t.signInAfter}
                      </span>
                    ) : null}
                  </>
                }
                initialService={service}
                presetNote={t.presetNotes[service ?? ""]}
                previewOutcome={previewOutcome}
                initialContact={
                  account
                    ? { name: account.fullName, phone: account.phone, address: account.address ?? "", sector: account.area ?? "" }
                    : undefined
                }
              />
            </div>
          </div>

          <aside aria-label={t.asideLabel} className="group-has-[[data-booking-success]]/book:hidden col-span-4 md:col-span-8 xl:col-span-4 xl:col-start-9">
            <div className="xl:sticky xl:top-[100px]">
              <div className="hidden xl:block">
                <h2 className="t-label uppercase text-navy">{t.howTitle}</h2>
                <ol className="mt-4 border-t border-navy">
                  {f.booking.nextSteps.map((step, i) => (
                    <li key={step} className="flex gap-3 border-b border-line py-3.5 t-small text-body">
                      <span className="t-label pt-[2px] text-blue">{localDigits(String(i + 1).padStart(2, "0"), locale)}</span>
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
