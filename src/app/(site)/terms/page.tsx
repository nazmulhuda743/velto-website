import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms | Velto Premium Laundry",
  description: "Website and service terms for Velto Premium Laundry bookings, quotes and service information.",
  alternates: { canonical: "/terms" },
  robots: { index: false, follow: true },
};

export default function TermsPage() {
  return (
    <article className="container-page py-16 md:py-24">
      <div className="max-w-3xl">
        <p className="t-label uppercase text-blue">Terms</p>
        <h1 className="mt-3 t-h1 text-navy">Website and service terms</h1>
        <p className="mt-4 t-body-lg text-body">Last updated: 24 September 2026</p>

        <div className="mt-10 space-y-10 text-body">
          <section>
            <h2 className="t-h3 text-navy">Bookings and confirmation</h2>
            <p className="mt-3">
              A website booking or quote request is only successful when the website returns a real confirmation or Velto confirms it through its normal communication process. A failed form submission should not be treated as a confirmed pickup.
            </p>
          </section>

          <section>
            <h2 className="t-h3 text-navy">Service area and pickup</h2>
            <p className="mt-3">
              Velto’s confirmed core service area is Uttara, Sectors 1–18. Requests outside that area may be reviewed separately and are not automatically promised.
            </p>
            <p className="mt-3">
              Orders of ৳499 or more qualify for free pickup and delivery. Orders below that threshold may have an applicable pickup or delivery charge. Where the exact charge depends on current operating rules, Velto will confirm it rather than the website inventing a fixed amount.
            </p>
          </section>

          <section>
            <h2 className="t-h3 text-navy">Pricing and quotes</h2>
            <p className="mt-3">
              Website pricing should come from Velto’s approved operational pricing source. For curtains, carpets, blankets, comforters or other variable jobs, dimensions, material, type, condition or inspection may affect the applicable price. A website estimate or quote request is not an exact final amount where those details still need verification.
            </p>
          </section>

          <section>
            <h2 className="t-h3 text-navy">Turnaround</h2>
            <p className="mt-3">
              General service is usually around 48 hours. Wash & Iron and Dry Cleaning are usually around 72 hours. Special garments, household items, unusual conditions, workload and express requests can require different timing. These are planning expectations, not absolute delivery guarantees.
            </p>
            <p className="mt-3">
              Express service may be available depending on the service, item and current workload; availability must not be assumed until confirmed.
            </p>
          </section>

          <section>
            <h2 className="t-h3 text-navy">Garments, stains and results</h2>
            <p className="mt-3">
              Velto uses defined intake, identification, stain-handling and quality-control procedures, but the website does not promise perfect cleaning, zero risk or guaranteed stain removal. Some garments or stains may require extra attention or different handling after assessment.
            </p>
          </section>

          <section>
            <h2 className="t-h3 text-navy">Website information</h2>
            <p className="mt-3">
              Velto may update website copy, operational information, pricing presentation, service availability or these terms when the underlying service changes. If the website and a current confirmed operational instruction conflict, the current confirmed service instruction applies.
            </p>
          </section>

          <section>
            <h2 className="t-h3 text-navy">Questions</h2>
            <p className="mt-3">
              Use the WhatsApp or contact options on this website if you need clarification before placing a booking or handing over an item.
            </p>
          </section>
        </div>
      </div>
    </article>
  );
}
