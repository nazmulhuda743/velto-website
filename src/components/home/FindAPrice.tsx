import { ButtonLink } from "@/components/ui/Button";
import { FREE_DELIVERY_THRESHOLD, bookHref } from "@/content/site";
import { PopularPrices } from "./PopularPrices";
import { PriceFinder } from "./PriceFinder";
import { dictionary } from "@/content/i18n";
import { fill } from "@/lib/i18n/config";
import { getLocale } from "@/lib/i18n/server";
import { SectionIntro } from "./SectionIntro";

export async function FindAPrice() {
  const locale = await getLocale();
  const d = dictionary(locale);
  const t = d.home.findPrice;
  return (
    <section id="find-a-price" aria-labelledby="price-title" className="bg-soft py-(--space-section)">
      <div className="container-page grid-page gap-y-10">
        <div className="col-span-4 md:col-span-8 xl:col-span-7">
          <SectionIntro id="price-title" title={t.title}>
            <p>{t.intro}</p>
          </SectionIntro>
          <div className="mt-(--space-intro-content) space-y-10">
            {/* The everyday prices first, without typing; then the search for everything else. */}
            <PopularPrices />
            {/* Each priced service can be booked straight from the result, like on /pricing. */}
            <PriceFinder bookFromResult={{ source: "home_pricing" }} />
          </div>
        </div>

        <div className="col-span-4 md:col-span-8 xl:col-span-4 xl:col-start-9 xl:pt-2">
          {/* Turnaround is stated once on the homepage, in the hero figures; /pricing carries the full table. */}
          <p className="border-t border-navy pt-4 t-h4 text-navy [text-wrap:balance]">
            {fill(t.free, { amount: FREE_DELIVERY_THRESHOLD }, locale)}
          </p>
          <p className="mt-3 max-w-[48ch] t-small text-secondary">{t.smallerOrders}</p>

          <div className="mt-6 flex flex-wrap gap-2.5 md:mt-8 md:gap-3 xl:flex-col 2xl:flex-row">
            <ButtonLink
              href={bookHref("home_pricing")}
              event="book_pickup_click"
              placement="pricing"
              className="flex-auto max-md:px-4 md:flex-none"
            >
              {d.common.bookPickup}
            </ButtonLink>
            <ButtonLink href="/pricing" variant="secondary" className="flex-auto max-md:px-4 md:flex-none">
              {t.viewPricing}
            </ButtonLink>
          </div>
        </div>
      </div>
    </section>
  );
}
