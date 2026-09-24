import { Suspense, type ReactNode } from "react";
import { ReviewBlock } from "@/components/home/ReviewsSection";
import { SectionIntro } from "@/components/home/SectionIntro";
import { FactRows } from "@/components/pages/FactRows";
import { ProcessSteps } from "@/components/pages/ProcessSteps";
import { ResponsiveImage } from "@/components/ui/ResponsiveImage";
import { TextLink } from "@/components/ui/TextLink";
import type { ServiceBlock } from "@/content/services";
import { SERVICE_AREA } from "@/content/site";
import { getLocations, getSiteContent } from "@/lib/site-content";
import { ServiceCompare } from "./ServiceCompare";
import { ServicePriceTable, ServicePriceTableSkeleton } from "./ServicePriceTable";

type Tone = "white" | "warm" | "soft";
const TONE: Record<Tone, string> = { white: "", warm: "bg-warm", soft: "bg-soft" };

function Section({ id, tone, children }: { id: string; tone: Tone; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className={`py-(--space-section) ${TONE[tone]}`}>
      <div className="container-page grid-page gap-y-(--space-intro-content)">{children}</div>
    </section>
  );
}

const LEFT = "col-span-4 md:col-span-8 xl:col-span-4";
const RIGHT = "col-span-4 md:col-span-8 xl:col-span-7 xl:col-start-6";

