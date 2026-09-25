import Link from "@/components/i18n/Link";
import type { ReactNode } from "react";
import { ArrowRight } from "@/components/ui/icons";
import { ResponsiveImage } from "@/components/ui/ResponsiveImage";
import { TextLink } from "@/components/ui/TextLink";
import { IMAGES } from "@/content/mock";
import { SERVICES, quoteHref } from "@/content/site";
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
        <SectionIntro id="services-title" eyebrow={t.eyebrow} title={t.title}>
          <p>{t.intro}</p>
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
                title={name(SERVICES.dryCleaning.slug)}
                href={SERVICES.dryCleaning.href}
                linkLabel={view(SERVICES.dryCleaning.slug)}
              >
                {t.dryCleaningCopy}
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
                title={name(SERVICES.washAndIron.slug)}
                href={SERVICES.washAndIron.href}
                linkLabel={view(SERVICES.washAndIron.slug)}
              >
                {t.washAndIronCopy}
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
              <ServiceItem large title={name(SERVICES.ironing.slug)} href={SERVICES.ironing.href} linkLabel={view(SERVICES.ironing.slug)}>
                {t.ironingCopy}
              </ServiceItem>
            </div>
          </article>

          {/* Household group — one panel of clickable rows, not cards */}
          <div className="col-span-4 border-t border-line pt-8 md:col-span-5 xl:col-span-7">
            <h3 className="t-h3 text-navy">{t.householdTitle}</h3>
            <p className="mt-3 max-w-[52ch] t-body-lg text-secondary">{t.householdCopy}</p>
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
                {t.requestQuote}
              </TextLink>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
