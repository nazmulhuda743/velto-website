import type { Metadata } from "next";
import Link from "@/components/i18n/Link";
import { servicePages } from "@/content/services";
import { notFound } from "next/navigation";
import { FinalBookingCTA } from "@/components/home/FinalBookingCTA";
import { ProofFigures, RatingValue } from "@/components/pages/ProofFigures";
import { pageFigures } from "@/components/pages/figures";
import { SectionIntro } from "@/components/home/SectionIntro";
import { FactRows } from "@/components/pages/FactRows";
import { PageHero } from "@/components/pages/PageHero";
import { ButtonLink } from "@/components/ui/Button";
import { ArrowRight, Star } from "@/components/ui/icons";
import { TextLink } from "@/components/ui/TextLink";
import { IMAGES } from "@/content/mock";
import { FREE_DELIVERY_THRESHOLD, LOCATIONS, WHATSAPP_URL, bookHref } from "@/content/site";
import { pageMetadata } from "@/lib/seo/page-metadata";
import { getLocations, resolveImage } from "@/lib/site-content";
import { LocationPlate } from "@/components/home/LocationsSection";
import { dictionary } from "@/content/i18n";
import { pageText } from "@/content/i18n/pages";
import { fill, localDigits } from "@/lib/i18n/config";
import { getLocale, localLocation, serviceArea } from "@/lib/i18n/server";

