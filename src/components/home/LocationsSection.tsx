import { Star } from "@/components/ui/icons";
import { TextLink } from "@/components/ui/TextLink";
import { mapEmbedUrl, type Location } from "@/content/site";
import { getLocations } from "@/lib/site-content";
import { dictionary } from "@/content/i18n";
import { fill } from "@/lib/i18n/config";
import { getLocale, localLocation } from "@/lib/i18n/server";
import { OutletMap } from "./OutletMap";
import { SectionIntro } from "./SectionIntro";

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
      {/* The outlet's own Google Business Profile, as an interactive map (the photo lives on its location page). */}
      <OutletMap
        src={mapEmbedUrl(source.mapCid, locale)}
        title={fill(t.mapTitle, { name: loc.name }, locale)}
        showLabel={t.mapShow}
        note={t.mapNote}
      />
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

/**
 * Homepage outlet: the same verified facts as LocationBlock (rating, address, hours, links),
 * without the map panel, so both outlets sit side by side. Maps open from Get Directions;
 * the interactive map stays on /locations.
 */
async function HomeOutlet({ loc: source }: { loc: Location }) {
  const locale = await getLocale();
  const d = dictionary(locale);
  const t = d.locationBlock;
  const loc = await localLocation(source);
  const count = { rating: loc.rating, count: loc.reviewCount };
  return (
    <article className="border-t border-navy pt-5">
      <h3 className="t-h3 text-navy">{loc.name}</h3>
      <dl className="mt-3 space-y-1.5">
        <div>
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
        <div>
          <dt className="sr-only">{t.address}</dt>
          <dd>
            <address className="not-italic text-body">{loc.address}</address>
          </dd>
        </div>
        <div>
          <dt className="sr-only">{t.hours}</dt>
          <dd className="text-secondary">{loc.hours}</dd>
        </div>
      </dl>
      <div className="mt-3 flex flex-wrap gap-x-6 gap-y-0 t-small">
        <TextLink href={loc.directionsUrl} external event="directions_click" placement="locations" branch={loc.id}>
          {d.common.getDirections}
        </TextLink>
        <TextLink href={loc.reviewsUrl} external event="google_reviews_click" placement="locations" branch={loc.id}>
          {t.seeReviews}
        </TextLink>
        <TextLink href={`/locations/${loc.id}`} placement="home_locations" branch={loc.id}>
          {d.home.locations.linkTo.replace("{name}", loc.name)}
        </TextLink>
      </div>
    </article>
  );
}

export async function LocationsSection() {
  const locations = await getLocations();
  const t = dictionary(await getLocale()).home.locations;
  return (
    <section id="locations" aria-labelledby="locations-title" className="py-(--space-section)">
      <div className="container-page">
        <SectionIntro id="locations-title" title={t.title}>
          <p className="[text-wrap:pretty]">{t.intro2}</p>
        </SectionIntro>
        <div className="mt-(--space-intro-content) grid-page gap-y-10">
          {locations.map((loc) => (
            <div key={loc.id} className="col-span-4 md:col-span-4 xl:col-span-6">
              <HomeOutlet loc={loc} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
