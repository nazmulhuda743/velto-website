import { ResponsiveImage } from "@/components/ui/ResponsiveImage";
import { Star } from "@/components/ui/icons";
import { TextLink } from "@/components/ui/TextLink";
import { IMAGES } from "@/content/mock";
import type { Location } from "@/content/site";
import { getLocations } from "@/lib/site-content";
import { SectionIntro } from "./SectionIntro";

export function LocationBlock({ loc }: { loc: Location }) {
  return (
    <article>
      <ResponsiveImage
        image={IMAGES.locations[loc.id]}
        aspect="aspect-[3/2]"
        sizes="(min-width: 1200px) 610px, (min-width: 768px) 50vw, 100vw"
      />
      <h3 className="mt-6 t-h3 text-navy">{loc.name}</h3>
      <dl className="mt-5">
        <div className="border-t border-line py-3.5">
          <dt className="sr-only">Google rating</dt>
          <dd className="flex items-center gap-1.5 font-semibold text-navy">
            <span aria-hidden="true" className="inline-flex items-center gap-1.5">
              {loc.rating}
              <Star className="size-4 text-blue" />
              <span className="font-normal text-secondary">·</span>
              {loc.reviewCount} Google reviews
            </span>
            <span className="sr-only">
              {loc.rating} out of 5 from {loc.reviewCount} Google reviews
            </span>
          </dd>
        </div>
        <div className="border-t border-line py-3.5">
          <dt className="sr-only">Address</dt>
          <dd>
            <address className="not-italic text-body">{loc.address}</address>
          </dd>
        </div>
        <div className="border-y border-line py-3.5">
          <dt className="sr-only">Opening hours</dt>
          <dd className="text-body">{loc.hours}</dd>
        </div>
      </dl>
      <div className="mt-4 flex flex-wrap gap-x-8 gap-y-1">
        <TextLink href={loc.directionsUrl} external event="directions_click" placement="locations" branch={loc.id}>
          Get Directions
        </TextLink>
        <TextLink href={loc.reviewsUrl} external event="google_reviews_click" placement="locations" branch={loc.id}>
          See Google Reviews
        </TextLink>
      </div>
    </article>
  );
}

export async function LocationsSection() {
  const locations = await getLocations();
  return (
    <section id="locations" aria-labelledby="locations-title" className="py-(--space-section)">
      <div className="container-page">
        <SectionIntro id="locations-title" eyebrow="Locations" title="Built around Uttara.">
          <p>
            Velto serves Uttara Sectors 1–18, with locations in Sector 11 and Sector 18.
          </p>
          <p>Book a pickup from home or visit the outlet that works for you.</p>
        </SectionIntro>
        <div className="mt-(--space-intro-content) grid-page gap-y-14">
          {locations.map((loc) => (
            <div key={loc.id} className="col-span-4 md:col-span-4 xl:col-span-6">
              <LocationBlock loc={loc} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