// Unknown slugs 404 via notFound(). dynamicParams=false would also 404 the real pages
// after an admin save revalidates the layout (Next.js NoFallbackError on regeneration).
export const dynamicParams = true;

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
  const found = locations.find((l) => l.id === id);
  if (!found) notFound();
  const locale = await getLocale();
  const d = dictionary(locale);
  const t = pageText(locale).locationPage;
  const f = (template: string, vars: Record<string, string | number>) => fill(template, vars, locale);
  const fig = await pageFigures();
  // Name and hours in the page language; address, links and rating data as stored.
  const loc = await localLocation(found);
  const other = await localLocation(locations.find((l) => l.id !== loc.id)!);
  const rating = localDigits(loc.rating, locale);
  const area = serviceArea(locale);
  const outletPhoto = await resolveImage(IMAGES.locations[loc.id]);
  return (
    <>
      <PageHero
        path={`/locations/${loc.id}`}
        crumbs={[{ label: d.common.home, href: "/" }, { label: d.nav.locations, href: "/locations" }, { label: loc.name }]}
        // Search intent is "laundry / dry cleaning in Uttara Sector N"; the outlet name stays in the label.
        title={f(t.title, { name: loc.name })}
        highlight={f(t.highlight, { name: loc.name })}
        // Real outlet: never stock. Show the photo only once a verified Velto one is uploaded.
        image={outletPhoto.src ? outletPhoto : undefined}
        visual={<LocationPlate loc={loc} size="hero" />}
        eyebrow={f(t.eyebrow, { name: loc.name })}
        aside={
          <>
            {/* This outlet's own rating: never blended with the other outlet (§21). */}
            <ProofFigures
              wide={3}
              figures={[
                {
                  value: <RatingValue rating={rating} />,
                  spoken: f(d.home.hero.ratingSpoken, { rating: loc.rating }),
                  label: f(pageText(locale).figures.locationRatingLabel, { reviews: loc.reviewCount, name: loc.name }),
                  href: loc.reviewsUrl,
                  analytics: { event: "google_reviews_click", placement: "location_hero", branch: loc.id },
                },
                fig.sectors,
                fig.freeDelivery,
              ]}
            />
            <p className="mt-4 t-small text-secondary">{f(t.open, { hours: loc.hours })}</p>
          </>
        }
        actions={
          // Pickup is the default way to use Velto; the outlet is an option.
          <>
            <ButtonLink
              href={bookHref(`${loc.id}-page`)}
              event="book_pickup_click"
              placement="location_hero"
              className="flex-1 max-md:px-4 md:flex-none"
            >
              {d.common.bookPickup}
            </ButtonLink>
            <ButtonLink
              href={loc.directionsUrl}
              target="_blank"
              rel="noopener noreferrer"
              variant="secondary"
              event="directions_click"
              placement="location_hero"
              className="flex-1 max-md:px-4 md:flex-none"
            >
              {d.common.getDirections}
            </ButtonLink>
          </>
        }
      >
        <p>{loc.address}</p>
        <p>{f(t.noVisit, { area })}</p>
      </PageHero>

      <section aria-labelledby="visit-title" className="bg-warm py-(--space-section)">
        <div className="container-page grid-page gap-y-10">
          <div className="col-span-4 md:col-span-8 xl:col-span-5">
            <SectionIntro id="visit-title" eyebrow={t.visitEyebrow} title={t.visitTitle}>
              <p>{t.visitIntro}</p>
            </SectionIntro>
          </div>
          <div className="col-span-4 md:col-span-8 xl:col-span-6 xl:col-start-7">
            <FactRows
              rows={[
                { label: t.address, value: <address className="not-italic">{loc.address}</address> },
                { label: t.hours, value: loc.hours },
                {
                  label: t.pickup,
                  value: f(t.pickupValue, { area, amount: FREE_DELIVERY_THRESHOLD }),
                },
                {
                  label: t.googleRating,
                  // TODO_VERIFY: review counts before launch (spec §36). Never merged across branches.
                  value: (
                    <span className="inline-flex items-center gap-1.5">
                      <span aria-hidden="true" className="inline-flex items-center gap-1.5">
                        {rating}
                        <Star className="size-4 text-blue" />
                        {f(t.reviewsCount, { count: loc.reviewCount })}
                      </span>
                      <span className="sr-only">
                        {f(t.ratingSpoken, { rating: loc.rating, count: loc.reviewCount, name: loc.name })}
                      </span>
                    </span>
                  ),
                },
              ]}
            />
            <div className="mt-6 flex flex-wrap gap-x-8 gap-y-1">
              <TextLink href={loc.reviewsUrl} external event="google_reviews_click" placement="location_page" branch={loc.id}>
                {d.locationBlock.seeReviews}
              </TextLink>
              <TextLink href={WHATSAPP_URL} external event="whatsapp_click" placement="location_page">
                {d.common.whatsappVelto}
              </TextLink>
              <TextLink href={`/locations/${other.id}`} placement="location_page">
                {f(t.otherOutlet, { name: other.name })}
              </TextLink>
            </div>
          </div>
        </div>
      </section>

      {/* What customers can send from this outlet: real internal links, one line each. */}
      <section aria-labelledby="outlet-services-title" className="py-(--space-section)">
        <div className="container-page grid-page gap-y-10">
          <div className="col-span-4 md:col-span-8 xl:col-span-5">
            <SectionIntro id="outlet-services-title" eyebrow={t.servicesEyebrow} title={f(t.servicesTitle, { name: loc.name })}>
              <p>{t.servicesIntro}</p>
            </SectionIntro>
            <div className="mt-6">
              <TextLink href="/pricing" placement="location_services">
                {t.checkPrices}
              </TextLink>
            </div>
          </div>
          <ul className="col-span-4 border-t border-navy md:col-span-8 xl:col-span-6 xl:col-start-7">
            {servicePages(locale).map((sv) => (
              <li key={sv.slug} className="border-b border-line">
                <Link href={`/services/${sv.slug}`} className="group flex items-start justify-between gap-6 py-4">
                  <span>
                    <span className="block t-h4 text-navy group-hover:text-blue">{sv.name}</span>
                    <span className="mt-1 block t-small text-secondary">{sv.whenToChoose}</span>
                  </span>
                  <ArrowRight className="mt-1.5 size-4 shrink-0 text-action" />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <FinalBookingCTA
        id="book"
        title={t.finalTitle}
        body={<p>{t.finalBody}</p>}
        source={`${loc.id}-final`}
      />
    </>
  );
}
