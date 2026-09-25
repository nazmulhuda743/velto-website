import { pageMetadata } from "@/lib/seo/page-metadata";
import { ProofFigures } from "@/components/pages/ProofFigures";
import { pageFigures } from "@/components/pages/figures";
import { FAQ, faqItems } from "@/components/home/FAQ";
import { FinalBookingCTA } from "@/components/home/FinalBookingCTA";
import { SectionIntro } from "@/components/home/SectionIntro";
import { OperationalProcess } from "@/components/pages/OperationalProcess";
import { PageHero } from "@/components/pages/PageHero";
import { ProcessSteps } from "@/components/pages/ProcessSteps";
import { ButtonLink, WhatsAppButton } from "@/components/ui/Button";
import { FREE_DELIVERY_THRESHOLD, WHATSAPP_URL, bookHref } from "@/content/site";
import { IMAGES } from "@/content/mock";
import { dictionary } from "@/content/i18n";
import { pageText } from "@/content/i18n/pages";
import { fill } from "@/lib/i18n/config";
import { getLocale } from "@/lib/i18n/server";

export const generateMetadata = () => pageMetadata("/how-it-works");

export default async function HowItWorksPage() {
  const locale = await getLocale();
  const d = dictionary(locale);
  const t = pageText(locale).howPage;
  const fig = await pageFigures();
  return (
    <>
      <PageHero
        path={"/how-it-works"}
        image={IMAGES.hero}
        crumbs={[{ label: d.common.home, href: "/" }, { label: d.nav.howItWorks }]}
        title={t.title}
        eyebrow={t.eyebrow}
        highlight={t.highlight}
        aside={<ProofFigures wide={3} figures={[fig.sectors, fig.turnaround, fig.freeDelivery]} />}
        actions={
          <>
            <ButtonLink
              href={bookHref("how-it-works-page")}
              event="book_pickup_click"
              placement="how_hero"
              className="flex-[1.45] max-md:px-4 md:flex-none"
            >
              {d.common.bookPickup}
            </ButtonLink>
            <WhatsAppButton href={WHATSAPP_URL} placement="how_hero" className="flex-1 max-md:px-3 md:flex-none">
              {d.common.whatsapp}
            </WhatsAppButton>
          </>
        }
      >
        <p>{t.intro}</p>
      </PageHero>

      <section aria-labelledby="booking-steps-title" className="bg-warm py-(--space-section)">
        <div className="container-page grid-page gap-y-10">
          <div className="col-span-4 md:col-span-8 xl:col-span-5">
            <SectionIntro id="booking-steps-title" eyebrow={t.yourSideEyebrow} title={t.yourSideTitle}>
              <p>{fill(t.yourSideIntro, { amount: FREE_DELIVERY_THRESHOLD }, locale)}</p>
            </SectionIntro>
          </div>
          <div className="col-span-4 md:col-span-8 xl:col-span-6 xl:col-start-7">
            <ProcessSteps steps={t.steps} />
          </div>
        </div>
      </section>

      <OperationalProcess
        title={t.processTitle}
        intro={<p>{t.processIntro}</p>}
      />

      <FAQ items={faqItems(locale, "turnaround", "area", "freeDelivery", "stains", "express")} className="bg-soft" />

      <FinalBookingCTA id="book" source="how-it-works-final" />
    </>
  );
}
