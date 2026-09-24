import { ButtonLink } from "@/components/ui/Button";
import { ResponsiveImage } from "@/components/ui/ResponsiveImage";
import { IMAGES } from "@/content/mock";
import { FREE_DELIVERY_THRESHOLD, SERVICE_AREA, bookHref } from "@/content/site";
import { GoogleProof, ProofList } from "./ProofLine";

export function Hero() {
  return (
    <section id="hero" aria-labelledby="hero-title" className="pb-14 pt-6 md:pb-20 md:pt-14 xl:pb-20 xl:pt-20">
      <div className="container-page grid-page gap-y-7 md:gap-y-0">
        <div className="col-span-4 md:col-span-4 xl:col-span-5 xl:row-start-1">
          <h1 id="hero-title" className="t-display max-w-[520px] text-navy">
            Laundry and dry cleaning in Uttara, with pickup from your door.
          </h1>
          <p className="mt-4 max-w-[520px] t-body text-body md:mt-6 md:t-body-lg xl:mt-7">
            Send everyday laundry, dry cleaning, ironing, curtains, carpets or bedding. Velto
            collects from Uttara Sectors 1–18 and returns your order after it has been received,
            checked, cleaned, finished and packed.
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
          <div className="mt-4 md:mt-6">
            <GoogleProof placement="hero" />
          </div>
        </div>

        <div className="col-span-4 md:col-span-4 md:col-start-5 md:row-span-2 xl:col-span-6 xl:col-start-7 xl:row-start-1">
          <ResponsiveImage
            image={IMAGES.hero}
            aspect="aspect-[4/5] xl:aspect-[5/6]"
            sizes="(min-width: 1200px) 620px, (min-width: 768px) 50vw, 100vw"
            priority
          />
        </div>

        <ProofList
          className="col-span-4 md:col-span-4 md:mt-10 md:self-end xl:col-span-5 xl:row-start-2"
          items={[
            SERVICE_AREA,
            "Dry Cleaning & Wash & Iron usually around 72 hours",
            `Free pickup & delivery on orders of ${FREE_DELIVERY_THRESHOLD}+`,
          ]}
        />
      </div>
    </section>
  );
}
