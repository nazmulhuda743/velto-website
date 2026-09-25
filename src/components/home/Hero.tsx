import { ButtonLink } from "@/components/ui/Button";
import { ProofFigures, RatingValue } from "@/components/pages/ProofFigures";
import { ResponsiveImage } from "@/components/ui/ResponsiveImage";
import { IMAGES } from "@/content/mock";
import { FREE_DELIVERY_THRESHOLD, SERVICE_SECTORS, USUAL_TURNAROUND_HOURS, bookHref } from "@/content/site";
import { getGoogleProof } from "@/lib/site-content";

/**
 * Hero proof as four scannable figures. Every value comes from site config;
 * the rating is the Sector 11 profile only (§21) and falls back to the
 * review count alone if live data is missing.
 */
async function HeroFigures() {
  const google = await getGoogleProof();
  return (
    <ProofFigures
      figures={[
        {
          value: google.live ? <RatingValue rating={google.rating} /> : "100+",
          spoken: google.live ? `${google.rating} out of 5` : "100+",
          label: google.live ? `Google rating, ${google.reviews} reviews` : "Google reviews",
          href: google.location.reviewsUrl,
          analytics: { event: "google_reviews_click", placement: "hero", branch: google.location.id },
        },
        { value: SERVICE_SECTORS, spoken: "Sectors 1 to 18", label: "Uttara sectors we collect from" },
        {
          value: `~${USUAL_TURNAROUND_HOURS}h`,
          spoken: `Usually around ${USUAL_TURNAROUND_HOURS} hours`,
          label: "Usual time for Dry Cleaning and Wash & Iron",
        },
        { value: `${FREE_DELIVERY_THRESHOLD}+`, spoken: `Orders of ${FREE_DELIVERY_THRESHOLD} or more`, label: "Free pickup & delivery" },
      ]}
    />
  );
}

export function Hero() {
  return (
    <section id="hero" aria-labelledby="hero-title" className="pb-14 pt-6 md:pb-20 md:pt-14 xl:pb-20 xl:pt-20">
      <div className="container-page grid-page gap-y-8 md:gap-y-0">
        <div className="col-span-4 md:col-span-4 xl:col-span-6 xl:self-center">
          <h1 id="hero-title" className="t-display max-w-[600px] text-navy">
            Laundry and dry cleaning in Uttara, with <span className="text-blue">pickup from your door</span>.
          </h1>
          <p className="mt-4 max-w-[520px] t-body text-body md:mt-6 md:t-body-lg xl:mt-7">
            Send everyday laundry, dry cleaning, ironing, curtains, carpets or bedding. We collect
            across Uttara Sectors <span className="whitespace-nowrap">1–18</span> and bring it back
            when it&apos;s ready.
          </p>
          <div className="mt-6 flex gap-2.5 md:mt-8 md:flex-wrap md:gap-3 xl:mt-10">
            <ButtonLink
              href={bookHref("home_hero")}
              event="book_pickup_click"
              placement="hero"
              className="flex-[1.45] max-md:px-4 md:flex-none"
            >
              Book a Pickup
            </ButtonLink>
            <ButtonLink href="#find-a-price" variant="secondary" className="flex-1 max-md:px-4 md:flex-none">
              Find a Price
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
