import type { Metadata } from "next";
import Link from "next/link";
import { FinalBookingCTA } from "@/components/home/FinalBookingCTA";
import { SectionIntro } from "@/components/home/SectionIntro";
import { MobileConversionBar } from "@/components/layout/MobileConversionBar";
import { PageHero } from "@/components/pages/PageHero";
import { ButtonLink, WhatsAppButton } from "@/components/ui/Button";
import { ArrowRight } from "@/components/ui/icons";
import { ResponsiveImage } from "@/components/ui/ResponsiveImage";
import { SERVICE_PAGES, type ServiceContent } from "@/content/services";
import { WHATSAPP_URL, bookHref } from "@/content/site";

export const metadata: Metadata = {
  title: "Services — Velto Premium Laundry, Uttara",
  description:
    "Dry cleaning, Wash & Iron, ironing, curtains, carpets and bedding in Uttara, with pickup from your door.",
};

function ServiceRow({ service }: { service: ServiceContent }) {
  return (
    <li className="border-t border-line last:border-b">
      <Link
        href={`/services/${service.slug}`}
        className="group grid grid-cols-[5.5rem_1fr_auto] items-center gap-x-4 py-4 md:grid-cols-[9rem_1fr_14rem_auto] md:gap-x-6 md:py-5"
      >
        <ResponsiveImage image={service.image} aspect="aspect-[4/3]" sizes="(min-width: 768px) 144px, 88px" decorative />
        <span>
          <span className="block t-h4 text-navy group-hover:text-blue">{service.name}</span>
          <span className="mt-1 block t-small text-secondary">{service.summary}</span>
          <span className="mt-1 block t-caption text-secondary md:hidden">{service.turnaround}</span>
        </span>
        <span className="hidden t-small text-body md:block">{service.turnaround}</span>
        <ArrowRight className="size-5 text-blue transition-transform duration-200 group-hover:translate-x-0.5 motion-reduce:transition-none" />
      </Link>
    </li>
  );
}

export default function ServicesPage() {
  const garments = SERVICE_PAGES.filter((s) => s.kind === "garment");
  const household = SERVICE_PAGES.filter((s) => s.kind === "household");
  return (
    <>
      <PageHero
        crumbs={[{ label: "Home", href: "/" }, { label: "Services" }]}
        title="Laundry, dry cleaning and household cleaning in Uttara."
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
            <WhatsAppButton href={WHATSAPP_URL} placement="services_hero" className="flex-1 max-md:px-3 md:flex-none">
              WhatsApp
            </WhatsAppButton>
          </>
        }
      >
        <p>
          Every service starts with a pickup from your door in Uttara Sectors 1–18. Choose what you
          need below, or send us a photo on WhatsApp if you are not sure.
        </p>
      </PageHero>

      <section aria-labelledby="garments-title" className="bg-warm py-(--space-section)">
        <div className="container-page grid-page gap-y-8">
          <div className="col-span-4 md:col-span-8 xl:col-span-4">
            <SectionIntro id="garments-title" title="Clothes">
              <p>Priced per item and service. Search any item on the pricing page.</p>
            </SectionIntro>
          </div>
          <ul className="col-span-4 md:col-span-8 xl:col-span-7 xl:col-start-6">
            {garments.map((s) => (
              <ServiceRow key={s.slug} service={s} />
            ))}
          </ul>
        </div>
      </section>

      <section aria-labelledby="household-title" className="py-(--space-section)">
        <div className="container-page grid-page gap-y-8">
          <div className="col-span-4 md:col-span-8 xl:col-span-4">
            <SectionIntro id="household-title" title="Curtains, carpets and bedding">
              <p>
                Size, material and condition can affect the price. Tell us what you have and we will
                confirm the amount before pickup.
              </p>
            </SectionIntro>
          </div>
          <ul className="col-span-4 md:col-span-8 xl:col-span-7 xl:col-start-6">
            {household.map((s) => (
              <ServiceRow key={s.slug} service={s} />
            ))}
          </ul>
        </div>
      </section>

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
