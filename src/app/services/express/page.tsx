import type { Metadata } from "next";
import { MobileConversionBar } from "@/components/layout/MobileConversionBar";
import { PageHero } from "@/components/pages/PageHero";
import { ButtonLink, WhatsAppButton } from "@/components/ui/Button";
import { IMAGES } from "@/content/mock";
import { SERVICE_AREA, WHATSAPP_URL, bookHref } from "@/content/site";

export const metadata: Metadata = {
  title: "Express Laundry & Dry Cleaning in Uttara — Velto",
  description:
    "Need laundry or garment care sooner? Express may be available depending on the service, item and current workload. Check availability with Velto before relying on an urgent turnaround.",
  alternates: { canonical: "/services/express" },
};

const FINAL_ID = "book";

export default function ExpressServicePage() {
  const book = bookHref("express-service-page");

  return (
    <>
      <PageHero
        crumbs={[{ label: "Home", href: "/" }, { label: "Services", href: "/services" }, { label: "Express" }]}
        title="Need it sooner? Ask about Express."
        image={IMAGES.washAndIron}
        actions={
          <>
            <ButtonLink href={book} event="book_pickup_click" placement="service_hero" className="flex-[1.45] max-md:px-4 md:flex-none">
              Book a Pickup
            </ButtonLink>
            <WhatsAppButton href={WHATSAPP_URL} placement="service_hero" className="flex-1 max-md:px-3 md:flex-none">
              Check on WhatsApp
            </WhatsAppButton>
          </>
        }
      >
        <p>
          Express is an availability option, not a promise attached to every order. Whether Velto can do it depends on the service, the item and the current workload.
        </p>
        <p>
          Tell us what you need cleaned and when you need it back. We’ll confirm what is realistic before you rely on the faster timing.
        </p>
      </PageHero>

      <section aria-labelledby="express-works" className="bg-warm py-(--space-section)">
        <div className="container-page grid-page gap-y-10">
          <div className="col-span-4 md:col-span-8 xl:col-span-5">
            <p className="t-label uppercase text-blue">How it works</p>
            <h2 id="express-works" className="mt-3 t-h2 max-w-[16ch] text-navy">
              Urgent first. Confirmation second.
            </h2>
          </div>
          <div className="col-span-4 md:col-span-8 xl:col-span-6 xl:col-start-7">
            <div className="border-t border-navy">
              {[
                ["1. Tell us the job", "Share the service or items and the time you need them back."],
                ["2. Velto checks availability", "The team checks whether the service, item and current workload can support an Express turnaround."],
                ["3. We confirm before you depend on it", "If Express is possible, Velto confirms the timing. If it is not, you get the realistic standard expectation instead."],
              ].map(([title, copy]) => (
                <div key={title} className="border-b border-line py-5">
                  <h3 className="t-h4 text-navy">{title}</h3>
                  <p className="mt-2 max-w-[58ch] text-secondary">{copy}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section aria-labelledby="express-know" className="py-(--space-section)">
        <div className="container-page grid-page gap-y-10">
          <div className="col-span-4 md:col-span-8 xl:col-span-5">
            <p className="t-label uppercase text-blue">Good to know</p>
            <h2 id="express-know" className="mt-3 t-h2 max-w-[16ch] text-navy">
              Faster only when the job allows it.
            </h2>
          </div>
          <div className="col-span-4 md:col-span-8 xl:col-span-6 xl:col-start-7">
            <ul className="space-y-4 text-body">
              <li className="border-b border-line pb-4">Pickup coverage remains {SERVICE_AREA} for the confirmed core service area.</li>
              <li className="border-b border-line pb-4">Special garments, household items and unusual conditions may need more time even when the request is urgent.</li>
              <li className="border-b border-line pb-4">Do not treat an Express request as confirmed until Velto confirms the timing.</li>
            </ul>
          </div>
        </div>
      </section>

      <section id={FINAL_ID} aria-labelledby="express-book" className="bg-navy py-(--space-section) text-white">
        <div className="container-page grid-page gap-y-8">
          <div className="col-span-4 md:col-span-8 xl:col-span-7">
            <p className="t-label uppercase text-white/60">Need it sooner?</p>
            <h2 id="express-book" className="mt-3 t-h2 max-w-[18ch] text-white">
              Send the pickup request and tell us the deadline.
            </h2>
            <p className="mt-4 max-w-[58ch] text-white/80">
              Velto will confirm whether the requested Express timing is realistic for the items you are sending.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <ButtonLink href={book} event="book_pickup_click" placement="service_final">
                Book a Pickup
              </ButtonLink>
              <WhatsAppButton href={WHATSAPP_URL} placement="service_final" inverse>
                Check on WhatsApp
              </WhatsAppButton>
            </div>
          </div>
        </div>
      </section>

      <MobileConversionBar finalSectionId={FINAL_ID} source="express-service-sticky" />
    </>
  );
}
