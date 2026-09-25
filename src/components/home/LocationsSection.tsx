import { ResponsiveImage } from "@/components/ui/ResponsiveImage";
import { Star } from "@/components/ui/icons";
import { TextLink } from "@/components/ui/TextLink";
import { IMAGES } from "@/content/mock";
import type { Location } from "@/content/site";
import { getLocations, resolveImage } from "@/lib/site-content";
import { SectionIntro } from "./SectionIntro";

/**
 * Real outlets are never shown with stock photography. Until a verified Velto
 * photo is uploaded for the slot, the block opens with a quiet typographic
 * plate (decorative; the same facts are in the text below) instead of an
 * empty 3:2 placeholder.
 */
async function LocationVisual({ loc }: { loc: Location }) {
  const image = await resolveImage(IMAGES.locations[loc.id]);
  if (image.src) {
    return (
      <ResponsiveImage
        image={image}
        aspect="aspect-[3/2]"
        sizes="(min-width: 1200px) 610px, (min-width: 768px) 50vw, 100vw"
      />
    );
  }
  return <LocationPlate loc={loc} />;
}

/**
 * Typographic stand-in for an outlet photo: the sector number set large.
 * `hero` fills an internal-page hero column; the default is a short block header.
 */
export function LocationPlate({ loc, size = "block" }: { loc: Location; size?: "block" | "hero" }) {
  const hero = size === "hero";
  return (
    <div
      aria-hidden="true"
      className={`flex flex-col justify-between rounded-md border-t-2 border-navy bg-soft ${
        hero
          ? "aspect-[16/10] px-6 py-5 md:aspect-[4/5] md:px-8 md:py-7 xl:aspect-[4/3]"
          : "h-[124px] px-5 py-4 md:h-[150px] md:px-6 md:py-5 xl:h-[190px]"
      }`}
    >
      <span className="t-label uppercase text-secondary">Velto outlet · Uttara Sector</span>
      <span
        className={`font-semibold leading-[0.85] tracking-[-0.03em] text-navy ${
          hero ? "text-[120px] md:text-[160px] xl:text-[200px]" : "text-[56px] md:text-[72px]"
        }`}
      >
        {loc.name.replace(/\D/g, "")}
      </span>
      {hero ? <span className="t-small text-secondary">{loc.hours}</span> : null}
    </div>
  );
}

export function LocationBlock({ loc }: { loc: Location }) {
  return (
    <article>
      <LocationVisual loc={loc} />
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
              <div className="mt-2">
                <TextLink href={`/locations/${loc.id}`} placement="home_locations" branch={loc.id}>
                  {`Laundry and dry cleaning in ${loc.name}`}
                </TextLink>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
