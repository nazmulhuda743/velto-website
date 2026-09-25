import { TrackOrder } from "@/components/forms/TrackOrder";
import { Breadcrumbs } from "@/components/pages/Breadcrumbs";
import { pageMetadata } from "@/lib/seo/page-metadata";
import { dictionary } from "@/content/i18n";
import { formText } from "@/content/i18n/forms";
import { getLocale } from "@/lib/i18n/server";

/**
 * Not indexed: a utility for existing customers (they arrive from the receipt, menu or footer),
 * with no content a searcher needs. Order data is only ever returned to a matching POST.
 */
export const generateMetadata = () => pageMetadata("/track", { noindex: true });

export default async function TrackPage() {
  const locale = await getLocale();
  const f = formText(locale);
  const t = f.trackPage;
  return (
    <section aria-labelledby="page-title" className="bg-soft pb-(--space-section) pt-6 md:pt-10 xl:pt-12">
      <div className="container-page">
        <Breadcrumbs items={[{ label: dictionary(locale).common.home, href: "/" }, { label: t.crumb }]} />
        <div className="mt-6 max-w-[880px] md:mt-8">
          <h1 id="page-title" className="t-h1 text-navy">
            {t.title}
          </h1>
          <p className="mt-5 max-w-[56ch] t-body text-body md:t-body-lg">{t.intro}</p>
          <div className="mt-(--space-intro-content)">
            <TrackOrder t={f.track} common={f.common} />
          </div>
        </div>
      </div>
    </section>
  );
}
