import { pageMetadata } from "@/lib/seo";
import { FinalBookingCTA } from "@/components/home/FinalBookingCTA";
import { LocationBlock } from "@/components/home/LocationsSection";
import { SectionIntro } from "@/components/home/SectionIntro";
import { PageHero } from "@/components/pages/PageHero";
import { ButtonLink } from "@/components/ui/Button";
import { TextLink } from "@/components/ui/TextLink";
import { bookHref } from "@/content/site";
import { getLocations } from "@/lib/site-content";

export const generateMetadata = () => pageMetadata("/locations");

export default async function LocationsPage() {
  const locations = await getLocations();
  return (
    <>
      <PageHero
        crumbs={[{ label: "Home", href: "/" }, { label: "Locations" }]}
        title="Two outlets in Uttara. Pickup across Sectors 1–18."
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

      <section aria-labelledby="area-title" className="py-(--space-section)">
        <div className="container-page grid-page gap-y-6">
          <div className="col-span-4 md:col-span-8 xl:col-span-5">
            <SectionIntro id="area-title" title="Pickup and delivery area" />
          </div>
          <div className="col-span-4 space-y-4 t-body-lg text-body md:col-span-8 xl:col-span-6 xl:col-start-7">
            <p>Velto&apos;s confirmed core service area is Uttara, Sectors 1–18.</p>
            <p>If you are outside that area, ask us before booking.</p>
          </div>
        </div>
      </section>

      <FinalBookingCTA id="book" source="locations-final" />
    </>
  );
}
