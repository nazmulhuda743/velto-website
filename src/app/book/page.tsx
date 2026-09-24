import type { Metadata } from "next";
import { BookingForm } from "@/components/forms/BookingForm";
import { Breadcrumbs } from "@/components/pages/Breadcrumbs";
import { ProcessSteps } from "@/components/pages/ProcessSteps";
import { WhatsAppButton } from "@/components/ui/Button";
import { FREE_DELIVERY_THRESHOLD, SERVICE_AREA, WHATSAPP_URL } from "@/content/site";

export const metadata: Metadata = {
  title: "Book a Pickup — Velto, Uttara",
  description: "Book a laundry or dry cleaning pickup from your door in Uttara Sectors 1–18.",
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** Primary booking route (spec §22). The mobile conversion bar is intentionally absent here. */
export default async function BookPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const service = one(params.service);
  const preview =
    process.env.NODE_ENV !== "production" && (one(params.preview) === "success" || one(params.preview) === "error")
      ? (one(params.preview) as "success" | "error")
      : undefined;

  return (
    <section aria-labelledby="page-title" className="pb-(--space-section) pt-6 md:pt-10 xl:pt-12">
      <div className="container-page">
        <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Book a Pickup" }]} />
        <div className="mt-6 grid-page gap-y-12 md:mt-8">
          <div className="col-span-4 md:col-span-8 xl:col-span-7">
            <h1 id="page-title" className="t-h1 text-navy">
              Book a pickup
            </h1>
            <p className="mt-4 max-w-[52ch] t-body text-body md:t-body-lg">
              Tell us where to collect from, what you need cleaned and when suits you.
            </p>
            <div className="mt-(--space-intro-content)">
              <BookingForm initialService={service} regular={service === "regular-laundry"} preview={preview} />
            </div>
          </div>

          <aside aria-labelledby="next-title" className="col-span-4 md:col-span-8 xl:col-span-4 xl:col-start-9">
            <div className="xl:sticky xl:top-[100px]">
              <h2 id="next-title" className="t-label uppercase text-navy">
                What happens next
              </h2>
              <ProcessSteps
                className="mt-4"
                steps={[
                  { title: "We confirm your pickup", copy: "The Velto team gets in touch to confirm the details." },
                  { title: "We collect", copy: `From your door anywhere in ${SERVICE_AREA}.` },
                  { title: "It comes back ready", copy: "Checked in, cleaned, finished, checked again and packed." },
                ]}
              />
              <p className="mt-6 t-small text-secondary">
                Free pickup &amp; delivery on orders of {FREE_DELIVERY_THRESHOLD}+. For smaller orders,
                the applicable charge is shown before booking.
              </p>
              <div className="mt-8 border-t border-line pt-6">
                <p className="font-semibold text-navy">Prefer to message?</p>
                <p className="mt-1 t-small text-secondary">Send the details or a photo on WhatsApp instead.</p>
                <WhatsAppButton href={WHATSAPP_URL} placement="booking_aside" className="mt-4" />
              </div>
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}
