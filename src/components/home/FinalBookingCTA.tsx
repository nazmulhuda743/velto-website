import { ButtonLink, WhatsAppButton } from "@/components/ui/Button";
import { ResponsiveImage } from "@/components/ui/ResponsiveImage";
import { IMAGES, type ImageSlot } from "@/content/mock";
import { FREE_DELIVERY_THRESHOLD, GOOGLE_PROOF, SERVICE_AREA, WHATSAPP_URL, bookHref } from "@/content/site";
import { ProofList } from "./ProofLine";
import { SectionIntro } from "./SectionIntro";

type FinalBookingCTAProps = {
  id: string;
  title?: string;
  body?: React.ReactNode;
  /** Booking source for attribution (spec §22). */
  source?: string;
  service?: string;
  image?: ImageSlot;
  /** Overrides the primary action (e.g. Request a Quote on quote-first pages). */
  primary?: { href: string; label: string };
};

const DEFAULT_BODY = (
  <>
    <p>Tell us where to collect from, what you need cleaned and your preferred pickup time.</p>
    <p>That&apos;s enough to get the booking started.</p>
  </>
);

export function FinalBookingCTA({
  id,
  title = "Ready to send it?",
  body = DEFAULT_BODY,
  source = "home_final",
  service,
  image = IMAGES.final,
  primary,
}: FinalBookingCTAProps) {
  return (
    <section id={id} aria-labelledby="final-title" className="on-navy bg-navy py-(--space-section) text-white">
      <div className="container-page grid-page gap-y-12">
        <div className="col-span-4 md:col-span-4 md:col-start-5 md:self-center xl:col-span-5 xl:col-start-8 xl:row-start-1">
          <SectionIntro id="final-title" title={title} inverse>
            {body}
          </SectionIntro>
          <div className="mt-8 flex flex-col gap-3 md:flex-row md:flex-wrap xl:mt-10">
            {primary ? (
              <ButtonLink href={primary.href} placement="final">
                {primary.label}
              </ButtonLink>
            ) : (
              <ButtonLink href={bookHref(source, service)} event="book_pickup_click" placement="final">
                Book a Pickup
              </ButtonLink>
            )}
            <WhatsAppButton href={WHATSAPP_URL} placement="final" inverse />
          </div>
          <ProofList
            inverse
            className="mt-10"
            items={[
              GOOGLE_PROOF.label,
              `Serving ${SERVICE_AREA}`,
              `Free pickup & delivery on orders of ${FREE_DELIVERY_THRESHOLD}+`,
            ]}
          />
        </div>
        <div className="col-span-4 md:col-span-4 md:col-start-1 md:row-start-1 xl:col-span-7">
          <ResponsiveImage
            image={image}
            tone="navy"
            aspect="aspect-[4/3] md:aspect-[4/5] xl:aspect-[7/6]"
            sizes="(min-width: 1200px) 720px, (min-width: 768px) 50vw, 100vw"
          />
        </div>
      </div>
    </section>
  );
}
