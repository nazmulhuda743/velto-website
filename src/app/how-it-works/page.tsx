import type { Metadata } from "next";
import { FAQ, faqItems } from "@/components/home/FAQ";
import { FinalBookingCTA } from "@/components/home/FinalBookingCTA";
import { ProcessStory } from "@/components/home/ProcessStory";
import { SectionIntro } from "@/components/home/SectionIntro";
import { PageHero } from "@/components/pages/PageHero";
import { ProcessSteps } from "@/components/pages/ProcessSteps";
import { ButtonLink, WhatsAppButton } from "@/components/ui/Button";
import { FREE_DELIVERY_THRESHOLD, WHATSAPP_URL, bookHref } from "@/content/site";

export const metadata: Metadata = {
  title: "How It Works — Velto Premium Laundry, Uttara",
  description:
    "From booking to return: how Velto collects, checks in, tags, cleans, checks and returns your order in Uttara.",
};

export default function HowItWorksPage() {
  return (
    <>
      <PageHero
        crumbs={[{ label: "Home", href: "/" }, { label: "How It Works" }]}
        title="From your door and back again."
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
            <SectionIntro id="booking-steps-title" title="Before and after we have it">
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

      <ProcessStory
        title="What happens once your order reaches us"
        intro={
          <p>
            Eight steps, the same for every order. Special garments and household items may add time
            where extra care is needed.
          </p>
        }
      />

      <FAQ items={faqItems("turnaround", "area", "freeDelivery", "stains", "express")} className="bg-soft" />

      <FinalBookingCTA id="book" source="how-it-works-final" />
    </>
  );
}
