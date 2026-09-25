import { pageMetadata } from "@/lib/seo/page-metadata";
import { FAQ, faqItems } from "@/components/home/FAQ";
import { FinalBookingCTA } from "@/components/home/FinalBookingCTA";
import { PriceFinder } from "@/components/home/PriceFinder";
import { Eyebrow, SectionIntro } from "@/components/home/SectionIntro";
import { Breadcrumbs } from "@/components/pages/Breadcrumbs";
import { JsonLd } from "@/components/seo/JsonLd";
import { buildBreadcrumbSchema } from "@/lib/seo/schema";
import { FactRows } from "@/components/pages/FactRows";
import { ServiceCompare } from "@/components/services/ServiceCompare";
import { TextLink } from "@/components/ui/TextLink";
import { ButtonLink } from "@/components/ui/Button";
import { FREE_DELIVERY_THRESHOLD, bookHref } from "@/content/site";

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
          <JsonLd data={buildBreadcrumbSchema([{ label: "Home", path: "/" }, { label: "Pricing", path: "/pricing" }])} />
          <div className="mt-6 grid-page gap-y-12 md:mt-8">
            <div className="col-span-4 md:col-span-8 xl:col-span-7">
              <Eyebrow>Pricing</Eyebrow>
              <h1 id="page-title" className="t-h1 max-w-[18ch] text-navy">
                Find the <span className="text-blue">price</span> of an item.
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
                For smaller orders, a pickup and delivery charge applies. We tell you the amount when
                we confirm your pickup.
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
              {/* The step after checking a price: on mobile this lands right after the search, not at the page end. */}
              <div className="mt-8 border-t border-line pt-6">
                <p className="font-semibold text-navy">Know what you&apos;re sending?</p>
                <p className="mt-1 t-small text-secondary">
                  Book the pickup now. We call or WhatsApp to confirm the time, and can go through prices then.
                </p>
                <ButtonLink href={bookHref("pricing-aside")} event="book_pickup_click" placement="pricing_aside" className="mt-4 max-md:w-full">
                  Book a Pickup
                </ButtonLink>
              </div>
            </aside>
          </div>
        </div>
      </section>

      <section aria-labelledby="compare-title" className="py-(--space-section)">
        <div className="container-page">
          <div className="max-w-[640px]">
            <SectionIntro id="compare-title" eyebrow="Choosing a service" title="Dry Cleaning, Wash & Iron or Ironing?">
              <p>
                Many items have a price for more than one service. This is what each one covers, so
                you can pick the right one.
              </p>
            </SectionIntro>
          </div>
          <div className="mt-(--space-intro-content)">
            <ServiceCompare current={null} />
          </div>
        </div>
      </section>

      <section aria-labelledby="household-pricing-title" className="bg-warm py-(--space-section)">
        <div className="container-page grid-page gap-y-10">
          <div className="col-span-4 md:col-span-8 xl:col-span-5">
            <SectionIntro id="household-pricing-title" eyebrow="Household care" title="Curtains, carpets and bedding are priced differently.">
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

      <FAQ title="Pricing questions." items={faqItems("freeDelivery", "express", "household", "unsure")} />

      <FinalBookingCTA
        id="book"
        title="Found what you need?"
        body={<p>Book a pickup and we will collect from your door in Uttara Sectors 1–18.</p>}
        source="pricing-page-final"
      />
    </>
  );
}
