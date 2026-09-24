import { pageMetadata } from "@/lib/seo/page-metadata";
import { QuoteForm } from "@/components/forms/QuoteForm";
import { Breadcrumbs } from "@/components/pages/Breadcrumbs";
import { ProcessSteps } from "@/components/pages/ProcessSteps";
import { WhatsAppButton } from "@/components/ui/Button";
import { WHATSAPP_URL } from "@/content/site";

export const generateMetadata = () => pageMetadata("/quote");

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** Household quote route (spec §7). */
export default async function QuotePage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const preview =
    process.env.NODE_ENV !== "production" && (one(params.preview) === "success" || one(params.preview) === "error")
      ? (one(params.preview) as "success" | "error")
      : undefined;

  return (
    <section aria-labelledby="page-title" className="pb-(--space-section) pt-6 md:pt-10 xl:pt-12">
      <div className="container-page">
        <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Request a Quote" }]} />
        <div className="mt-6 grid-page gap-y-12 md:mt-8">
          <div className="col-span-4 md:col-span-8 xl:col-span-7">
            <h1 id="page-title" className="t-h1 max-w-[20ch] text-navy">
              Request a quote for curtains, carpets or bedding.
            </h1>
            <p className="mt-4 max-w-[52ch] t-body text-body md:t-body-lg">
              Size, material and condition can affect the price. Tell us what you have, add
              approximate measurements where useful and a photo if it helps.
            </p>
            <div className="mt-(--space-intro-content)">
              <QuoteForm initialService={one(params.service)} preview={preview} />
            </div>
          </div>

          <aside aria-labelledby="next-title" className="col-span-4 md:col-span-8 xl:col-span-4 xl:col-start-9">
            <div className="xl:sticky xl:top-[100px]">
              <h2 id="next-title" className="t-label uppercase text-navy">
                How the quote works
              </h2>
              <ProcessSteps
                className="mt-4"
                steps={[
                  { title: "You share the details", copy: "Approximate quantity or dimensions, and a photo if useful." },
                  { title: "Price guidance", copy: "We guide you on the price from Velto's current pricing." },
                  { title: "Confirmation", copy: "We confirm the final amount when measurement or condition needs checking." },
                  { title: "Pickup", copy: "We collect from your address in Uttara." },
                ]}
              />
              <div className="mt-8 border-t border-line pt-6">
                <p className="font-semibold text-navy">Easier to send photos on WhatsApp?</p>
                <p className="mt-1 t-small text-secondary">Send the details and photos in a message instead.</p>
                <WhatsAppButton href={WHATSAPP_URL} placement="quote_aside" className="mt-4" />
              </div>
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}
