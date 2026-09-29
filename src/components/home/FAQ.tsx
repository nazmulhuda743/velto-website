import type { ReactNode } from "react";
import { JsonLd } from "@/components/seo/JsonLd";
import { dictionary } from "@/content/i18n";
import { buildFaqSchema } from "@/lib/seo/schema";
import type { Locale } from "@/lib/i18n/config";
import { getLocale } from "@/lib/i18n/server";
import { Eyebrow } from "./SectionIntro";

/** `text` is the answer as plain text, for the FAQPage structured data (the same words as `a`). */
export type FAQItem = { q: string; a: ReactNode; text?: string };

/** Approved FAQ answers (spec §20 section 09), one list per language in the UI dictionary. */
const toItems = (list: { q: string; a: string[] }[]): FAQItem[] =>
  list.map(({ q, a }) => ({ q, a: a.map((p) => <p key={p}>{p}</p>), text: a.join("\n\n") }));

/** Reused on internal pages by key (faqItems), in each language. */
export const FAQS: FAQItem[] = toItems(dictionary("en").faqs);
export const FAQS_BN: FAQItem[] = toItems(dictionary("bn").faqs);

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

/** Shared questions by key, in the page's language. */
export const faqItems = (locale: Locale, ...keys: (keyof typeof FAQ_KEYS)[]) =>
  keys.map((k) => (locale === "bn" ? FAQS_BN : FAQS)[FAQ_KEYS[k]]);

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
  // The questions and answers shown here, for AI assistants and search engines. Google shows FAQ rich
  // results only for government and health sites, so this is for understanding, not a SERP feature.
  const answered = items.filter((i): i is FAQItem & { text: string } => Boolean(i.text));
  return (
    <section id="faq" aria-labelledby="faq-title" className={`py-(--space-section) ${className}`}>
      {answered.length ? <JsonLd data={buildFaqSchema(answered, locale)} /> : null}
      <div className="container-page grid-page gap-y-(--space-intro-content)">
        <div className="col-span-4 md:col-span-8 xl:col-span-4">
          <div className="xl:sticky xl:top-[calc(100px+var(--promo-h,0px))]">
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
