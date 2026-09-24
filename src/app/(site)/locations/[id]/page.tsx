import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FinalBookingCTA } from "@/components/home/FinalBookingCTA";
import { ProofList } from "@/components/home/ProofLine";
import { SectionIntro } from "@/components/home/SectionIntro";
import { FactRows } from "@/components/pages/FactRows";
import { PageHero } from "@/components/pages/PageHero";
import { ButtonLink } from "@/components/ui/Button";
import { Star } from "@/components/ui/icons";
import { TextLink } from "@/components/ui/TextLink";
import { IMAGES } from "@/content/mock";
import { LOCATIONS, bookHref } from "@/content/site";
import { pageMetadata } from "@/lib/seo";
import { getLocations } from "@/lib/site-content";

export const dynamicParams = false;

export function generateStaticParams() {
  return LOCATIONS.map((l) => ({ id: l.id }));
}

const find = (id: string) => LOCATIONS.find((l) => l.id === id);

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  return find(id) ? pageMetadata(`/locations/${id}`) : {};
}

export default async function LocationPage({ params }: { params: Promise<{ id: string }> }) {
  const id = (await params).id;
  const locations = await getLocations();
  const loc = locations.find((l) => l.id === id);
  if (!loc) notFound();
  const other = locations.find((l) => l.id !== loc.id)!;
  return (
    <>
      <PageHero
        crumbs={[{ label: "Home", href: "/" }, { label: "Locations", href: "/locations" }, { label: loc.name }]}
        title={`Velto ${loc.name}`}
        // Real outlet: MOCK placeholder until verified Velto photography exists (never stock).
        image={IMAGES.locations[loc.id]}
        aside={<ProofList items={[`Open ${loc.hours}`, `${loc.rating} on Google · ${loc.reviewCount} reviews for ${loc.name}`]} />}
        actions={
          <>
            <ButtonLink
              href={loc.directionsUrl}
              target="_blank"
              rel="noopener noreferrer"
              event="directions_click"
              placement="location_hero"
              className="flex-1 max-md:px-4 md:flex-none"
            >
              Get Directions
            </ButtonLink>
            <ButtonLink
              href={bookHref(`${loc.id}-page`)}
              variant="secondary"
              event="book_pickup_click"
              placement="location_hero"
              className="flex-1 max-md:px-4 md:flex-none"
            >
              Book a Pickup
            </ButtonLink>
          </>
        }
      >
        <p>{loc.address}</p>
      </PageHero>

      <section aria-labelledby="visit-title" className="bg-warm py-(--space-section)">
        <div className="container-page grid-page gap-y-10">
          <div className="col-span-4 md:col-span-8 xl:col-span-5">
            <SectionIntro id="visit-title" title="Visiting the outlet">
              <p>Visit in person, or book a pickup from anywhere in Uttara Sectors 1–18.</p>
            </SectionIntro>
          </div>
          <div className="col-span-4 md:col-span-8 xl:col-span-6 xl:col-start-7">
            <FactRows
              rows={[
                { label: "Address", value: <address className="not-italic">{loc.address}</address> },
                { label: "Hours", value: loc.hours },
                {
                  label: "Google rating",
                  // TODO_VERIFY: review counts before launch (spec §36). Never merged across branches.
                  value: (
                    <span className="inline-flex items-center gap-1.5">
                      <span aria-hidden="true" className="inline-flex items-center gap-1.5">
                        {loc.rating}
                        <Star className="size-4 text-blue" />· {loc.reviewCount} Google reviews
                      </span>
                      <span className="sr-only">
                        {loc.rating} out of 5 from {loc.reviewCount} Google reviews for {loc.name}
                      </span>
                    </span>
                  ),
                },
              ]}
            />
            <div className="mt-6 flex flex-wrap gap-x-8 gap-y-1">
              <TextLink href={loc.reviewsUrl} external event="google_reviews_click" placement="location_page" branch={loc.id}>
                See Google Reviews
              </TextLink>
              <TextLink href={`/locations/${other.id}`} placement="location_page">
                {`Velto ${other.name}`}
              </TextLink>
            </div>
          </div>
        </div>
      </section>

      <FinalBookingCTA
        id="book"
        title="Rather not make the trip?"
        body={<p>Book a pickup and we will collect from your door anywhere in Uttara Sectors 1–18.</p>}
        source={`${loc.id}-final`}
      />
    </>
  );
}
