import { FAQ, faqItems } from "@/components/home/FAQ";
import { FinalBookingCTA } from "@/components/home/FinalBookingCTA";
import { ProofList } from "@/components/home/ProofLine";
import { SectionIntro } from "@/components/home/SectionIntro";
import { MobileConversionBar } from "@/components/layout/MobileConversionBar";
import { ButtonLink, WhatsAppButton } from "@/components/ui/Button";
import { ResponsiveImage } from "@/components/ui/ResponsiveImage";
import { TextLink } from "@/components/ui/TextLink";
import type { ServiceContent } from "@/content/services";
import { FREE_DELIVERY_THRESHOLD, SERVICE_AREA, WHATSAPP_URL, bookHref } from "@/content/site";
import { BulletList } from "./BulletList";
import { PageHero } from "./PageHero";
import { ProcessSteps } from "./ProcessSteps";

const FINAL_ID = "book";

export const quoteHref = (service: string, source: string) =>
  `/quote?${new URLSearchParams({ service, source }).toString()}`;

/** Service page template (spec §33 step 1): homepage system, one primary conversion. */
export function ServicePageView({ service }: { service: ServiceContent }) {
  const source = `${service.slug}-page`;
  const isQuote = service.primary === "quote";

  const primary = isQuote ? (
    <ButtonLink href={quoteHref(service.slug, source)} className="flex-[1.45] max-md:px-4 md:flex-none">
      Request a Quote
    </ButtonLink>
  ) : (
    <ButtonLink
      href={bookHref(source, service.slug)}
      event="book_pickup_click"
      placement="service_hero"
      className="flex-[1.45] max-md:px-4 md:flex-none"
    >
      Book a Pickup
    </ButtonLink>
  );

  return (
    <>
      <PageHero
        crumbs={[{ label: "Home", href: "/" }, { label: "Services", href: "/services" }, { label: service.name }]}
        title={service.h1}
        image={service.image}
        actions={
          <>
            {primary}
            <WhatsAppButton href={WHATSAPP_URL} placement="service_hero" className="flex-1 max-md:px-3 md:flex-none">
              WhatsApp
            </WhatsAppButton>
          </>
        }
        aside={
          <ProofList
            items={[
              service.turnaround,
              `Pickup across ${SERVICE_AREA}`,
              `Free pickup & delivery on orders of ${FREE_DELIVERY_THRESHOLD}+`,
            ]}
          />
        }
      >
        {service.intro.map((p) => (
          <p key={p}>{p}</p>
        ))}
      </PageHero>

      {/* What we handle / what to tell us + good to know */}
      <section aria-labelledby="details-title" className="bg-warm py-(--space-section)">
        <div className="container-page grid-page gap-y-12">
          <div className="col-span-4 md:col-span-8 xl:col-span-5">
            <SectionIntro
              id="details-title"
              title={service.kind === "household" && service.quoteDetails ? "What to tell us" : service.handles.title}
              titleClassName="max-w-[18ch]"
            />
            <BulletList className="mt-(--space-group)" items={service.quoteDetails ?? service.handles.items} />
            {isQuote ? (
              <div className="mt-8">
                <ButtonLink href={quoteHref(service.slug, `${source}-details`)} variant="secondary">
                  Request a Quote
                </ButtonLink>
              </div>
            ) : null}
          </div>
          <div className="col-span-4 md:col-span-8 xl:col-span-6 xl:col-start-7">
            <h2 className="t-label uppercase text-navy">Good to know</h2>
            <div className="mt-4 border-t border-navy">
              {service.goodToKnow.map((item) => (
                <div key={item.title} className="border-b border-line py-5">
                  <h3 className="t-h4 text-navy">{item.title}</h3>
                  <p className="mt-2 max-w-[56ch] text-secondary">{item.copy}</p>
                </div>
              ))}
            </div>
            {service.kind === "garment" ? (
              <div className="mt-6">
                <TextLink href="/pricing" placement="service_pricing">
                  Check the price of an item
                </TextLink>
              </div>
            ) : null}
          </div>
        </div>
      </section>

      {/* Process */}
      <section aria-labelledby="service-process-title" className="py-(--space-section)">
        <div className="container-page grid-page gap-y-10">
          <div className="col-span-4 md:col-span-8 lg:col-span-4 xl:col-span-5">
            <div className="lg:sticky lg:top-[100px]">
              <ResponsiveImage
                image={service.processImage}
                aspect="aspect-[16/10] lg:aspect-[4/5]"
                sizes="(min-width: 1200px) 500px, (min-width: 1024px) 40vw, 100vw"
              />
            </div>
          </div>
          <div className="col-span-4 md:col-span-8 lg:col-span-4 xl:col-span-6 xl:col-start-7">
            <SectionIntro id="service-process-title" title={service.process.title}>
              <p>{service.process.intro}</p>
            </SectionIntro>
            <ProcessSteps className="mt-(--space-intro-content)" steps={service.process.steps} />
            <div className="mt-6">
              <TextLink href="/how-it-works" placement="service_process">
                See how every order is handled
              </TextLink>
            </div>
          </div>
        </div>
      </section>

      <FAQ title="Questions people ask first." items={faqItems(...service.faq)} className="bg-soft" />

      <FinalBookingCTA
        id={FINAL_ID}
        title={service.final.title}
        body={<p>{service.final.body}</p>}
        source={`${source}-final`}
        service={service.slug}
        primary={isQuote ? { href: quoteHref(service.slug, `${source}-final`), label: "Request a Quote" } : undefined}
      />
      <MobileConversionBar
        finalSectionId={FINAL_ID}
        source={`${source}-sticky`}
        service={service.slug}
        primary={isQuote ? { href: quoteHref(service.slug, `${source}-sticky`), label: "Request a Quote" } : undefined}
      />
    </>
  );
}
