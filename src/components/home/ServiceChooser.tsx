import type { ReactNode } from "react";
import { ResponsiveImage } from "@/components/ui/ResponsiveImage";
import { TextLink } from "@/components/ui/TextLink";
import { IMAGES } from "@/content/mock";
import { SERVICES } from "@/content/site";
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
    copy: "Tell us the approximate size and quantity so we can guide you on pricing.",
    link: "View Curtain Cleaning",
    ...SERVICES.curtains,
  },
  {
    title: "Carpet Cleaning",
    copy: "Share the approximate dimensions. Material and condition may affect the final price.",
    link: "View Carpet Cleaning",
    ...SERVICES.carpets,
  },
  {
    title: "Blankets & Comforters",
    copy: "Pricing depends mainly on the item, type and size.",
    link: "View Blanket Cleaning",
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
                For suits, blazers, sarees, sherwanis and other garments that need closer attention
                before cleaning.
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

          <article className="col-span-4 border-t border-line pt-8 md:col-span-3 md:pt-8 xl:col-span-5">
            <ResponsiveImage
              image={IMAGES.ironing}
              aspect="aspect-[4/3]"
              className="mb-6 hidden md:block"
              sizes="(min-width: 1200px) 500px, 40vw"
            />
            <ServiceItem
              title="Ironing"
              href={SERVICES.ironing.href}
              linkLabel="View Ironing"
            >
              Already washed? Send it to Velto for ironing and finishing.
            </ServiceItem>
          </article>

          {/* Household group — editorial rows, not cards */}
          <div className="col-span-4 border-t border-line pt-8 md:col-span-5 xl:col-span-7">
            <div className="grid gap-6 xl:grid-cols-7 xl:gap-6">
              <ResponsiveImage
                image={IMAGES.household}
                aspect="aspect-[16/9] xl:aspect-[3/4]"
                className="xl:col-span-3"
                sizes="(min-width: 1200px) 290px, (min-width: 768px) 60vw, 100vw"
              />
              <ul className="xl:col-span-4">
                {household.map((item, i) => (
                  <li
                    key={item.slug}
                    className={`py-5 ${i > 0 ? "border-t border-line" : "pt-0 xl:pt-0"} last:pb-0`}
                  >
                    <h3 className="t-h4 text-navy">{item.title}</h3>
                    <p className="mt-2 text-secondary">{item.copy}</p>
                    <div className="mt-2">
                      <TextLink href={item.href} placement="service_chooser">
                        {item.link}
                      </TextLink>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
