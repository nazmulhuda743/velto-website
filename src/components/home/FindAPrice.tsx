import { ButtonLink } from "@/components/ui/Button";
import { FREE_DELIVERY_THRESHOLD, bookHref } from "@/content/site";
import { PriceFinder } from "./PriceFinder";
import { SectionIntro } from "./SectionIntro";

const TURNAROUND = [
  { label: "General orders", value: "Usually around 48 hours" },
  { label: "Wash & Iron", value: "Usually around 72 hours" },
  { label: "Dry Cleaning", value: "Usually around 72 hours" },
];

export function FindAPrice() {
  return (
    <section id="find-a-price" aria-labelledby="price-title" className="bg-soft py-(--space-section)">
      <div className="container-page grid-page gap-y-12">
        <div className="col-span-4 md:col-span-8 xl:col-span-7">
          <SectionIntro id="price-title" eyebrow="Pricing" title="Check the price before you send it.">
            <p>
              Search for an item such as a shirt, blazer or saree to see the services available and
              the current Velto price.
            </p>
          </SectionIntro>
          <div className="mt-(--space-intro-content)">
            <PriceFinder />
          </div>
        </div>

        <div className="col-span-4 md:col-span-8 xl:col-span-4 xl:col-start-9 xl:pt-2">
          <div className="md:grid md:grid-cols-2 md:gap-5 xl:block">
            <div>
              <dl className="border-t border-navy">
                {TURNAROUND.map((row) => (
                  <div key={row.label} className="border-b border-line py-4">
                    <dt className="t-label uppercase text-navy">{row.label}</dt>
                    <dd className="mt-1 text-body">{row.value}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-4 t-small text-secondary">
                Some garments and household items may take longer.
              </p>
            </div>

            <div className="mt-10 md:mt-0 xl:mt-10">
              <p className="border-t border-navy pt-4 t-h4 text-navy [text-wrap:balance]">
                Free pickup &amp; delivery on orders of {FREE_DELIVERY_THRESHOLD}+.
              </p>
              <p className="mt-3 t-small text-secondary">
                For smaller orders, the applicable pickup and delivery charge will be shown before
                booking.
              </p>
            </div>
          </div>

          <div className="mt-10 flex flex-col gap-3 md:flex-row xl:flex-col 2xl:flex-row">
            <ButtonLink href={bookHref("home_pricing")} event="book_pickup_click" placement="pricing">
              Book a Pickup
            </ButtonLink>
            <ButtonLink href="/pricing" variant="secondary">
              View Full Pricing
            </ButtonLink>
          </div>
        </div>
      </div>
    </section>
  );
}
