import { TrackOrder } from "@/components/forms/TrackOrder";
import { Breadcrumbs } from "@/components/pages/Breadcrumbs";
import { pageMetadata } from "@/lib/seo/page-metadata";

/**
 * Not indexed: a utility for existing customers (they arrive from the receipt, menu or footer),
 * with no content a searcher needs. Order data is only ever returned to a matching POST.
 */
export const generateMetadata = () => pageMetadata("/track", { noindex: true });

export default function TrackPage() {
  return (
    <section aria-labelledby="page-title" className="bg-soft pb-(--space-section) pt-6 md:pt-10 xl:pt-12">
      <div className="container-page">
        <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Track an Order" }]} />
        <div className="mt-6 max-w-[880px] md:mt-8">
          <h1 id="page-title" className="t-h1 text-navy">
            Where&apos;s my order?
          </h1>
          <p className="mt-5 max-w-[56ch] t-body text-body md:t-body-lg">
            Enter your order number and the phone number you booked with. You&apos;ll see where your
            order is, from pickup to delivery.
          </p>
          <div className="mt-(--space-intro-content)">
            <TrackOrder />
          </div>
        </div>
      </div>
    </section>
  );
}
