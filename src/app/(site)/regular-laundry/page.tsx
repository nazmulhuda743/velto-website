import { pageMetadata } from "@/lib/seo/page-metadata";
import { FAQ, faqItems } from "@/components/home/FAQ";
import { FinalBookingCTA } from "@/components/home/FinalBookingCTA";
import { SectionIntro } from "@/components/home/SectionIntro";
import { PageHero } from "@/components/pages/PageHero";
import { ProcessSteps } from "@/components/pages/ProcessSteps";
import { ButtonLink, WhatsAppButton } from "@/components/ui/Button";
import { TextLink } from "@/components/ui/TextLink";
import { IMAGES } from "@/content/mock";
import { FREE_DELIVERY_THRESHOLD, REGULAR_FREE_DELIVERY_THRESHOLD, WHATSAPP_URL, bookHref } from "@/content/site";

export const generateMetadata = () => pageMetadata("/regular-laundry");

const setUpHref = (source: string) => bookHref(source, "regular-laundry");

export default function RegularLaundryPage() {
  return (
    <>
      <PageHero
        crumbs={[{ label: "Home", href: "/" }, { label: "Regular Laundry" }]}
        title="A regular laundry pickup, so the week takes care of itself."
        image={IMAGES.regular}
        aside={
          // The one reason to choose a routine over one-off orders, stated where the decision is made.
          <div className="border-t border-line pt-4">
            <p className="text-[28px] font-semibold leading-none tracking-[-0.03em] text-navy tabular-nums md:text-[32px]">
              {REGULAR_FREE_DELIVERY_THRESHOLD}+
            </p>
            <p className="mt-1.5 max-w-[34ch] t-small text-secondary">
              Free pickup &amp; delivery on a fixed weekly or fortnightly pickup. One-off orders qualify
              from {FREE_DELIVERY_THRESHOLD}+.
            </p>
          </div>
        }
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
              {/* Icon only below 375px so the longer primary label keeps its room. */}
              <span className="max-[374px]:sr-only">WhatsApp</span>
            </WhatsAppButton>
          </>
        }
      >
        <p>
          Regular laundry and ironing can be arranged as recurring pickups, so you don&apos;t need
          to book from scratch every time. Agree a day once, put the clothes out, and they come back
          ready to wear.
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
                Laundry and ironing can go in the same pickup, so the week&apos;s clothes travel together
                and it&apos;s easier to reach {REGULAR_FREE_DELIVERY_THRESHOLD}+.
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
        primary={{
          href: setUpHref("regular-laundry-final"),
          label: "Set Up Regular Pickup",
          helper: "Send the request. We\u2019ll agree the pickup day with you.",
          event: "regular_laundry_interest",
        }}
      />
    </>
  );
}
