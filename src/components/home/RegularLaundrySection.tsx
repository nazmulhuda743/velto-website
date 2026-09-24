import { ButtonLink, WhatsAppButton } from "@/components/ui/Button";
import { ResponsiveImage } from "@/components/ui/ResponsiveImage";
import { IMAGES, REGULAR_REVIEW } from "@/content/mock";
import { REGULAR_FREE_DELIVERY_THRESHOLD, WHATSAPP_URL, bookHref } from "@/content/site";
import { ReviewBlock } from "./ReviewsSection";
import { SectionIntro } from "./SectionIntro";

export function RegularLaundrySection() {
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
            title="If the laundry comes back every week, make pickup part of the week."
          >
            <p>
              Regular laundry and ironing can be arranged as recurring pickups, so you don&apos;t
              need to book from scratch every time.
            </p>
            <p>
              On a fixed weekly or fortnightly pickup, regular orders of{" "}
              {REGULAR_FREE_DELIVERY_THRESHOLD}+ qualify for free pickup and delivery.
            </p>
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
              Set Up Regular Pickup
            </ButtonLink>
            <WhatsAppButton href={WHATSAPP_URL} placement="regular_laundry" />
          </div>
        </div>
      </div>
    </section>
  );
}
