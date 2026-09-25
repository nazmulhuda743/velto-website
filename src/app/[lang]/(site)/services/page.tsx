import { pageMetadata } from "@/lib/seo/page-metadata";
import { ProofFigures } from "@/components/pages/ProofFigures";
import { pageFigures } from "@/components/pages/figures";
import Link from "@/components/i18n/Link";
import { FAQ, faqItems } from "@/components/home/FAQ";
import { FinalBookingCTA } from "@/components/home/FinalBookingCTA";
import { SectionIntro } from "@/components/home/SectionIntro";
import { MobileConversionBar } from "@/components/layout/MobileConversionBar";
import { PageHero } from "@/components/pages/PageHero";
import { ServiceCompare } from "@/components/services/ServiceCompare";
import { ButtonLink } from "@/components/ui/Button";
import { ArrowRight } from "@/components/ui/icons";
import { ResponsiveImage } from "@/components/ui/ResponsiveImage";
import { TextLink } from "@/components/ui/TextLink";
import { servicePages, type ServiceContent, type ServiceSlug } from "@/content/services";
import { FREE_DELIVERY_THRESHOLD, bookHref, quoteHref } from "@/content/site";
import { IMAGES } from "@/content/mock";
import { dictionary } from "@/content/i18n";
import { pageText } from "@/content/i18n/pages";
import { fill } from "@/lib/i18n/config";
import { getLocale } from "@/lib/i18n/server";

export const revalidate = 300;

export const generateMetadata = () => pageMetadata("/services");

/** Group slugs, in the order of the group titles in the page text. */
const GROUPS: ServiceSlug[][] = [
  ["dry-cleaning", "wash-and-iron", "ironing"],
  ["curtain-cleaning", "carpet-cleaning", "blanket-comforter-cleaning"],
  ["express"],
];

function DecisionRow({ service }: { service: ServiceContent }) {
  return (
    <li className="border-b border-line">
      <Link
        href={`/services/${service.slug}`}
        className="group grid gap-x-6 gap-y-2 py-5 md:grid-cols-[7.5rem_minmax(0,1fr)_14rem_auto] md:items-center md:py-6"
      >
        <ResponsiveImage
          image={service.image}
          aspect="aspect-[4/3]"
          sizes="120px"
          decorative
          className="hidden md:block"
        />
        <span className="text-[18px] font-semibold leading-snug tracking-[-0.01em] text-navy md:text-[20px]">
          {service.whenToChoose}
        </span>
        <span className="block">
          <span className="flex items-center gap-2 font-semibold text-action group-hover:underline group-hover:underline-offset-4">
            {service.name}
            <ArrowRight className="size-4 md:hidden" />
          </span>
          <span className="mt-0.5 block t-caption text-secondary">{service.overviewFact}</span>
        </span>
        <ArrowRight className="hidden size-5 text-blue transition-transform duration-200 group-hover:translate-x-0.5 motion-reduce:transition-none md:block" />
      </Link>
    </li>
  );
}

/** Links for the pricing models, in the order of pageText().servicesPage.models. */
const MODEL_LINKS = ["/pricing", quoteHref(undefined, "services-page"), "/services/blanket-comforter-cleaning"];

export default async function ServicesPage() {
  const locale = await getLocale();
  const d = dictionary(locale);
  const t = pageText(locale).servicesPage;
  const fig = await pageFigures();
  const bySlug = new Map(servicePages(locale).map((s) => [s.slug, s]));
  return (
    <>
      <PageHero
        path={"/services"}
        image={IMAGES.final}
        crumbs={[{ label: d.common.home, href: "/" }, { label: d.nav.services }]}
        title={t.title}
        eyebrow={t.eyebrow}
        highlight={t.highlight}
        actions={
          <>
            <ButtonLink
              href={bookHref("services-page")}
              event="book_pickup_click"
              placement="services_hero"
              className="flex-[1.45] max-md:px-4 md:flex-none"
            >
              {d.common.bookPickup}
            </ButtonLink>
            <ButtonLink href="/pricing" variant="secondary" placement="services_hero" className="flex-1 max-md:px-3 md:flex-none">
              {t.viewPricing}
            </ButtonLink>
          </>
        }
        aside={<ProofFigures wide={3} figures={[await fig.google("services_hero"), fig.sectors, fig.freeDelivery]} />}
      >
        <p>{t.intro}</p>
      </PageHero>

      <section aria-labelledby="choose-title" className="bg-warm py-(--space-section)">
        <div className="container-page">
          <SectionIntro id="choose-title" eyebrow={t.chooseEyebrow} title={t.chooseTitle} />
          <div className="mt-(--space-intro-content) space-y-(--space-related)">
            {GROUPS.map((slugs, g) => (
              <div key={t.groups[g]}>
                <h3 className="t-label uppercase text-navy">{t.groups[g]}</h3>
                <ul className="mt-3 border-t border-navy">
                  {slugs.map((slug) => {
                    const service = bySlug.get(slug);
                    return service ? <DecisionRow key={slug} service={service} /> : null;
                  })}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section aria-labelledby="compare-title" className="py-(--space-section)">
        <div className="container-page">
          <SectionIntro id="compare-title" eyebrow={pageText(locale).service.blockEyebrows.compare} title={t.compareTitle}>
            <p>{t.compareIntro}</p>
          </SectionIntro>
          <div className="mt-(--space-intro-content)">
            <ServiceCompare current={null} />
          </div>
        </div>
      </section>

      <section aria-labelledby="pricing-models-title" className="bg-soft py-(--space-section)">
        <div className="container-page grid-page gap-y-(--space-intro-content)">
          <div className="col-span-4 md:col-span-8 xl:col-span-4">
            <SectionIntro id="pricing-models-title" eyebrow={t.pricingEyebrow} title={t.pricingTitle} titleClassName="max-w-[14ch]">
              <p>{fill(t.pricingIntro, { amount: FREE_DELIVERY_THRESHOLD }, locale)}</p>
            </SectionIntro>
          </div>
          <div className="col-span-4 border-t border-navy md:col-span-8 xl:col-span-7 xl:col-start-6">
            {t.models.map((m, i) => (
              <div key={m.title} className="border-b border-line py-5">
                <h3 className="t-h4 text-navy">{m.title}</h3>
                <p className="mt-1.5 max-w-[56ch] text-secondary">{m.copy}</p>
                <TextLink href={MODEL_LINKS[i]} placement="services_pricing" className="mt-1">
                  {m.label}
                </TextLink>
              </div>
            ))}
          </div>
        </div>
      </section>

      <FAQ title={t.faqTitle} items={faqItems(locale, "unsure", "turnaround", "area", "freeDelivery")} />

      <FinalBookingCTA
        id="book"
        title={t.finalTitle}
        body={<p>{t.finalBody}</p>}
        source="services-page-final"
      />
      <MobileConversionBar finalSectionId="book" source="services-page-sticky" />
    </>
  );
}
