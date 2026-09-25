import { pageMetadata } from "@/lib/seo/page-metadata";
import { ProofFigures } from "@/components/pages/ProofFigures";
import { freeDeliveryFigure, outletsFigure, sectorsFigure } from "@/components/pages/figures";
import { FinalBookingCTA } from "@/components/home/FinalBookingCTA";
import { LocationBlock } from "@/components/home/LocationsSection";
import { SectionIntro } from "@/components/home/SectionIntro";
import { PageHero } from "@/components/pages/PageHero";
import { ButtonLink } from "@/components/ui/Button";
import { TextLink } from "@/components/ui/TextLink";
import { FREE_DELIVERY_THRESHOLD, bookHref } from "@/content/site";
import { getLocations } from "@/lib/site-content";
import { IMAGES } from "@/content/mock";

export const generateMetadata = () => pageMetadata("/locations");

export default async function LocationsPage() {
  const locations = await getLocations();
  return (
    <>
      <PageHero
        path={"/locations"}
        image={IMAGES.process[0]}
        crumbs={[{ label: "Home", href: "/" }, { label: "Locations" }]}
        title="Two outlets in Uttara. Pickup across Sectors 1–18."
        eyebrow="Locations"
        highlight="Pickup across Sectors 1–18."
        aside={<ProofFigures wide={3} figures={[outletsFigure, sectorsFigure, freeDeliveryFigure]} />}
        actions={
          <ButtonLink href={bookHref("locations-page")} event="book_pickup_click" placement="locations_hero">
            Book a Pickup
          </ButtonLink>
        }
      >
        <p>
          Velto serves Uttara Sectors 1–18, with locations in Sector 11 and Sector 18. Book a pickup
          from home or visit the outlet that works for you.
        </p>
      </PageHero>

      <section aria-labelledby="outlets-title" className="bg-warm py-(--space-section)">
        <h2 id="outlets-title" className="sr-only">
          Our outlets
        </h2>
        <div className="container-page grid-page gap-y-14">
          {locations.map((loc) => (
            <div key={loc.id} className="col-span-4 md:col-span-4 xl:col-span-6">
              <LocationBlock loc={loc} />
              <div className="mt-2">
                <TextLink href={`/locations/${loc.id}`} placement="locations_list" branch={loc.id}>
                  {`About the ${loc.name} outlet`}
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
            <SectionIntro id="area-title" eyebrow="Pickup" title="Pickup and delivery across Uttara">
              <p>
                We collect from your door and deliver back in every one of these Uttara sectors. You don&apos;t need to
                live near an outlet. Orders of {FREE_DELIVERY_THRESHOLD}+ are picked up and delivered free.
              </p>
              <p>Outside Sectors 1–18? Ask us on WhatsApp before booking and we&apos;ll tell you what&apos;s possible.</p>
            </SectionIntro>
          </div>
          <div className="col-span-4 md:col-span-8 xl:col-span-6 xl:col-start-7">
            <h3 className="t-label uppercase text-navy">Sectors we collect from</h3>
            <ul className="mt-3 grid grid-cols-3 border-l border-t border-line md:grid-cols-6">
              {Array.from({ length: 18 }, (_, i) => i + 1).map((n) => (
                <li key={n} className="border-b border-r border-line px-3 py-3 text-center">
                  <span className="block t-caption text-secondary">Sector</span>
                  <span className="block text-[20px] font-semibold tabular-nums text-navy">{n}</span>
                </li>
              ))}
            </ul>
            <p className="mt-4 t-small text-secondary">
              Outlets in Sector 11 (House 2, Road 14) and Sector 18 (RUAP, Poncoboti Bazar) for drop-off.
            </p>
          </div>
        </div>
      </section>

      <FinalBookingCTA id="book" source="locations-final" />
    </>
  );
}
