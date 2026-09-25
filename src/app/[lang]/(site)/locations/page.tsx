import { pageMetadata } from "@/lib/seo/page-metadata";
import { ProofFigures } from "@/components/pages/ProofFigures";
import { pageFigures } from "@/components/pages/figures";
import { FinalBookingCTA } from "@/components/home/FinalBookingCTA";
import { LocationBlock } from "@/components/home/LocationsSection";
import { SectionIntro } from "@/components/home/SectionIntro";
import { PageHero } from "@/components/pages/PageHero";
import { ButtonLink } from "@/components/ui/Button";
import { TextLink } from "@/components/ui/TextLink";
import { FREE_DELIVERY_THRESHOLD, bookHref } from "@/content/site";
import { getLocations } from "@/lib/site-content";
import { IMAGES } from "@/content/mock";
import { dictionary } from "@/content/i18n";
import { pageText } from "@/content/i18n/pages";
import { fill, localDigits } from "@/lib/i18n/config";
import { getLocale } from "@/lib/i18n/server";

export const generateMetadata = () => pageMetadata("/locations");

export default async function LocationsPage() {
  const locations = await getLocations();
  const locale = await getLocale();
  const d = dictionary(locale);
  const t = pageText(locale).locationsPage;
  const fig = await pageFigures();
  return (
    <>
      <PageHero
        path={"/locations"}
        image={IMAGES.process[0]}
        crumbs={[{ label: d.common.home, href: "/" }, { label: d.nav.locations }]}
        title={t.title}
        eyebrow={t.eyebrow}
        highlight={t.highlight}
        aside={<ProofFigures wide={3} figures={[fig.outlets, fig.sectors, fig.freeDelivery]} />}
        actions={
          <ButtonLink href={bookHref("locations-page")} event="book_pickup_click" placement="locations_hero">
            {d.common.bookPickup}
          </ButtonLink>
        }
      >
        <p>{t.intro}</p>
      </PageHero>

      <section aria-labelledby="outlets-title" className="bg-warm py-(--space-section)">
        <h2 id="outlets-title" className="sr-only">
          {t.outletsTitle}
        </h2>
        <div className="container-page grid-page gap-y-14">
          {locations.map((loc) => (
            <div key={loc.id} className="col-span-4 md:col-span-4 xl:col-span-6">
              <LocationBlock loc={loc} />
              <div className="mt-2">
                <TextLink href={`/locations/${loc.id}`} placement="locations_list" branch={loc.id}>
                  {fill(t.aboutOutlet, { name: d.locationNames[loc.id] ?? loc.name }, locale)}
                </TextLink>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* One honest service-area block instead of eighteen thin sector pages. */}
      <section aria-labelledby="area-title" className="py-(--space-section)">
        <div className="container-page grid-page gap-y-8">
          <div className="col-span-4 md:col-span-8 xl:col-span-5">
            <SectionIntro id="area-title" eyebrow={t.areaEyebrow} title={t.areaTitle}>
              <p>{fill(t.areaIntro1, { amount: FREE_DELIVERY_THRESHOLD }, locale)}</p>
              <p>{t.areaIntro2}</p>
            </SectionIntro>
          </div>
          <div className="col-span-4 md:col-span-8 xl:col-span-6 xl:col-start-7">
            <h3 className="t-label uppercase text-navy">{t.sectorsTitle}</h3>
            <ul className="mt-3 grid grid-cols-3 border-l border-t border-line md:grid-cols-6">
              {Array.from({ length: 18 }, (_, i) => i + 1).map((n) => (
                <li key={n} className="border-b border-r border-line px-3 py-3 text-center">
                  <span className="block t-caption text-secondary">{t.sector}</span>
                  <span className="block text-[20px] font-semibold tabular-nums text-navy">{localDigits(n, locale)}</span>
                </li>
              ))}
            </ul>
            <p className="mt-4 t-small text-secondary">{t.outletsNote}</p>
          </div>
        </div>
      </section>

      <FinalBookingCTA id="book" source="locations-final" />
    </>
  );
}
