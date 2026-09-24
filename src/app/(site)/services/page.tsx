import { pageMetadata } from "@/lib/seo";
import Link from "next/link";
import { FAQ, faqItems } from "@/components/home/FAQ";
import { FinalBookingCTA } from "@/components/home/FinalBookingCTA";
import { GoogleProof } from "@/components/home/ProofLine";
import { SectionIntro } from "@/components/home/SectionIntro";
import { MobileConversionBar } from "@/components/layout/MobileConversionBar";
import { PageHero } from "@/components/pages/PageHero";
import { ServiceCompare } from "@/components/services/ServiceCompare";
import { ButtonLink } from "@/components/ui/Button";
import { ArrowRight } from "@/components/ui/icons";
import { ResponsiveImage } from "@/components/ui/ResponsiveImage";
import { TextLink } from "@/components/ui/TextLink";
import { SERVICE_PAGES, type ServiceContent, type ServiceSlug } from "@/content/services";
import { FREE_DELIVERY_THRESHOLD, bookHref, quoteHref } from "@/content/site";

export const revalidate = 300;

export const generateMetadata = () => pageMetadata("/services");

const GROUPS: { title: string; slugs: ServiceSlug[] }[] = [
  { title: "Clothes", slugs: ["dry-cleaning", "wash-and-iron", "ironing"] },
  { title: "Curtains, carpets and bedding", slugs: ["curtain-cleaning", "carpet-cleaning", "blanket-comforter-cleaning"] },
  { title: "Timing", slugs: ["express"] },
];

const bySlug = new Map(SERVICE_PAGES.map((s) => [s.slug, s]));

function DecisionRow({ service }: { service: ServiceContent }) {
  return (
    <li className="border-b border-line">
      <Link
        href={`/services/${service.slug}`}
        className="group grid gap-x-6 gap-y-2 py-5 md:grid-cols-[7.5rem_minmax(0,1fr)_14rem_auto] md:items-center md:py-6"
      >
        <ResponsiveImage
          image={service.image}
          aspect="aspect-[4/3]"
          sizes="120px"
          decorative
          className="hidden md:block"
        />
        <span className="text-[18px] font-semibold leading-snug tracking-[-0.01em] text-navy md:text-[20px]">
          {service.whenToChoose}
        </span>
        <span className="block">
          <span className="flex items-center gap-2 font-semibold text-blue group-hover:underline group-hover:underline-offset-4">
            {service.name}
            <ArrowRight className="size-4 md:hidden" />
          </span>
          <span className="mt-0.5 block t-caption text-secondary">{service.overviewFact}</span>
        </span>
        <ArrowRight className="hidden size-5 text-blue transition-transform duration-200 group-hover:translate-x-0.5 motion-reduce:transition-none md:block" />
      </Link>
    </li>
  );
}

const PRICING_MODELS = [
  {
    title: "Clothes are priced per item",
    copy: "Every garment has its own price for each service it can have, so you can check before you send it.",
    link: { href: "/pricing", label: "Search the price list" },
  },
  {
    title: "Curtains and carpets are priced per square foot",
    copy: "Send the approximate size. Velto confirms the final amount when measurement or condition needs checking.",
    link: { href: quoteHref(undefined, "services-page"), label: "Request a Quote" },
  },
  {
    title: "Blankets, comforters and quilts are priced per piece",
    copy: "By type and size, so most bedding can be booked straight away.",
    link: { href: "/services/blanket-comforter-cleaning", label: "See bedding prices" },
  },
];

export default function ServicesPage() {
  return (
    <>
      <PageHero
        crumbs={[{ label: "Home", href: "/" }, { label: "Services" }]}
        title="Which service do you need?"
        actions={
          <>
            <ButtonLink
              href={bookHref("services-page")}
              event="book_pickup_click"
              placement="services_hero"
              className="flex-[1.45] max-md:px-4 md:flex-none"
            >
              Book a Pickup
            </ButtonLink>
            <ButtonLink href="/pricing" variant="secondary" placement="services_hero" className="flex-1 max-md:px-3 md:flex-none">
              View Pricing
            </ButtonLink>
          </>
        }
        aside={<GoogleProof placement="services_hero" />}
      >
        <p>
          Start with what you&apos;re sending. Every service begins with a pickup from your door in
          Uttara Sectors 1–18. Still not sure? Send a photo on WhatsApp and we&apos;ll tell you.
        </p>
      </PageHero>

      <section aria-labelledby="choose-title" className="bg-warm py-(--space-section)">
        <div className="container-page">
          <SectionIntro id="choose-title" title="Start with what you're sending." />
          <div className="mt-(--space-intro-content) space-y-(--space-related)">
            {GROUPS.map((group) => (
              <div key={group.title}>
                <h3 className="t-label uppercase text-navy">{group.title}</h3>
                <ul className="mt-3 border-t border-navy">
                  {group.slugs.map((slug) => {
                    const service = bySlug.get(slug);
                    return service ? <DecisionRow key={slug} service={service} /> : null;
                  })}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section aria-labelledby="compare-title" className="py-(--space-section)">
        <div className="container-page">
          <SectionIntro id="compare-title" title="Wash & Iron, Ironing or Dry Cleaning?">
            <p>The three clothing services, side by side.</p>
          </SectionIntro>
          <div className="mt-(--space-intro-content)">
            <ServiceCompare current={null} />
          </div>
        </div>
      </section>

      <section aria-labelledby="pricing-models-title" className="bg-soft py-(--space-section)">
        <div className="container-page grid-page gap-y-(--space-intro-content)">
          <div className="col-span-4 md:col-span-8 xl:col-span-4">
            <SectionIntro id="pricing-models-title" title="How each service is priced" titleClassName="max-w-[14ch]">
              <p>
                Free pickup &amp; delivery on orders of {FREE_DELIVERY_THRESHOLD}+. For smaller orders,
                the applicable charge is shown before booking.
              </p>
            </SectionIntro>
          </div>
          <div className="col-span-4 border-t border-navy md:col-span-8 xl:col-span-7 xl:col-start-6">
            {PRICING_MODELS.map((m) => (
              <div key={m.title} className="border-b border-line py-5">
                <h3 className="t-h4 text-navy">{m.title}</h3>
                <p className="mt-1.5 max-w-[56ch] text-secondary">{m.copy}</p>
                <TextLink href={m.link.href} placement="services_pricing" className="mt-1">
                  {m.link.label}
                </TextLink>
              </div>
            ))}
          </div>
        </div>
      </section>

      <FAQ title="Before you choose." items={faqItems("unsure", "turnaround", "area", "freeDelivery")} />

      <FinalBookingCTA
        id="book"
        title="Not sure which service?"
        body={
          <p>
            Book a pickup and add a note, or send a photo on WhatsApp. We can help you choose before
            anything is cleaned.
          </p>
        }
        source="services-page-final"
      />
      <MobileConversionBar finalSectionId="book" source="services-page-sticky" />
    </>
  );
}
