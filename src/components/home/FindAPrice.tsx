import { ButtonLink } from "@/components/ui/Button";
import { FREE_DELIVERY_THRESHOLD, bookHref } from "@/content/site";
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
      <div className="container-page grid-page gap-y-12">
        <div className="col-span-4 md:col-span-8 xl:col-span-7">
          <SectionIntro id="price-title" eyebrow={t.eyebrow} title={t.title}>
            <p>{t.intro}</p>
          </SectionIntro>
          <div className="mt-(--space-intro-content)">
            <PriceFinder />
          </div>
        </div>

        <div className="col-span-4 md:col-span-8 xl:col-span-4 xl:col-start-9 xl:pt-2">
          <div className="md:grid md:grid-cols-2 md:gap-5 xl:block">
            <div>
              <dl className="border-t border-navy">
                {t.turnaround.map((row) => (
                  <div key={row.label} className="border-b border-line py-4">
                    <dt className="t-label uppercase text-navy">{row.label}</dt>
                    <dd className="mt-1 text-body">{row.value}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-4 t-small text-secondary">{t.mayTakeLonger}</p>
            </div>

            <div className="mt-10 md:mt-0 xl:mt-10">
              <p className="border-t border-navy pt-4 t-h4 text-navy [text-wrap:balance]">
                {fill(t.free, { amount: FREE_DELIVERY_THRESHOLD }, locale)}
              </p>
              <p className="mt-3 t-small text-secondary">{t.smallerOrders}</p>
            </div>
          </div>

          <div className="mt-10 flex flex-col gap-3 md:flex-row xl:flex-col 2xl:flex-row">
            <ButtonLink href={bookHref("home_pricing")} event="book_pickup_click" placement="pricing">
              {d.common.bookPickup}
            </ButtonLink>
            <ButtonLink href="/pricing" variant="secondary">
              {t.viewPricing}
            </ButtonLink>
          </div>
        </div>
      </div>
    </section>
  );
}
