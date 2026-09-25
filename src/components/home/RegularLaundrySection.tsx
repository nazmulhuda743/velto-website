import { ButtonLink, WhatsAppButton } from "@/components/ui/Button";
import { ResponsiveImage } from "@/components/ui/ResponsiveImage";
import { TextLink } from "@/components/ui/TextLink";
import { IMAGES, REGULAR_REVIEW } from "@/content/mock";
import { REGULAR_FREE_DELIVERY_THRESHOLD, WHATSAPP_URL, bookHref } from "@/content/site";
import { ReviewBlock } from "./ReviewsSection";
import { dictionary } from "@/content/i18n";
import { fill } from "@/lib/i18n/config";
import { getLocale } from "@/lib/i18n/server";
import { SectionIntro } from "./SectionIntro";

export async function RegularLaundrySection() {
  const locale = await getLocale();
  const t = dictionary(locale).home.regular;
  return (
    <section id="regular-laundry" aria-labelledby="regular-title" className="bg-soft py-(--space-section)">
      <div className="container-page grid-page gap-y-10">
        <div className="col-span-4 md:col-span-4 xl:col-span-6">
          <ResponsiveImage
            image={IMAGES.regular}
            aspect="aspect-[4/3] md:aspect-[4/5] xl:aspect-[4/3]"
            sizes="(min-width: 1200px) 610px, (min-width: 768px) 50vw, 100vw"
          />
        </div>
        <div className="col-span-4 md:col-span-4 md:self-center xl:col-span-5 xl:col-start-8">
          <SectionIntro
            id="regular-title"
            eyebrow={t.eyebrow}
            title={t.title}
          >
            <p>{t.intro1}</p>
            <p>{fill(t.intro2, { amount: REGULAR_FREE_DELIVERY_THRESHOLD }, locale)}</p>
          </SectionIntro>

          {REGULAR_REVIEW ? (
            <div className="mt-(--space-group)">
              <ReviewBlock review={REGULAR_REVIEW} />
            </div>
          ) : null}

          <div className="mt-(--space-group) flex flex-col gap-3 md:flex-row md:flex-wrap">
            <ButtonLink
              href={bookHref("home_regular", "regular-laundry")}
              event="regular_laundry_interest"
              placement="regular_laundry"
            >
              {t.setUp}
            </ButtonLink>
            <WhatsAppButton href={WHATSAPP_URL} placement="regular_laundry" />
          </div>
          <div className="mt-5">
            <TextLink href="/regular-laundry" placement="regular_laundry">
              {t.howItWorks}
            </TextLink>
          </div>
        </div>
      </div>
    </section>
  );
}
