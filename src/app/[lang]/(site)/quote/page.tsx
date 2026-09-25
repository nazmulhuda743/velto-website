import { pageMetadata } from "@/lib/seo/page-metadata";
import { QuoteForm } from "@/components/forms/QuoteForm";
import { Breadcrumbs } from "@/components/pages/Breadcrumbs";
import { ProcessSteps } from "@/components/pages/ProcessSteps";
import { WhatsAppButton } from "@/components/ui/Button";
import { WHATSAPP_URL } from "@/content/site";
import { dictionary } from "@/content/i18n";
import { formText } from "@/content/i18n/forms";
import { getLocale } from "@/lib/i18n/server";

export const generateMetadata = () => pageMetadata("/quote");

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** Household quote route (spec §7). */
export default async function QuotePage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const preview =
    process.env.NODE_ENV !== "production" && (one(params.preview) === "success" || one(params.preview) === "error")
      ? (one(params.preview) as "success" | "error")
      : undefined;
  const locale = await getLocale();
  const f = formText(locale);
  const t = f.quotePage;

  return (
    <section aria-labelledby="page-title" className="pb-(--space-section) pt-6 md:pt-10 xl:pt-12">
      <div className="container-page">
        <Breadcrumbs items={[{ label: dictionary(locale).common.home, href: "/" }, { label: t.crumb }]} />
        <div className="mt-6 grid-page gap-y-12 md:mt-8">
          <div className="col-span-4 md:col-span-8 xl:col-span-7">
            <h1 id="page-title" className="t-h1 max-w-[20ch] text-navy">
              {t.title}
            </h1>
            <p className="mt-4 max-w-[52ch] t-body text-body md:t-body-lg">{t.intro}</p>
            <div className="mt-(--space-intro-content)">
              <QuoteForm t={f.quote} common={f.common} initialService={one(params.service)} preview={preview} />
            </div>
          </div>

          <aside aria-labelledby="next-title" className="col-span-4 md:col-span-8 xl:col-span-4 xl:col-start-9">
            <div className="xl:sticky xl:top-[100px]">
              <h2 id="next-title" className="t-label uppercase text-navy">
                {t.howTitle}
              </h2>
              <ProcessSteps className="mt-4" steps={t.steps} />
              <div className="mt-8 border-t border-line pt-6">
                <p className="font-semibold text-navy">{t.photosTitle}</p>
                <p className="mt-1 t-small text-secondary">{t.photosBody}</p>
                <WhatsAppButton href={WHATSAPP_URL} placement="quote_aside" className="mt-4" />
              </div>
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}
