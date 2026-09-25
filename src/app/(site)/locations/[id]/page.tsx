import type { Metadata } from "next";
import Link from "next/link";
import { SERVICE_PAGES } from "@/content/services";
import { notFound } from "next/navigation";
import { FinalBookingCTA } from "@/components/home/FinalBookingCTA";
import { ProofFigures, RatingValue } from "@/components/pages/ProofFigures";
import { freeDeliveryFigure, sectorsFigure } from "@/components/pages/figures";
import { SectionIntro } from "@/components/home/SectionIntro";
import { FactRows } from "@/components/pages/FactRows";
import { PageHero } from "@/components/pages/PageHero";
import { ButtonLink } from "@/components/ui/Button";
import { ArrowRight, Star } from "@/components/ui/icons";
import { TextLink } from "@/components/ui/TextLink";
import { IMAGES } from "@/content/mock";
import { FREE_DELIVERY_THRESHOLD, LOCATIONS, SERVICE_AREA, WHATSAPP_URL, bookHref } from "@/content/site";
import { pageMetadata } from "@/lib/seo/page-metadata";
import { getLocations, resolveImage } from "@/lib/site-content";

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
  const loc = locations.find((l) => l.id === id);
  if (!loc) notFound();
  const other = locations.find((l) => l.id !== loc.id)!;
  const outletPhoto = await resolveImage(IMAGES.locations[loc.id]);
  return (
    <>
      <PageHero
        path={`/locations/${loc.id}`}
        crumbs={[{ label: "Home", href: "/" }, { label: "Locations", href: "/locations" }, { label: loc.name }]}
        // Search intent is "laundry / dry cleaning in Uttara Sector N"; the outlet name stays in the label.
        title={`Laundry and dry cleaning in Uttara ${loc.name}`}
        highlight={`Uttara ${loc.name}`}
        // Real outlet: never stock. Show the photo only once a verified Velto one is uploaded.
        image={outletPhoto.src ? outletPhoto : undefined}
        eyebrow={`Velto ${loc.name}`}
        aside={
          <>
            {/* This outlet's own rating: never blended with the other outlet (§21). */}
            <ProofFigures
              wide={3}
              figures={[
                {
                  value: <RatingValue rating={loc.rating} />,
                  spoken: `${loc.rating} out of 5`,
                  label: `Google rating, ${loc.reviewCount} reviews for ${loc.name}`,
                  href: loc.reviewsUrl,
                  analytics: { event: "google_reviews_click", placement: "location_hero", branch: loc.id },
                },
                sectorsFigure,
                freeDeliveryFigure,
              ]}
            />
            <p className="mt-4 t-small text-secondary">Open {loc.hours}</p>
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
              Book a Pickup
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
              Get Directions
            </ButtonLink>
          </>
        }
      >
        <p>{loc.address}</p>
        <p>
          You don&apos;t need to visit. Velto collects from your door anywhere in {SERVICE_AREA}, or you can
          drop off here.
        </p>
      </PageHero>

      <section aria-labelledby="visit-title" className="bg-warm py-(--space-section)">
        <div className="container-page grid-page gap-y-10">
          <div className="col-span-4 md:col-span-8 xl:col-span-5">
            <SectionIntro id="visit-title" eyebrow="Visit or get a pickup" title="Visiting the outlet">
              <p>Visit in person, or book a pickup from anywhere in Uttara Sectors 1–18.</p>
            </SectionIntro>
          </div>
          <div className="col-span-4 md:col-span-8 xl:col-span-6 xl:col-start-7">
            <FactRows
              rows={[
                { label: "Address", value: <address className="not-italic">{loc.address}</address> },
                { label: "Hours", value: loc.hours },
                {
                  label: "Pickup",
                  value: `From your door anywhere in ${SERVICE_AREA}. Free on orders of ${FREE_DELIVERY_THRESHOLD}+.`,
                },
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
              <TextLink href={WHATSAPP_URL} external event="whatsapp_click" placement="location_page">
                WhatsApp Velto
              </TextLink>
              <TextLink href={`/locations/${other.id}`} placement="location_page">
                {`Velto ${other.name}`}
              </TextLink>
            </div>
          </div>
        </div>
      </section>

      {/* What customers can send from this outlet: real internal links, one line each. */}
      <section aria-labelledby="outlet-services-title" className="py-(--space-section)">
        <div className="container-page grid-page gap-y-10">
          <div className="col-span-4 md:col-span-8 xl:col-span-5">
            <SectionIntro id="outlet-services-title" eyebrow="Services" title={`What you can send from ${loc.name}`}>
              <p>
                Book a pickup for any of these from anywhere in Uttara Sectors 1–18, or visit the outlet. Check the price of an
                item before you send it.
              </p>
            </SectionIntro>
            <div className="mt-6">
              <TextLink href="/pricing" placement="location_services">
                Check laundry and dry cleaning prices
              </TextLink>
            </div>
          </div>
          <ul className="col-span-4 border-t border-navy md:col-span-8 xl:col-span-6 xl:col-start-7">
            {SERVICE_PAGES.map((sv) => (
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
        title="Rather not make the trip?"
        body={<p>Book a pickup and we will collect from your door anywhere in Uttara Sectors 1–18.</p>}
        source={`${loc.id}-final`}
      />
    </>
  );
}
