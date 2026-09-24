import type { ReactNode } from "react";

export type FAQItem = { q: string; a: ReactNode };

/** Approved FAQ answers (spec §20 section 09). Reused on internal pages by index. */
export const FAQS: FAQItem[] = [
  {
    q: "How long does an order usually take?",
    a: (
      <>
        <p>General orders are usually around 48 hours.</p>
        <p>Wash &amp; Iron and Dry Cleaning are usually around 72 hours.</p>
        <p>Special garments, household items and unusual conditions may take longer.</p>
      </>
    ),
  },
  {
    q: "Where do you provide pickup and delivery?",
    a: (
      <>
        <p>Velto&apos;s confirmed core service area is Uttara, Sectors 1–18.</p>
        <p>If you are outside that area, ask us before booking.</p>
      </>
    ),
  },
  {
    q: "When is pickup and delivery free?",
    a: (
      <>
        <p>Orders of ৳499+ qualify for free pickup and delivery.</p>
        <p>On a fixed weekly or fortnightly pickup, regular orders of ৳300+ qualify.</p>
        <p>Smaller orders have an applicable pickup and delivery charge.</p>
      </>
    ),
  },
  {
    q: "Can every stain be removed?",
    a: (
      <>
        <p>No.</p>
        <p>
          We check visible stains and treat them according to the garment and service, but no
          laundry should promise that every stain will come out.
        </p>
      </>
    ),
  },
  {
    q: "What if I do not know which service I need?",
    a: (
      <p>
        Send us a photo or message Velto on WhatsApp. We can help you choose before booking.
      </p>
    ),
  },
  {
    q: "Is Express service available?",
    a: (
      <>
        <p>Sometimes.</p>
        <p>
          Availability depends on the item, service and current workload. Confirm with Velto before
          booking.
        </p>
      </>
    ),
  },
  {
    q: "How are curtains and carpets priced?",
    a: (
      <>
        <p>Curtain and carpet pricing can depend on size, material and condition.</p>
        <p>
          Share approximate measurements and a photo where useful. We can confirm the final price
          when more information is needed.
        </p>
      </>
    ),
  },
];

/** Native <details> accordion — keyboard accessible with no client JS. */
export const FAQ_KEYS = {
  turnaround: 0,
  area: 1,
  freeDelivery: 2,
  stains: 3,
  unsure: 4,
  express: 5,
  household: 6,
} as const;

export const faqItems = (...keys: (keyof typeof FAQ_KEYS)[]) => keys.map((k) => FAQS[FAQ_KEYS[k]]);

export function FAQ({
  title = "A few things worth knowing before you book.",
  items = FAQS,
  className = "",
}: {
  title?: string;
  items?: FAQItem[];
  className?: string;
}) {
  return (
    <section id="faq" aria-labelledby="faq-title" className={`py-(--space-section) ${className}`}>
      <div className="container-page grid-page gap-y-(--space-intro-content)">
        <div className="col-span-4 md:col-span-8 xl:col-span-4">
          <h2 id="faq-title" className="t-h2 max-w-[16ch] text-navy xl:sticky xl:top-[100px]">
            {title}
          </h2>
        </div>
        <div className="col-span-4 md:col-span-8 xl:col-span-7 xl:col-start-6">
          <div className="border-t border-navy">
            {items.map((item) => (
              <details key={item.q} className="faq-item group border-b border-line">
                <summary className="flex min-h-16 cursor-pointer items-center justify-between gap-6 py-5 text-navy">
                  <span className="text-[18px] font-semibold leading-snug tracking-[-0.01em] md:text-[20px]">
                    {item.q}
                  </span>
                  <span aria-hidden="true" className="relative size-4 shrink-0 text-blue">
                    <span className="absolute left-0 top-1/2 h-[1.5px] w-4 -translate-y-1/2 bg-current" />
                    <span className="faq-icon-v absolute left-1/2 top-0 h-4 w-[1.5px] -translate-x-1/2 bg-current transition-transform duration-200 motion-reduce:transition-none" />
                  </span>
                </summary>
                <div className="max-w-[60ch] space-y-3 pb-6 pr-10 text-body">{item.a}</div>
              </details>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
