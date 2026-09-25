import type { ReactNode } from "react";
import { SectionIntro } from "@/components/home/SectionIntro";
import { ResponsiveImage } from "@/components/ui/ResponsiveImage";
import { IMAGES } from "@/content/mock";
import { pageText } from "@/content/i18n/pages";
import { fill, localDigits } from "@/lib/i18n/config";
import { getLocale } from "@/lib/i18n/server";

/** Stage photos, in the order of the stages in the page text (pageText().operational.groups). */
const STAGE_IMAGES = [IMAGES.process[2], IMAGES.process[3], IMAGES.process[4], IMAGES.process[6]];

/**
 * The full operational sequence (How It Works), grouped into four stages so
 * ten steps scan as one short read rather than ten equal rows. Copy reuses
 * the approved step wording from the service pages.
 */
export async function OperationalProcess({ title, intro }: { title: string; intro?: ReactNode }) {
  const locale = await getLocale();
  const t = pageText(locale).operational;
  const groups = t.groups;
  const num = (i: number) => localDigits(String(i + 1).padStart(2, "0"), locale);
  /** Running step number where each group starts (01–10 across the groups). */
  const offsets = groups.map((_, g) => groups.slice(0, g).reduce((sum, grp) => sum + grp.steps.length, 0));
  return (
    <section id="process" aria-labelledby="process-title" className="py-(--space-section)">
      <div className="container-page">
        <SectionIntro id="process-title" eyebrow={t.eyebrow} title={title} titleClassName="max-w-[18ch]">
          {intro}
        </SectionIntro>
        <ol className="mt-(--space-intro-content) grid list-none gap-x-5 gap-y-12 md:grid-cols-2 md:gap-y-16 xl:gap-x-6">
          {groups.map((group, g) => (
            <li key={group.label}>
              <ResponsiveImage
                image={STAGE_IMAGES[g]}
                aspect="aspect-[2/1] md:aspect-[16/10]"
                sizes="(min-width: 1200px) 610px, (min-width: 768px) 50vw, 100vw"
              />
              <p className="mt-5 t-label uppercase text-blue md:mt-6">{fill(t.stage, { n: g + 1 }, locale)}</p>
              <h3 className="mt-1.5 t-h3 text-navy">{group.label}</h3>
              <ol className="mt-4 list-none border-b border-line">
                {group.steps.map((step, i) => (
                  <li key={step.title} className="grid grid-cols-[2.75rem_1fr] gap-x-3 border-t border-line py-3.5">
                    <span className="t-label pt-[3px] text-secondary">{num(offsets[g] + i)}</span>
                    <p>
                      <span className="font-semibold text-navy">{step.title}.</span>{" "}
                      <span className="text-secondary">{step.copy}</span>
                    </p>
                  </li>
                ))}
              </ol>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
