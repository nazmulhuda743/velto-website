import { pageMetadata } from "@/lib/seo/page-metadata";
import { ProofFigures } from "@/components/pages/ProofFigures";
import { freeDeliveryFigure, sectorsFigure, turnaroundFigure } from "@/components/pages/figures";
import { FAQ, faqItems } from "@/components/home/FAQ";
import { FinalBookingCTA } from "@/components/home/FinalBookingCTA";
import { SectionIntro } from "@/components/home/SectionIntro";
import { OperationalProcess } from "@/components/pages/OperationalProcess";
import { PageHero } from "@/components/pages/PageHero";
import { ProcessSteps } from "@/components/pages/ProcessSteps";
import { ButtonLink, WhatsAppButton } from "@/components/ui/Button";
import { FREE_DELIVERY_THRESHOLD, WHATSAPP_URL, bookHref } from "@/content/site";

export const generateMetadata = () => pageMetadata("/how-it-works");

export default function HowItWorksPage() {
  return (
    <>
      <PageHero
        crumbs={[{ label: "Home", href: "/" }, { label: "How It Works" }]}
        title="From your door and back again."
        eyebrow="How it works"
        highlight="back again"
        aside={<ProofFigures wide={3} figures={[sectorsFigure, turnaroundFigure, freeDeliveryFigure]} />}
        actions={
          <>
            <ButtonLink
              href={bookHref("how-it-works-page")}
              event="book_pickup_click"
              placement="how_hero"
              className="flex-[1.45] max-md:px-4 md:flex-none"
            >
              Book a Pickup
            </ButtonLink>
            <WhatsAppButton href={WHATSAPP_URL} placement="how_hero" className="flex-1 max-md:px-3 md:flex-none">
              WhatsApp
            </WhatsAppButton>
          </>
        }
      >
        <p>
          You book, we collect. Everything in between follows the same steps for every order, so you
          know what happens to your clothes while they are with us.
        </p>
      </PageHero>

      <section aria-labelledby="booking-steps-title" className="bg-warm py-(--space-section)">
        <div className="container-page grid-page gap-y-10">
          <div className="col-span-4 md:col-span-8 xl:col-span-5">
            <SectionIntro id="booking-steps-title" eyebrow="Your side" title="Before and after we have it">
              <p>
                Pickup and delivery cover Uttara Sectors 1–18. Orders of {FREE_DELIVERY_THRESHOLD}+
                qualify for free pickup and delivery.
              </p>
            </SectionIntro>
          </div>
          <div className="col-span-4 md:col-span-8 xl:col-span-6 xl:col-start-7">
            <ProcessSteps
              steps={[
                { title: "Book", copy: "Book a pickup online or message Velto on WhatsApp. Tell us where to collect from and what you are sending." },
                { title: "Pickup", copy: "We collect the order from your address." },
                { title: "At Velto", copy: "Your order is checked in, tagged, cleaned, finished and checked again. Every step is below." },
                { title: "Return", copy: "Your finished order is packed and delivered back to your address." },
              ]}
            />
          </div>
        </div>
      </section>

      <OperationalProcess
        title="What happens once your order reaches us"
        intro={
          <p>
            The same ten steps for every order, in four stages. Special garments and household items
            may add time where extra care is needed.
          </p>
        }
      />

      <FAQ items={faqItems("turnaround", "area", "freeDelivery", "stains", "express")} className="bg-soft" />

      <FinalBookingCTA id="book" source="how-it-works-final" />
    </>
  );
}
