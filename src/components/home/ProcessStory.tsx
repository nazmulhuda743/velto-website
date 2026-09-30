import { ResponsiveImage } from "@/components/ui/ResponsiveImage";
import { TextLink } from "@/components/ui/TextLink";
import { IMAGES } from "@/content/mock";
import { SERVICES } from "@/content/site";
import { dictionary } from "@/content/i18n";
import { localDigits } from "@/lib/i18n/config";
import { getLocale } from "@/lib/i18n/server";
import { SectionIntro } from "./SectionIntro";

/**
 * Homepage "after pickup" story, shortened with the owner's approval: the four
 * movements as a compact numbered list, each with the first stage's line, and
 * one photo for the whole section. The full eight-stage walk-through lives on
 * /how-it-works. Stage and movement text lives in the UI dictionary (home.process).
 */
const MOVEMENT_FIRST_STAGE = [0, 1, 4, 5];

export async function ProcessStory() {
  const locale = await getLocale();
  const t = dictionary(locale).home.process;
  const num = (i: number) => localDigits(String(i + 1).padStart(2, "0"), locale);
  return (
    <section id="process" aria-labelledby="process-title" className="py-(--space-section)">
      <div className="container-page">
        <SectionIntro id="process-title" title={t.title} titleClassName="max-w-[18ch]" />

        <div className="mt-(--space-intro-content) grid-page gap-y-6">
          <div className="col-span-4 md:col-span-3 xl:col-span-5">
            <ResponsiveImage
              image={IMAGES.process[3]}
              aspect="aspect-[16/9] md:aspect-[3/4] xl:aspect-[4/5]"
              sizes="(min-width: 1200px) 500px, (min-width: 768px) 38vw, 100vw"
            />
          </div>

          <div className="col-span-4 md:col-span-5 xl:col-span-6 xl:col-start-7">
            <ol className="list-none border-t border-navy">
              {MOVEMENT_FIRST_STAGE.map((stage, g) => (
                <li key={g} className="grid grid-cols-[2rem_1fr] gap-x-3 border-b border-line py-3.5 md:grid-cols-[2.5rem_1fr] md:py-5">
                  <span aria-hidden="true" className="pt-1 t-label text-action">
                    {num(g)}
                  </span>
                  <div>
                    <h3 className="t-h4 text-navy">{t.movements[g]}</h3>
                    <p className="mt-1 max-w-[48ch] t-small text-secondary md:t-body">{t.stages[stage].copy}</p>
                  </div>
                </li>
              ))}
            </ol>

            {/* Delicate garment note */}
            <div className="mt-8 md:mt-10">
              <h3 className="t-h4 text-navy">{t.delicateTitle}</h3>
              <p className="mt-2 max-w-[48ch] t-small text-body md:t-body">{t.delicate2}</p>
              <div className="mt-2">
                <TextLink href={SERVICES.dryCleaning.href} placement="process_delicate">
                  {t.seeDryCleaning}
                </TextLink>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