/** Renders one typed content block with the shared Velto section rhythm. */
export async function ServiceBlockView({
  block,
  id,
  tone,
  serviceName,
}: {
  block: ServiceBlock;
  id: string;
  tone: Tone;
  serviceName: string;
}) {
  switch (block.type) {
    case "scope":
      return (
        <Section id={id} tone={tone}>
          <div className={LEFT}>
            <SectionIntro id={id} title={block.title} titleClassName="max-w-[16ch]">
              {block.intro ? <p>{block.intro}</p> : null}
            </SectionIntro>
          </div>
          <dl className={`${RIGHT} border-t border-navy md:grid md:grid-cols-2 md:gap-x-10`}>
            {block.groups.map((g) => (
              <div key={g.title} className="border-b border-line py-5">
                <dt className="t-h4 text-navy">{g.title}</dt>
                <dd className="mt-1.5 max-w-[44ch] text-secondary">{g.copy}</dd>
              </div>
            ))}
          </dl>
        </Section>
      );

    case "prices":
      return (
        <Section id={id} tone={tone}>
          <div className={LEFT}>
            <SectionIntro id={id} title={block.title} titleClassName="max-w-[14ch]" className="xl:sticky xl:top-[100px]">
              <p>{block.intro}</p>
            </SectionIntro>
          </div>
          <div className={RIGHT}>
            <Suspense fallback={<ServicePriceTableSkeleton />}>
              <ServicePriceTable
                caption={`${serviceName} prices`}
                columns={block.columns}
                groups={block.groups}
                footer={
                  <>
                    {block.note ? <p className="mt-5 max-w-[60ch] t-small text-secondary">{block.note}</p> : null}
                    <div className="mt-5 flex flex-col gap-1 md:flex-row md:items-center md:justify-between md:gap-6">
                      <TextLink
                        href={block.searchHint ? `/pricing?q=${encodeURIComponent(block.searchHint)}` : "/pricing"}
                        placement="service_prices"
                      >
                        Look up another item
                      </TextLink>
                      <p className="t-caption text-secondary">Prices from Velto&apos;s current price list.</p>
                    </div>
                  </>
                }
              />
            </Suspense>
          </div>
        </Section>
      );

    case "process":
      return (
        <Section id={id} tone={tone}>
          <div className="col-span-4 md:col-span-8 lg:col-span-4 xl:col-span-5">
            <div className="lg:sticky lg:top-[100px]">
              <ResponsiveImage
                image={block.image}
                aspect="aspect-[16/10] lg:aspect-[4/5]"
                sizes="(min-width: 1200px) 500px, (min-width: 1024px) 40vw, 100vw"
              />
            </div>
          </div>
          <div className="col-span-4 md:col-span-8 lg:col-span-4 xl:col-span-6 xl:col-start-7">
            <SectionIntro id={id} title={block.title}>
              <p>{block.intro}</p>
            </SectionIntro>
            <ProcessSteps className="mt-(--space-intro-content)" steps={block.steps} />
            <div className="mt-6">
              <TextLink href="/how-it-works" placement="service_process">
                See how every order is handled
              </TextLink>
            </div>
          </div>
        </Section>
      );

    case "notes":
      return (
        <Section id={id} tone={tone}>
          <div className={LEFT}>
            <SectionIntro id={id} title={block.title} titleClassName="max-w-[14ch]">
              {block.intro ? <p>{block.intro}</p> : null}
            </SectionIntro>
          </div>
          <div className={`${RIGHT} border-t border-navy`}>
            {block.items.map((item) => (
              <div key={item.title} className="border-b border-line py-5 md:grid md:grid-cols-[minmax(0,16rem)_1fr] md:gap-8">
                <h3 className="t-h4 text-navy">{item.title}</h3>
                <p className="mt-2 max-w-[56ch] text-secondary md:mt-0.5">{item.copy}</p>
              </div>
            ))}
          </div>
        </Section>
      );

    case "compare":
      return (
        <Section id={id} tone={tone}>
          <div className="col-span-4 md:col-span-8 xl:col-span-8">
            <SectionIntro id={id} title={block.title}>
              {block.intro ? <p>{block.intro}</p> : null}
            </SectionIntro>
          </div>
          <div className="col-span-4 md:col-span-8 xl:col-span-12">
            <ServiceCompare current={block.current} />
          </div>
        </Section>
      );

    case "measure":
      return (
        <Section id={id} tone={tone}>
          <div className="col-span-4 md:col-span-8 xl:col-span-6">
            <SectionIntro id={id} title={block.title} titleClassName="max-w-[16ch]">
              <p>{block.intro}</p>
            </SectionIntro>
            <ProcessSteps className="mt-(--space-intro-content)" steps={block.steps} />
          </div>
          <div className="col-span-4 md:col-span-8 xl:col-span-5 xl:col-start-8 xl:pt-2">
            <h3 className="t-label uppercase text-navy">Worked example</h3>
            <dl className="mt-4 border-t border-navy">
              {block.examples.map((ex) => (
                <div key={ex.label} className="flex items-baseline justify-between gap-6 border-b border-line py-5">
                  <dt className="text-body">{ex.label}</dt>
                  <dd className="t-h3 whitespace-nowrap tabular-nums text-navy">{ex.value}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-5 max-w-[48ch] t-small text-secondary">{block.note}</p>
          </div>
        </Section>
      );

    case "facts":
      return (
        <Section id={id} tone={tone}>
          <div className={LEFT}>
            <SectionIntro id={id} title={block.title} titleClassName="max-w-[14ch]">
              {block.intro ? <p>{block.intro}</p> : null}
            </SectionIntro>
          </div>
          <div className={RIGHT}>
            <FactRows rows={block.rows} />
            {block.footnote ? <p className="mt-4 t-small text-secondary">{block.footnote}</p> : null}
            {block.steps ? (
              <div className="mt-(--space-related)">
                <h3 className="t-h3 text-navy">{block.steps.title}</h3>
                <ProcessSteps className="mt-6" steps={block.steps.steps} />
              </div>
            ) : null}
          </div>
        </Section>
      );

    case "review": {
      // The dashboard's review list wins; a review removed there disappears here too.
      const review = (await getSiteContent()).reviews.find((r) => r.name === block.review.name);
      if (!review) return null;
      return (
        <Section id={id} tone={tone}>
          <div className={LEFT}>
            <SectionIntro id={id} title={block.title} titleClassName="max-w-[14ch]" />
          </div>
          <div className={`${RIGHT} max-w-[720px]`}>
            <ReviewBlock review={review} />
          </div>
        </Section>
      );
    }

    case "area":
      return (
        <Section id={id} tone={tone}>
          <div className={LEFT}>
            <SectionIntro id={id} title={block.title} titleClassName="max-w-[14ch]">
              <p>
                Pickup and delivery across {SERVICE_AREA}. Outside that area? Ask before booking.
              </p>
            </SectionIntro>
          </div>
          <div className={`${RIGHT} grid gap-y-8 md:grid-cols-2 md:gap-x-10`}>
            {(await getLocations()).map((loc) => (
              <div key={loc.id} className="border-t border-navy pt-4">
                <h3 className="t-h4 text-navy">{loc.name}</h3>
                <address className="mt-2 not-italic text-body">{loc.address}</address>
                <p className="mt-1 t-small text-secondary">{loc.hours}</p>
                <TextLink
                  href={loc.directionsUrl}
                  external
                  className="mt-2"
                  event="directions_click"
                  placement="service_area"
                  branch={loc.id}
                >
                  Get Directions
                </TextLink>
              </div>
            ))}
            <div className="md:col-span-2">
              <TextLink href="/locations" placement="service_area">
                About the two locations
              </TextLink>
            </div>
          </div>
        </Section>
      );
  }
}
