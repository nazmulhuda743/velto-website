import { pageMetadata } from "@/lib/seo/page-metadata";
import { FAQ, faqItems } from "@/components/home/FAQ";
import { FinalBookingCTA } from "@/components/home/FinalBookingCTA";
import { PriceFinder } from "@/components/home/PriceFinder";
import { SectionIntro } from "@/components/home/SectionIntro";
import { Breadcrumbs } from "@/components/pages/Breadcrumbs";
import { FactRows } from "@/components/pages/FactRows";
import { TextLink } from "@/components/ui/TextLink";
import { FREE_DELIVERY_THRESHOLD } from "@/content/site";

export const generateMetadata = () => pageMetadata("/pricing");

/**
 * Pricing page. The only price data shown comes through PriceFinder → /api/prices,
 * which the Codex pricing adapter replaces. No prices are hardcoded here.
 */
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const HOUSEHOLD = [
  {
    label: "Curtains",
    copy: "Quantity and approximate size. We confirm the final amount when measurement or condition needs checking.",
    service: "curtain-cleaning",
    action: "Get a curtain quote",
  },
  {
    label: "Carpets",
    copy: "Approximate length and width. Material and condition can change the final price.",
    service: "carpet-cleaning",
    action: "Get a carpet quote",
  },
  {
    label: "Blankets & comforters",
    copy: "Mainly the item, type and size.",
    service: "blanket-comforter-cleaning",
    action: "Get a bedding quote",
  },
];

export default async function PricingPage({ searchParams }: { searchParams: SearchParams }) {
  const q = (await searchParams).q;
  const initialQuery = (Array.isArray(q) ? q[0] : q) ?? "";
  return (
    <>
      <section aria-labelledby="page-title" className="bg-soft pb-(--space-section) pt-6 md:pt-10 xl:pt-12">
        <div className="container-page">
          <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Pricing" }]} />
          <div className="mt-6 grid-page gap-y-12 md:mt-8">
            <div className="col-span-4 md:col-span-8 xl:col-span-7">
              <h1 id="page-title" className="t-h1 max-w-[18ch] text-navy">
                Find the price of an item.
              </h1>
              <div className="mt-5 max-w-[560px] space-y-4 t-body text-body md:mt-6 md:t-body-lg">
                <p>
                  Prices are set per item and service. Search for what you want to send to see the
                  services available and the current Velto price.
                </p>
              </div>
              <div className="mt-(--space-intro-content)">
                <PriceFinder initialQuery={initialQuery} syncUrl bookFromResult={{ source: "pricing-result" }} />
              </div>
            </div>
            <aside aria-label="Delivery and turnaround" className="col-span-4 md:col-span-8 xl:col-span-4 xl:col-start-9 xl:pt-2">
              <p className="border-t border-navy pt-4 t-h4 text-navy [text-wrap:balance]">
                Free pickup &amp; delivery on orders of {FREE_DELIVERY_THRESHOLD}+.
              </p>
              <p className="mt-3 t-small text-secondary">
                For smaller orders, the applicable pickup and delivery charge will be shown before
                booking.
              </p>
              <FactRows
                className="mt-10"
                rows={[
                  { label: "General orders", value: "Usually around 48 hours" },
                  { label: "Wash & Iron", value: "Usually around 72 hours" },
                  { label: "Dry Cleaning", value: "Usually around 72 hours" },
                ]}
              />
              <p className="mt-4 t-small text-secondary">Some garments and household items may take longer.</p>
            </aside>
          </div>
        </div>
      </section>

      <section aria-labelledby="household-pricing-title" className="py-(--space-section)">
        <div className="container-page grid-page gap-y-10">
          <div className="col-span-4 md:col-span-8 xl:col-span-5">
            <SectionIntro id="household-pricing-title" title="Curtains, carpets and bedding are priced differently.">
              <p>
                These depend on size, material and condition, so they are not always a single item
                price.
              </p>
            </SectionIntro>
          </div>
          <div className="col-span-4 md:col-span-8 xl:col-span-6 xl:col-start-7">
            <ul className="border-t border-navy">
              {HOUSEHOLD.map((row) => (
                <li key={row.service} className="border-b border-line py-4">
                  <h3 className="t-label uppercase text-navy">{row.label}</h3>
                  <p className="mt-1 text-body">{row.copy}</p>
                  <div className="mt-1">
                    <TextLink href={`/quote?service=${row.service}&source=pricing-page`} placement="pricing_household">
                      {row.action}
                    </TextLink>
                  </div>
                </li>
              ))}
            </ul>
            <div className="mt-6">
              <TextLink href="/services" placement="pricing_services">
                See all services
              </TextLink>
            </div>
          </div>
        </div>
      </section>

      <FAQ title="Pricing questions." items={faqItems("freeDelivery", "express", "household", "unsure")} className="bg-warm" />

      <FinalBookingCTA
        id="book"
        title="Found what you need?"
        body={<p>Book a pickup and we will collect from your door in Uttara Sectors 1–18.</p>}
        source="pricing-page-final"
      />
    </>
  );
}
