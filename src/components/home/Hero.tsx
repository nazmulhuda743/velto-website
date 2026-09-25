import { T } from "@/components/i18n/T";
import { ButtonLink } from "@/components/ui/Button";
import { ProofFigures, RatingValue } from "@/components/pages/ProofFigures";
import { ResponsiveImage } from "@/components/ui/ResponsiveImage";
import { IMAGES } from "@/content/mock";
import { FREE_DELIVERY_THRESHOLD, SERVICE_SECTORS, USUAL_TURNAROUND_HOURS, bookHref } from "@/content/site";
import { dictionary } from "@/content/i18n";
import { fill, localDigits } from "@/lib/i18n/config";
import { getLocale } from "@/lib/i18n/server";
import { getGoogleProof } from "@/lib/site-content";

/**
 * Hero proof as four scannable figures. Every value comes from site config;
 * the rating is the Sector 11 profile only (§21) and falls back to the
 * review count alone if live data is missing.
 */
async function HeroFigures() {
  const google = await getGoogleProof();
  const locale = await getLocale();
  const t = dictionary(locale).home.hero;
  return (
    <ProofFigures
      figures={[
        {
          value: google.live ? <RatingValue rating={localDigits(google.rating, locale)} /> : localDigits("100+", locale),
          spoken: google.live ? fill(t.ratingSpoken, { rating: google.rating }, locale) : localDigits("100+", locale),
          label: google.live ? fill(t.ratingLabel, { reviews: google.reviews }, locale) : t.reviewsLabel,
          href: google.location.reviewsUrl,
          analytics: { event: "google_reviews_click", placement: "hero", branch: google.location.id },
        },
        { value: localDigits(SERVICE_SECTORS, locale), spoken: t.sectorsSpoken, label: t.sectorsLabel },
        {
          value: fill(t.turnaroundValue, { hours: USUAL_TURNAROUND_HOURS }, locale),
          spoken: fill(t.turnaroundSpoken, { hours: USUAL_TURNAROUND_HOURS }, locale),
          label: t.turnaroundLabel,
        },
        {
          value: localDigits(`${FREE_DELIVERY_THRESHOLD}+`, locale),
          spoken: fill(t.freeSpoken, { amount: FREE_DELIVERY_THRESHOLD }, locale),
          label: t.freeLabel,
        },
      ]}
    />
  );
}

export async function Hero() {
  const t = dictionary(await getLocale()).home.hero;
  return (
    <section id="hero" aria-labelledby="hero-title" className="pb-14 pt-6 md:pb-20 md:pt-14 xl:pb-20 xl:pt-20">
      <div className="container-page grid-page gap-y-8 md:gap-y-0">
        <div className="col-span-4 md:col-span-4 xl:col-span-6 xl:self-center">
          <h1 id="hero-title" className="t-display max-w-[600px] text-navy">
            {t.titleBefore}
            <span className="text-blue">{t.titleHighlight}</span>
            {t.titleAfter}
          </h1>
          <p className="mt-4 max-w-[520px] t-body text-body md:mt-6 md:t-body-lg xl:mt-7">
            {t.bodyBefore}
            <span className="whitespace-nowrap">{t.bodySectors}</span>
            {t.bodyAfter}
          </p>
          <div className="mt-6 flex gap-2.5 md:mt-8 md:flex-wrap md:gap-3 xl:mt-10">
            <ButtonLink
              href={bookHref("home_hero")}
              event="book_pickup_click"
              placement="hero"
              className="flex-[1.45] max-md:px-4 md:flex-none"
            >
              <T k="common.bookPickup" />
            </ButtonLink>
            <ButtonLink href="#find-a-price" variant="secondary" className="flex-1 max-md:px-4 md:flex-none">
              {t.findPrice}
            </ButtonLink>
          </div>
          <div className="mt-8 max-w-[600px] md:mt-10 xl:mt-12">
            <HeroFigures />
          </div>
        </div>

        <div className="col-span-4 md:col-span-4 md:col-start-5 xl:col-span-6 xl:col-start-7">
          <ResponsiveImage
            image={IMAGES.hero}
            aspect="aspect-[4/5] xl:aspect-[5/6]"
            sizes="(min-width: 1200px) 620px, (min-width: 768px) 50vw, 100vw"
            priority
          />
        </div>
      </div>
    </section>
  );
}
