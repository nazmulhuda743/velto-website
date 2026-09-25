import { ResponsiveImage } from "@/components/ui/ResponsiveImage";
import { Star } from "@/components/ui/icons";
import { TextLink } from "@/components/ui/TextLink";
import { IMAGES } from "@/content/mock";
import type { Location } from "@/content/site";
import { getLocations, resolveImage } from "@/lib/site-content";
import { dictionary } from "@/content/i18n";
import { fill } from "@/lib/i18n/config";
import { getLocale, localLocation } from "@/lib/i18n/server";
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
export async function LocationPlate({ loc, size = "block" }: { loc: Location; size?: "block" | "hero" }) {
  const plate = dictionary(await getLocale()).locationBlock.plate;
  const hero = size === "hero";
  return (
    <div
      aria-hidden="true"
      className={`flex flex-col justify-between rounded-md border-t-2 border-navy bg-soft ${
        hero
          ? "aspect-[16/10] px-6 py-5 md:aspect-[4/5] md:px-8 md:py-7 xl:aspect-[4/3]"
          : "h-[124px] px-5 py-4 md:aspect-[3/2] md:h-auto md:px-6 md:py-5"
      }`}
    >
      <span className="t-label uppercase text-secondary">{plate}</span>
      <span
        className={`font-semibold leading-[0.85] tracking-[-0.03em] text-navy ${
          hero ? "text-[120px] md:text-[160px] xl:text-[200px]" : "text-[56px] md:text-[88px] xl:text-[120px]"
        }`}
      >
        {/* Western or Bangla digits, whichever the (localized) name uses. */}
        {loc.name.replace(/[^0-9০-৯]/g, "")}
      </span>
      {hero ? <span className="t-small text-secondary">{loc.hours}</span> : null}
    </div>
  );
}

export async function LocationBlock({ loc: source }: { loc: Location }) {
  const locale = await getLocale();
  const t = dictionary(locale).locationBlock;
  const common = dictionary(locale).common;
  const loc = await localLocation(source);
  const count = { rating: loc.rating, count: loc.reviewCount };
  return (
    <article>
      <LocationVisual loc={loc} />
      <h3 className="mt-6 t-h3 text-navy">{loc.name}</h3>
      <dl className="mt-5">
        <div className="border-t border-line py-3.5">
          <dt className="sr-only">{t.ratingTerm}</dt>
          <dd className="flex items-center gap-1.5 font-semibold text-navy">
            <span aria-hidden="true" className="inline-flex items-center gap-1.5">
              {fill("{rating}", count, locale)}
              <Star className="size-4 text-blue" />
              <span className="font-normal text-secondary">·</span>
              {fill(t.reviewsCount, count, locale)}
            </span>
            <span className="sr-only">{fill(t.ratingSpoken, count, locale)}</span>
          </dd>
        </div>
        <div className="border-t border-line py-3.5">
          <dt className="sr-only">{t.address}</dt>
          <dd>
            <address className="not-italic text-body">{loc.address}</address>
          </dd>
        </div>
        <div className="border-y border-line py-3.5">
          <dt className="sr-only">{t.hours}</dt>
          <dd className="text-body">{loc.hours}</dd>
        </div>
      </dl>
      <div className="mt-4 flex flex-wrap gap-x-8 gap-y-1">
        <TextLink href={loc.directionsUrl} external event="directions_click" placement="locations" branch={loc.id}>
          {common.getDirections}
        </TextLink>
        <TextLink href={loc.reviewsUrl} external event="google_reviews_click" placement="locations" branch={loc.id}>
          {t.seeReviews}
        </TextLink>
      </div>
    </article>
  );
}

export async function LocationsSection() {
  const locations = await getLocations();
  const locale = await getLocale();
  const t = dictionary(locale).home.locations;
  return (
    <section id="locations" aria-labelledby="locations-title" className="py-(--space-section)">
      <div className="container-page">
        <SectionIntro id="locations-title" eyebrow={t.eyebrow} title={t.title}>
          <p>{t.intro1}</p>
          <p>{t.intro2}</p>
        </SectionIntro>
        <div className="mt-(--space-intro-content) grid-page gap-y-14">
          {locations.map((loc) => (
            <div key={loc.id} className="col-span-4 md:col-span-4 xl:col-span-6">
              <LocationBlock loc={loc} />
              <div className="mt-2">
                <TextLink href={`/locations/${loc.id}`} placement="home_locations" branch={loc.id}>
                  {t.linkTo.replace("{name}", locale === "bn" ? (dictionary("bn").locationNames[loc.id] ?? loc.name) : loc.name)}
                </TextLink>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
