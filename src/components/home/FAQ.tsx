import type { ReactNode } from "react";
import { dictionary } from "@/content/i18n";
import { getLocale } from "@/lib/i18n/server";
import { Eyebrow } from "./SectionIntro";

export type FAQItem = { q: string; a: ReactNode };

/** Approved FAQ answers (spec §20 section 09), one list per language in the UI dictionary. */
const toItems = (list: { q: string; a: string[] }[]): FAQItem[] =>
  list.map(({ q, a }) => ({ q, a: a.map((p) => <p key={p}>{p}</p>) }));

/** Reused on internal pages by key (English until those pages are translated). */
export const FAQS: FAQItem[] = toItems(dictionary("en").faqs);
const FAQS_BN: FAQItem[] = toItems(dictionary("bn").faqs);

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

export async function FAQ({
  title,
  items,
  eyebrow,
  className = "",
}: {
  title?: string;
  eyebrow?: string;
  items?: FAQItem[];
  className?: string;
}) {
  const locale = await getLocale();
  const t = dictionary(locale).home.faq;
  title ??= t.title;
  eyebrow ??= t.eyebrow;
  items ??= locale === "bn" ? FAQS_BN : FAQS;
  return (
    <section id="faq" aria-labelledby="faq-title" className={`py-(--space-section) ${className}`}>
      <div className="container-page grid-page gap-y-(--space-intro-content)">
        <div className="col-span-4 md:col-span-8 xl:col-span-4">
          <div className="xl:sticky xl:top-[100px]">
            <Eyebrow>{eyebrow}</Eyebrow>
            <h2 id="faq-title" className="t-h2 max-w-[16ch] text-navy">
              {title}
            </h2>
          </div>
        </div>
        <div className="col-span-4 md:col-span-8 xl:col-span-7 xl:col-start-6">
          <div className="border-t border-navy">
            {items.map((item) => (
              // Shared name = exclusive accordion: opening one question closes the others.
              <details key={item.q} name="faq" className="faq-item group border-b border-line">
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
