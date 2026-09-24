import { ButtonLink } from "@/components/ui/Button";
import { WhatsAppIcon } from "@/components/ui/icons";
import { ResponsiveImage } from "@/components/ui/ResponsiveImage";
import { IMAGES, type ImageSlot } from "@/content/mock";
import { FREE_DELIVERY_THRESHOLD, WHATSAPP_URL, bookHref } from "@/content/site";
import { getGoogleProofLabel } from "@/lib/site-content";
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
  primary?: { href: string; label: string; helper?: string };
};

const DEFAULT_BODY = (
  <>
    <p>Tell us where to collect from, what you need cleaned and your preferred pickup time.</p>
    <p>That&apos;s enough to get the booking started.</p>
  </>
);

export async function FinalBookingCTA({
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
          {/* One decisive action; WhatsApp stays available but visibly secondary. */}
          <div className="mt-8 xl:mt-10">
            <ButtonLink
              href={primary ? primary.href : bookHref(source, service)}
              event={primary ? undefined : "book_pickup_click"}
              placement="final"
              className="w-full !h-14 !px-8 !text-[17px] md:w-auto"
            >
              {primary ? primary.label : "Book a Pickup"}
            </ButtonLink>
            <p className="mt-3 t-small text-white/80">
              {primary?.helper ?? "Send the request. We’ll confirm the pickup time with you."}
            </p>
            <a
              href={WHATSAPP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-6 inline-flex min-h-11 items-center gap-2.5 font-semibold text-white underline decoration-white/40 underline-offset-[6px] hover:decoration-white"
              data-analytics="whatsapp_click"
              data-placement="final"
            >
              <WhatsAppIcon className="size-5 text-white" />
              Or message Velto on WhatsApp
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
          </div>
          <p className="mt-10 border-t border-white/20 pt-4 t-small text-white/75">
            {await getGoogleProofLabel()} · Free pickup &amp; delivery on orders of {FREE_DELIVERY_THRESHOLD}+
          </p>
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
