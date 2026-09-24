import type { Metadata } from "next";
import { FAQ, faqItems } from "@/components/home/FAQ";
import { FinalBookingCTA } from "@/components/home/FinalBookingCTA";
import { SectionIntro } from "@/components/home/SectionIntro";
import { PageHero } from "@/components/pages/PageHero";
import { ProcessSteps } from "@/components/pages/ProcessSteps";
import { ButtonLink, WhatsAppButton } from "@/components/ui/Button";
import { TextLink } from "@/components/ui/TextLink";
import { IMAGES } from "@/content/mock";
import { FREE_DELIVERY_THRESHOLD, WHATSAPP_URL, bookHref } from "@/content/site";

export const metadata: Metadata = {
  title: "Regular Laundry Pickup — Velto, Uttara",
  description:
    "Set up a recurring laundry and ironing pickup in Uttara so you don't need to book from scratch every week.",
};

const setUpHref = (source: string) => bookHref(source, "regular-laundry");

export default function RegularLaundryPage() {
  return (
    <>
      <PageHero
        crumbs={[{ label: "Home", href: "/" }, { label: "Regular Laundry" }]}
        title="A regular laundry pickup, so the week takes care of itself."
        image={IMAGES.regular}
        actions={
          <>
            <ButtonLink
              href={setUpHref("regular-laundry-page")}
              event="regular_laundry_interest"
              placement="regular_hero"
              className="flex-[1.45] max-md:px-4 md:flex-none"
            >
              Set Up Regular Pickup
            </ButtonLink>
            <WhatsAppButton href={WHATSAPP_URL} placement="regular_hero" className="flex-1 max-md:px-3 md:flex-none">
              WhatsApp
            </WhatsAppButton>
          </>
        }
      >
        <p>
          Regular laundry and ironing can be arranged as recurring pickups, so you don&apos;t need
          to book from scratch every time.
        </p>
      </PageHero>

      <section aria-labelledby="regular-how-title" className="bg-warm py-(--space-section)">
        <div className="container-page grid-page gap-y-10">
          <div className="col-span-4 md:col-span-8 xl:col-span-5">
            <SectionIntro id="regular-how-title" title="How it works">
              <p>
                {/* TODO_VERIFY: recurring pickup rules beyond confirmed availability (spec §36). */}
                The details of your schedule are agreed with you when you set it up.
              </p>
            </SectionIntro>
          </div>
          <div className="col-span-4 md:col-span-8 xl:col-span-6 xl:col-start-7">
            <ProcessSteps
              steps={[
                { title: "Tell us what you usually send", copy: "Laundry, ironing or both, and roughly how much." },
                { title: "Agree a pickup routine", copy: "Tell us which day suits you. We confirm the schedule with you." },
                { title: "We collect and return", copy: "Each order is checked in, cleaned, finished, checked again and packed, like any other." },
              ]}
            />
          </div>
        </div>
      </section>

      <section aria-labelledby="regular-save-title" className="py-(--space-section)">
        <div className="container-page grid-page gap-y-8">
          <div className="col-span-4 md:col-span-8 xl:col-span-5">
            <SectionIntro id="regular-save-title" title="Put the week together.">
              <p>
                Orders of {FREE_DELIVERY_THRESHOLD}+ qualify for free pickup and delivery. One weekly
                pickup of everything is usually simpler than several small ones.
              </p>
            </SectionIntro>
          </div>
          <div className="col-span-4 flex flex-col gap-4 md:col-span-8 xl:col-span-6 xl:col-start-7 xl:justify-center">
            <TextLink href="/services/wash-and-iron" placement="regular_services">
              Wash &amp; Iron
            </TextLink>
            <TextLink href="/services/ironing" placement="regular_services">
              Ironing
            </TextLink>
            <TextLink href="/pricing" placement="regular_services">
              Check item prices
            </TextLink>
          </div>
        </div>
      </section>

      <FAQ items={faqItems("turnaround", "freeDelivery", "area")} className="bg-soft" />

      <FinalBookingCTA
        id="book"
        title="Set up your regular pickup."
        body={<p>Tell us where to collect from and which day suits you. We will confirm the routine with you.</p>}
        source="regular-laundry-final"
        primary={{ href: setUpHref("regular-laundry-final"), label: "Set Up Regular Pickup" }}
      />
    </>
  );
}
