import { pageMetadata } from "@/lib/seo/page-metadata";
import { FAQ, faqItems } from "@/components/home/FAQ";
import { FinalBookingCTA } from "@/components/home/FinalBookingCTA";
import { PriceFinder } from "@/components/home/PriceFinder";
import { Eyebrow, SectionIntro } from "@/components/home/SectionIntro";
import { Breadcrumbs } from "@/components/pages/Breadcrumbs";
import { JsonLd } from "@/components/seo/JsonLd";
import { buildBreadcrumbSchema } from "@/lib/seo/schema";
import { FactRows } from "@/components/pages/FactRows";
import { ServiceCompare } from "@/components/services/ServiceCompare";
import { TextLink } from "@/components/ui/TextLink";
import { ButtonLink } from "@/components/ui/Button";
import { FREE_DELIVERY_THRESHOLD, bookHref } from "@/content/site";
import { dictionary } from "@/content/i18n";
import { pageText } from "@/content/i18n/pages";
import { fill, localizeHref } from "@/lib/i18n/config";
import { getLocale } from "@/lib/i18n/server";

export const generateMetadata = () => pageMetadata("/pricing");

/**
 * Pricing page. The only price data shown comes through PriceFinder → /api/prices,
 * which the Codex pricing adapter replaces. No prices are hardcoded here.
 */
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** Quote services, in the order of pageText().pricingPage.household. */
const HOUSEHOLD_SERVICES = ["curtain-cleaning", "carpet-cleaning", "blanket-comforter-cleaning"];

export default async function PricingPage({ searchParams }: { searchParams: SearchParams }) {
  const q = (await searchParams).q;
  const initialQuery = (Array.isArray(q) ? q[0] : q) ?? "";
  const locale = await getLocale();
  const d = dictionary(locale);
  const t = pageText(locale).pricingPage;
  const free = fill(t.free, { amount: FREE_DELIVERY_THRESHOLD }, locale);
  return (
    <>
      <section aria-labelledby="page-title" className="bg-soft pb-(--space-section) pt-6 md:pt-10 xl:pt-12">
        <div className="container-page">
          <Breadcrumbs items={[{ label: d.common.home, href: "/" }, { label: d.nav.pricing }]} />
          <JsonLd
            data={buildBreadcrumbSchema([
              { label: d.common.home, path: localizeHref("/", locale) },
              { label: d.nav.pricing, path: localizeHref("/pricing", locale) },
            ])}
          />
          <div className="mt-6 grid-page gap-y-12 md:mt-8">
            <div className="col-span-4 md:col-span-8 xl:col-span-7">
              <Eyebrow>{t.eyebrow}</Eyebrow>
              <h1 id="page-title" className="t-h1 max-w-[18ch] text-navy">
                {t.titleBefore}
                <span className="text-blue">{t.titleHighlight}</span>
                {t.titleAfter}
              </h1>
              <div className="mt-5 max-w-[560px] space-y-4 t-body text-body md:mt-6 md:t-body-lg">
                <p>{t.intro}</p>
              </div>
              <div className="mt-(--space-intro-content)">
                <PriceFinder initialQuery={initialQuery} syncUrl bookFromResult={{ source: "pricing-result" }} />
              </div>
            </div>
            <aside aria-label={t.asideLabel} className="col-span-4 md:col-span-8 xl:col-span-4 xl:col-start-9 xl:pt-2">
              <p className="border-t border-navy pt-4 t-h4 text-navy [text-wrap:balance]">
                {free}
              </p>
              <p className="mt-3 t-small text-secondary">{t.smaller}</p>
              <FactRows
                className="mt-10"
                rows={d.home.findPrice.turnaround}
              />
              <p className="mt-4 t-small text-secondary">{t.mayTakeLonger}</p>
              {/* The step after checking a price: on mobile this lands right after the search, not at the page end. */}
              <div className="mt-8 border-t border-line pt-6">
                <p className="font-semibold text-navy">{t.knowTitle}</p>
                <p className="mt-1 t-small text-secondary">{t.knowBody}</p>
                <ButtonLink href={bookHref("pricing-aside")} event="book_pickup_click" placement="pricing_aside" className="mt-4 max-md:w-full">
                  {d.common.bookPickup}
                </ButtonLink>
              </div>
            </aside>
          </div>
        </div>
      </section>

      <section aria-labelledby="compare-title" className="py-(--space-section)">
        <div className="container-page">
          <div className="max-w-[640px]">
            <SectionIntro id="compare-title" eyebrow={pageText(locale).service.blockEyebrows.compare} title={t.compareTitle}>
              <p>{t.compareIntro}</p>
            </SectionIntro>
          </div>
          <div className="mt-(--space-intro-content)">
            <ServiceCompare current={null} />
          </div>
        </div>
      </section>

      <section aria-labelledby="household-pricing-title" className="bg-warm py-(--space-section)">
        <div className="container-page grid-page gap-y-10">
          <div className="col-span-4 md:col-span-8 xl:col-span-5">
            <SectionIntro id="household-pricing-title" eyebrow={t.householdEyebrow} title={t.householdTitle}>
              <p>{t.householdIntro}</p>
            </SectionIntro>
          </div>
          <div className="col-span-4 md:col-span-8 xl:col-span-6 xl:col-start-7">
            <ul className="border-t border-navy">
              {t.household.map((row, i) => (
                <li key={HOUSEHOLD_SERVICES[i]} className="border-b border-line py-4">
                  <h3 className="t-label uppercase text-navy">{row.label}</h3>
                  <p className="mt-1 text-body">{row.copy}</p>
                  <div className="mt-1">
                    <TextLink href={`/quote?service=${HOUSEHOLD_SERVICES[i]}&source=pricing-page`} placement="pricing_household">
                      {row.action}
                    </TextLink>
                  </div>
                </li>
              ))}
            </ul>
            <div className="mt-6">
              <TextLink href="/services" placement="pricing_services">
                {t.seeAllServices}
              </TextLink>
            </div>
          </div>
        </div>
      </section>

      <FAQ title={t.faqTitle} items={faqItems(locale, "freeDelivery", "express", "household", "unsure")} />

      <FinalBookingCTA
        id="book"
        title={t.finalTitle}
        body={<p>{t.finalBody}</p>}
        source="pricing-page-final"
      />
    </>
  );
}
