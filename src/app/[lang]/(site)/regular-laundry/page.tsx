import { pageMetadata } from "@/lib/seo/page-metadata";
import { FAQ, faqItems } from "@/components/home/FAQ";
import { FinalBookingCTA } from "@/components/home/FinalBookingCTA";
import { GoogleProof } from "@/components/home/ProofLine";
import { Eyebrow, SectionIntro } from "@/components/home/SectionIntro";
import { ReviewCarousel } from "@/components/reviews/ReviewCarousel";
import { getServiceReviews } from "@/lib/reviews";
import { PageHero } from "@/components/pages/PageHero";
import { ProcessSteps } from "@/components/pages/ProcessSteps";
import { ButtonLink, WhatsAppButton } from "@/components/ui/Button";
import { TextLink } from "@/components/ui/TextLink";
import { IMAGES } from "@/content/mock";
import { FREE_DELIVERY_THRESHOLD, REGULAR_FREE_DELIVERY_THRESHOLD, WHATSAPP_URL, bookHref } from "@/content/site";
import { dictionary } from "@/content/i18n";
import { pageText } from "@/content/i18n/pages";
import { fill, localDigits, type Locale } from "@/lib/i18n/config";
import { getLocale } from "@/lib/i18n/server";

export const generateMetadata = () => pageMetadata("/regular-laundry");

const setUpHref = (source: string) => bookHref(source, "regular-laundry");

/** Reviews from customers who come back week after week, moving like the homepage strip. */
async function RegularReviews({ locale }: { locale: Locale }) {
  const t = pageText(locale);
  const { reviews, specific } = await getServiceReviews("regular-laundry");
  if (!reviews.length) return null;
  return (
    <section aria-labelledby="regular-reviews-title" className="bg-warm py-(--space-section)">
      <div className="container-page flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <Eyebrow>{t.service.customerProof}</Eyebrow>
          <h2 id="regular-reviews-title" className="t-h2 max-w-[20ch] text-navy">
            {specific ? t.regularPage.reviewsSpecific : t.service.reviewsGeneral}
          </h2>
        </div>
        <GoogleProof placement="regular_reviews" />
      </div>
      <div className="mt-(--space-intro-content)">
        <ReviewCarousel reviews={reviews} label={t.service.reviewsLabel} />
      </div>
    </section>
  );
}

export default async function RegularLaundryPage() {
  const locale = await getLocale();
  const d = dictionary(locale);
  const t = pageText(locale).regularPage;
  const f = (template: string, amount: string) => fill(template, { amount }, locale);
  return (
    <>
      <PageHero
        path={"/regular-laundry"}
        crumbs={[{ label: d.common.home, href: "/" }, { label: d.nav.regularLaundry }]}
        title={t.title}
        eyebrow={t.eyebrow}
        highlight={t.highlight}
        image={IMAGES.regular}
        aside={
          // The one reason to choose a routine over one-off orders, stated where the decision is made.
          <div className="border-t border-line pt-4">
            <p className="text-[28px] font-semibold leading-none tracking-[-0.03em] text-navy tabular-nums md:text-[32px]">
              {localDigits(`${REGULAR_FREE_DELIVERY_THRESHOLD}+`, locale)}
            </p>
            <p className="mt-1.5 max-w-[34ch] t-small text-secondary">{f(t.asideBody, FREE_DELIVERY_THRESHOLD)}</p>
          </div>
        }
        actions={
          <>
            <ButtonLink
              href={setUpHref("regular-laundry-page")}
              event="regular_laundry_interest"
              placement="regular_hero"
              className="flex-[1.45] max-md:px-4 md:flex-none"
            >
              {t.setUp}
            </ButtonLink>
            <WhatsAppButton href={WHATSAPP_URL} placement="regular_hero" className="flex-1 max-md:px-3 md:flex-none">
              {/* Icon only below 375px so the longer primary label keeps its room. */}
              <span className="max-[374px]:sr-only">{d.common.whatsapp}</span>
            </WhatsAppButton>
          </>
        }
      >
        <p>{t.intro}</p>
      </PageHero>

      <section aria-labelledby="regular-how-title" className="bg-warm py-(--space-section)">
        <div className="container-page grid-page gap-y-10">
          <div className="col-span-4 md:col-span-8 xl:col-span-5">
            <SectionIntro id="regular-how-title" eyebrow={t.howEyebrow} title={t.howTitle}>
              {/* TODO_VERIFY: recurring pickup rules beyond confirmed availability (spec §36). */}
              <p>{t.howIntro}</p>
            </SectionIntro>
          </div>
          <div className="col-span-4 md:col-span-8 xl:col-span-6 xl:col-start-7">
            <ProcessSteps steps={t.steps} />
          </div>
        </div>
      </section>

      <section aria-labelledby="regular-save-title" className="py-(--space-section)">
        <div className="container-page grid-page gap-y-8">
          <div className="col-span-4 md:col-span-8 xl:col-span-5">
            <SectionIntro id="regular-save-title" eyebrow={t.saveEyebrow} title={t.saveTitle}>
              <p>{f(t.saveIntro, REGULAR_FREE_DELIVERY_THRESHOLD)}</p>
            </SectionIntro>
          </div>
          <div className="col-span-4 flex flex-col gap-4 md:col-span-8 xl:col-span-6 xl:col-start-7 xl:justify-center">
            <TextLink href="/services/wash-and-iron" placement="regular_services">
              {d.serviceNames["wash-and-iron"]}
            </TextLink>
            <TextLink href="/services/ironing" placement="regular_services">
              {d.serviceNames.ironing}
            </TextLink>
            <TextLink href="/pricing" placement="regular_services">
              {t.checkPrices}
            </TextLink>
          </div>
        </div>
      </section>

      <RegularReviews locale={locale} />

      <FAQ items={faqItems(locale, "turnaround", "freeDelivery", "area")} className="bg-soft" />

      <FinalBookingCTA
        id="book"
        title={t.finalTitle}
        body={<p>{t.finalBody}</p>}
        source="regular-laundry-final"
        primary={{
          href: setUpHref("regular-laundry-final"),
          label: t.setUp,
          helper: t.finalHelper,
          event: "regular_laundry_interest",
        }}
      />
    </>
  );
}
