import Link from "@/components/i18n/Link";
import { pageMetadata } from "@/lib/seo/page-metadata";
import { getCustomerSession } from "@/lib/customer/portal";
import { BookingForm } from "@/components/forms/BookingForm";
import { Breadcrumbs } from "@/components/pages/Breadcrumbs";
import { WhatsAppButton } from "@/components/ui/Button";
import { WHATSAPP_URL } from "@/content/site";

export const generateMetadata = () => pageMetadata("/book");

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** Arrival contexts that aren't a cleaning service: carried as a pre-filled note. */
const PRESET_NOTES: Record<string, string> = {
  "regular-laundry": "I'd like to set up a regular pickup.",
  express: "I'd like Express, if it's possible for this order.",
};

const NEXT_STEPS = [
  "We call or WhatsApp you to confirm the pickup time.",
  "We collect from your door.",
  "Your order comes back cleaned, finished, checked and packed.",
];

/** Primary booking route (spec §22). The mobile conversion bar is intentionally absent here. */
export default async function BookPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const service = one(params.service);
  // Development-only QA hook: simulate the adapter result without any backend.
  const preview = process.env.NODE_ENV !== "production" ? one(params.preview) : undefined;
  const previewOutcome = preview === "success" || preview === "error" ? preview : undefined;
  const session = await getCustomerSession();
  const account = session.kind === "customer" && session.account.state === "ready" ? session.account : null;
  const returnTo = `/book${service ? `?service=${encodeURIComponent(service)}` : ""}`;

  return (
    <section aria-labelledby="page-title" className="group/book pb-(--space-section) pt-7 md:pt-10 xl:pt-12">
      <div className="container-page">
        <div className="hidden md:block">
          <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Book a Pickup" }]} />
        </div>
        <div className="grid-page gap-y-10 md:mt-8">
          <div className="col-span-4 md:col-span-8 xl:col-span-7">
            <div className="max-w-[640px]">
              <BookingForm
                intro={
                  <>
                    Tell us what you&apos;re sending and where to collect it. We&apos;ll confirm the time with you before we come.
                    {account ? (
                      <span className="mt-3 block t-small text-secondary" data-prefilled>
                        Signed in as {account.fullName}. Your details are filled in; check them before you send.
                      </span>
                    ) : session.kind === "anonymous" ? (
                      <span className="mt-3 block t-small text-secondary">
                        Have a Velto account?{" "}
                        <Link href={`/login?next=${encodeURIComponent(returnTo)}`} className="font-semibold text-navy underline decoration-blue/50 underline-offset-4">
                          Sign in to fill in your details
                        </Link>
                        .
                      </span>
                    ) : null}
                  </>
                }
                initialService={service}
                presetNote={PRESET_NOTES[service ?? ""]}
                previewOutcome={previewOutcome}
                initialContact={
                  account
                    ? { name: account.fullName, phone: account.phone, address: account.address ?? "", sector: account.area ?? "" }
                    : undefined
                }
              />
            </div>
          </div>

          <aside aria-label="About booking" className="group-has-[[data-booking-success]]/book:hidden col-span-4 md:col-span-8 xl:col-span-4 xl:col-start-9">
            <div className="xl:sticky xl:top-[100px]">
              <div className="hidden xl:block">
                <h2 className="t-label uppercase text-navy">How it works</h2>
                <ol className="mt-4 border-t border-navy">
                  {NEXT_STEPS.map((step, i) => (
                    <li key={step} className="flex gap-3 border-b border-line py-3.5 t-small text-body">
                      <span className="t-label pt-[2px] text-blue">{String(i + 1).padStart(2, "0")}</span>
                      {step}
                    </li>
                  ))}
                </ol>
                <p className="mt-4 t-small text-secondary">
                  Pickup covers Uttara Sectors 1–18. Orders under ৳499 have a pickup and delivery charge.
                  We tell you the amount when we confirm.
                </p>
              </div>
              <div className="border-t border-line pt-6 xl:mt-8">
                <p className="font-semibold text-navy">Rather message us?</p>
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
