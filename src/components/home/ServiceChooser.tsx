import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight } from "@/components/ui/icons";
import { ResponsiveImage } from "@/components/ui/ResponsiveImage";
import { TextLink } from "@/components/ui/TextLink";
import { IMAGES } from "@/content/mock";
import { SERVICES, quoteHref } from "@/content/site";
import { SectionIntro } from "./SectionIntro";

function ServiceItem({
  title,
  href,
  linkLabel,
  children,
  large = false,
}: {
  title: string;
  href: string;
  linkLabel: string;
  children: ReactNode;
  large?: boolean;
}) {
  return (
    <>
      <h3 className={large ? "t-h3 text-navy" : "t-h4 text-navy"}>{title}</h3>
      <p className={`mt-3 max-w-[46ch] text-secondary ${large ? "t-body-lg" : "t-body"}`}>{children}</p>
      <div className="mt-3">
        <TextLink href={href} placement="service_chooser" className="t-body">
          {linkLabel}
        </TextLink>
      </div>
    </>
  );
}

const household = [
  {
    title: "Curtain Cleaning",
    copy: "Tell us roughly how many curtains you have and their size. We'll help you work out the price.",
    link: "View Curtain Cleaning",
    image: IMAGES.household,
    ...SERVICES.curtains,
  },
  {
    title: "Carpet Cleaning",
    copy: "Share the approximate dimensions. The material and condition may affect the final price.",
    link: "View Carpet Cleaning",
    image: IMAGES.householdSection,
    ...SERVICES.carpets,
  },
  {
    title: "Blankets & Comforters",
    copy: "Pricing depends mainly on the item, type and size.",
    link: "View Blanket Cleaning",
    image: IMAGES.blankets,
    ...SERVICES.blankets,
  },
];

export function ServiceChooser() {
  return (
    <section id="services" aria-labelledby="services-title" className="bg-warm py-(--space-section)">
      <div className="container-page">
        <SectionIntro id="services-title" title="What do you need cleaned?">
          <p>
            Choose the service you need. If you are unsure, send us a photo or message Velto on
            WhatsApp.
          </p>
        </SectionIntro>

        <div className="mt-(--space-intro-content) grid-page gap-y-12 md:gap-y-16 xl:gap-y-20">
          {/* Dry Cleaning — strongest visual weight */}
          <article className="col-span-4 md:col-span-5 xl:col-span-7">
            <ResponsiveImage
              image={IMAGES.dryCleaning}
              aspect="aspect-[3/2]"
              sizes="(min-width: 1200px) 720px, (min-width: 768px) 60vw, 100vw"
            />
            <div className="mt-6">
              <ServiceItem
                large
                title="Dry Cleaning"
                href={SERVICES.dryCleaning.href}
                linkLabel="View Dry Cleaning"
              >
                For suits, blazers, sarees, sherwanis and garments that need a closer look before
                cleaning.
              </ServiceItem>
            </div>
          </article>

          <article className="col-span-4 border-t border-line pt-8 md:col-span-3 md:border-0 md:pt-0 xl:col-span-5">
            <ResponsiveImage
              image={IMAGES.washAndIron}
              aspect="aspect-[3/2] md:aspect-[3/4] xl:aspect-[21/20]"
              sizes="(min-width: 1200px) 500px, (min-width: 768px) 40vw, 100vw"
            />
            <div className="mt-6">
              <ServiceItem
                large
                title="Wash & Iron"
                href={SERVICES.washAndIron.href}
                linkLabel="View Wash & Iron"
              >
                We collect your laundry, wash and finish it, then return it ready to wear.
              </ServiceItem>
            </div>
          </article>

          <article className="col-span-4 border-t border-line pt-8 md:col-span-3 xl:col-span-5">
            <ResponsiveImage
              image={IMAGES.ironing}
              aspect="aspect-[3/2] md:aspect-[4/5] xl:aspect-[4/3]"
              sizes="(min-width: 1200px) 500px, (min-width: 768px) 40vw, 100vw"
            />
            <div className="mt-6">
              <ServiceItem large title="Ironing" href={SERVICES.ironing.href} linkLabel="View Ironing">
                Already washed? Send it to Velto for ironing and finishing.
              </ServiceItem>
            </div>
          </article>

          {/* Household group — one panel of clickable rows, not cards */}
          <div className="col-span-4 border-t border-line pt-8 md:col-span-5 xl:col-span-7">
            <h3 className="t-h3 text-navy">Curtains, carpets &amp; bedding</h3>
            <p className="mt-3 max-w-[52ch] t-body-lg text-secondary">
              Priced by size or by item. Where measurement or condition matters, we confirm the
              amount before pickup.
            </p>
            <ul className="mt-6 border-t border-navy">
              {household.map((item) => (
                <li key={item.slug} className="border-b border-line">
                  <Link
                    href={item.href}
                    data-placement="service_chooser"
                    className="group grid grid-cols-[5.5rem_1fr_auto] items-center gap-x-4 py-4 transition-colors hover:bg-white md:grid-cols-[7.5rem_1fr_auto] md:gap-x-5 md:px-2"
                  >
                    <ResponsiveImage image={item.image} aspect="aspect-[4/3]" sizes="120px" decorative />
                    <span>
                      <span className="block t-h4 text-navy group-hover:text-blue">{item.title}</span>
                      <span className="mt-1 block t-small text-secondary md:t-body">{item.copy}</span>
                      <span className="sr-only">{item.link}</span>
                    </span>
                    <ArrowRight className="size-5 text-blue transition-transform duration-200 group-hover:translate-x-0.5 motion-reduce:transition-none" />
                  </Link>
                </li>
              ))}
            </ul>
            <div className="mt-5">
              <TextLink href={quoteHref(undefined, "home_services")} placement="service_chooser">
                Request a Quote
              </TextLink>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
