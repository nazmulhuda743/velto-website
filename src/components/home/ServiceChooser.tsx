import Link from "@/components/i18n/Link";
import type { ReactNode } from "react";
import { ArrowRight } from "@/components/ui/icons";
import { ResponsiveImage } from "@/components/ui/ResponsiveImage";
import { TextLink } from "@/components/ui/TextLink";
import { IMAGES } from "@/content/mock";
import { SERVICES } from "@/content/site";
import { dictionary } from "@/content/i18n";
import { fill } from "@/lib/i18n/config";
import { getLocale } from "@/lib/i18n/server";
import { SectionIntro } from "./SectionIntro";

function ServiceItem({
  title,
  href,
  linkLabel,
  children,
  large = false,
  rowOnMobile = false,
}: {
  title: string;
  href: string;
  linkLabel: string;
  children: ReactNode;
  large?: boolean;
  /** Phone: a compact list row (thumbnail beside the text); tablet and up: the large editorial item. */
  rowOnMobile?: boolean;
}) {
  const heading = rowOnMobile ? "t-h4 md:t-h3" : large ? "t-h3" : "t-h4";
  const copy = rowOnMobile ? "t-small md:t-body-lg" : large ? "t-body-lg" : "t-body";
  return (
    <>
      <h3 className={`${heading} text-navy transition-colors group-hover/service:text-blue`}>{title}</h3>
      <p className={`${rowOnMobile ? "mt-1 md:mt-3" : "mt-3"} max-w-[46ch] text-secondary ${copy}`}>{children}</p>
      <div className={rowOnMobile ? "mt-1 md:mt-3" : "mt-3"}>
        {/* Stretched link: the whole article (photo and title too) opens the service page. */}
        <TextLink
          href={href}
          placement="service_chooser"
          className={`${rowOnMobile ? "text-[14px] md:text-base" : "t-body"} after:absolute after:inset-0 after:content-['']`}
        >
          {linkLabel}
        </TextLink>
      </div>
    </>
  );
}

/** Wash & Iron and Ironing: a thumbnail row on phones, an editorial item with a large photo from tablet up. */
const ROW =
  "group/service relative col-span-4 grid grid-cols-[5.5rem_1fr] items-start gap-x-4 border-t border-line py-4 md:block md:py-0";

export async function ServiceChooser() {
  const locale = await getLocale();
  const d = dictionary(locale);
  const t = d.home.services;
  const name = (slug: string) => d.serviceNames[slug];
  const view = (slug: string) => fill(t.view, { service: name(slug) }, locale);
  const household = [
    { title: name(SERVICES.curtains.slug), copy: t.curtainsCopy, link: view(SERVICES.curtains.slug), image: IMAGES.household, ...SERVICES.curtains },
    { title: name(SERVICES.carpets.slug), copy: t.carpetsCopy, link: view(SERVICES.carpets.slug), image: IMAGES.carpet, ...SERVICES.carpets },
    { title: name(SERVICES.blankets.slug), copy: t.blanketsCopy, link: t.viewBlankets, image: IMAGES.blankets, ...SERVICES.blankets },
  ];
  return (
    <section id="services" aria-labelledby="services-title" className="bg-warm py-(--space-section)">
      <div className="container-page">
        <SectionIntro id="services-title" title={t.title}>
          <p>{t.intro}</p>
        </SectionIntro>

        <div className="mt-(--space-intro-content) grid-page gap-y-0 md:gap-y-16">
          {/* Dry Cleaning — strongest visual weight */}
          <article className="group/service relative col-span-4 md:col-span-5 xl:col-span-7">
            <ResponsiveImage
              image={IMAGES.dryCleaning}
              aspect="aspect-[16/9] md:aspect-[3/2] xl:aspect-[2/1]"
              sizes="(min-width: 1200px) 720px, (min-width: 768px) 60vw, 100vw"
            />
            <div className="mt-5 md:mt-6">
              <ServiceItem
                large
                title={name(SERVICES.dryCleaning.slug)}
                href={SERVICES.dryCleaning.href}
                linkLabel={view(SERVICES.dryCleaning.slug)}
              >
                {t.dryCleaningCopy}
              </ServiceItem>
            </div>
          </article>

          <article className={`${ROW} mt-8 md:col-span-3 md:mt-0 md:border-0 md:pt-0 xl:col-span-5`}>
            <ResponsiveImage
              image={IMAGES.washAndIron}
              aspect="aspect-[4/3] md:aspect-[3/4] xl:aspect-[7/5]"
              sizes="(min-width: 1200px) 500px, (min-width: 768px) 40vw, 88px"
            />
            <div className="md:mt-6">
              <ServiceItem
                large
                rowOnMobile
                title={name(SERVICES.washAndIron.slug)}
                href={SERVICES.washAndIron.href}
                linkLabel={view(SERVICES.washAndIron.slug)}
              >
                {t.washAndIronCopy}
              </ServiceItem>
            </div>
          </article>

          <article className={`${ROW} border-b md:col-span-3 md:border-b-0 md:pt-8 xl:col-span-5`}>
            <ResponsiveImage
              image={IMAGES.ironing}
              aspect="aspect-[4/3] md:aspect-square xl:aspect-[16/9]"
              sizes="(min-width: 1200px) 500px, (min-width: 768px) 40vw, 88px"
            />
            <div className="md:mt-6">
              <ServiceItem large rowOnMobile title={name(SERVICES.ironing.slug)} href={SERVICES.ironing.href} linkLabel={view(SERVICES.ironing.slug)}>
                {t.ironingCopy}
              </ServiceItem>
            </div>
          </article>

          {/* Household group — one panel of clickable rows, not cards */}
          <div className="col-span-4 mt-10 md:col-span-5 md:mt-0 md:border-t md:border-line md:pt-8 xl:col-span-7">
            <h3 className="t-h3 text-navy">{t.householdTitle}</h3>
            <ul className="mt-4 border-t border-navy md:mt-6">
              {household.map((item) => (
                <li key={item.slug} className="border-b border-line">
                  <Link
                    href={item.href}
                    data-placement="service_chooser"
                    className="group grid grid-cols-[5.5rem_1fr_auto] items-center gap-x-3 py-4 transition-colors hover:bg-white md:grid-cols-[7.5rem_1fr_auto] md:gap-x-5 md:px-2"
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
          </div>
        </div>
      </div>
    </section>
  );
}
