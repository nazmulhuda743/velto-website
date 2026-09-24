import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy | Velto Premium Laundry",
  description: "How Velto handles information submitted through its website, booking and quote forms.",
  alternates: { canonical: "/privacy" },
  robots: { index: false, follow: true },
};

export default function PrivacyPage() {
  return (
    <article className="container-page py-16 md:py-24">
      <div className="max-w-3xl">
        <p className="t-label uppercase text-blue">Privacy</p>
        <h1 className="mt-3 t-h1 text-navy">How website information is handled</h1>
        <p className="mt-4 t-body-lg text-body">Last updated: 24 September 2026</p>

        <div className="mt-10 space-y-10 text-body">
          <section>
            <h2 className="t-h3 text-navy">Information you provide</h2>
            <p className="mt-3">
              When you book a pickup or request a quote, Velto may receive the details needed to respond and operate the service, such as your name, phone or WhatsApp number, area, address, selected service, pickup preference and notes.
            </p>
            <p className="mt-3">
              Household quote forms may also ask for approximate quantities or dimensions. Optional photo handling may be enabled where it is useful for assessing a quote; photos are not treated as required unless the form clearly says otherwise.
            </p>
          </section>

          <section>
            <h2 className="t-h3 text-navy">Campaign and website information</h2>
            <p className="mt-3">
              The website can carry acquisition information such as source, medium, campaign, ad or content reference, landing page, selected service and supported advertising click identifiers with a booking or quote request. This helps Velto understand which marketing activity led to a real enquiry.
            </p>
            <p className="mt-3">
              When analytics or advertising measurement is enabled, those tools may also collect normal website usage information and may use cookies or similar identifiers according to their own operation.
            </p>
          </section>

          <section>
            <h2 className="t-h3 text-navy">How the information is used</h2>
            <ul className="mt-3 list-disc space-y-2 pl-5">
              <li>to respond to booking and quote requests;</li>
              <li>to coordinate pickup, service and customer communication;</li>
              <li>to prevent duplicate or abusive submissions;</li>
              <li>to understand website and campaign performance;</li>
              <li>to investigate service or website problems when necessary.</li>
            </ul>
          </section>

          <section>
            <h2 className="t-h3 text-navy">Where information goes</h2>
            <p className="mt-3">
              The website is designed as the customer-facing entry point to Velto’s existing operating system. Website submissions are sent through server-side business logic rather than giving the browser unrestricted access to private customer or order tables.
            </p>
            <p className="mt-3">
              Velto may use service providers that support hosting, communications, analytics or service operations. The website does not publish internal database credentials, private customer records, internal costs or unrestricted operational data.
            </p>
          </section>

          <section>
            <h2 className="t-h3 text-navy">Retention and updates</h2>
            <p className="mt-3">
              This website does not state a fixed retention period for every type of operational record. Booking, quote and order-related information may remain in Velto’s operating records according to business and legal needs. This page may be updated when the website’s data flow or measurement setup changes.
            </p>
          </section>

          <section>
            <h2 className="t-h3 text-navy">Questions about your information</h2>
            <p className="mt-3">
              Contact Velto through the WhatsApp or contact options shown on this website if you have a question about information you submitted through the site.
            </p>
          </section>
        </div>
      </div>
    </article>
  );
}
