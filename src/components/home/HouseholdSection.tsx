import { ButtonLink } from "@/components/ui/Button";
import { ResponsiveImage } from "@/components/ui/ResponsiveImage";
import { IMAGES } from "@/content/mock";
import { dictionary } from "@/content/i18n";
import { getLocale } from "@/lib/i18n/server";
import { SectionIntro } from "./SectionIntro";

export async function HouseholdSection() {
  const t = dictionary(await getLocale()).home.household;
  return (
    <section id="household" aria-labelledby="household-title" className="py-(--space-section)">
      <div className="container-page grid-page gap-y-10">
        <div className="col-span-4 md:col-span-4 xl:col-span-6">
          <div className="md:sticky md:top-[100px]">
            <ResponsiveImage
              image={IMAGES.householdSection}
              aspect="aspect-[4/3] md:aspect-[4/5] xl:aspect-[4/3]"
              sizes="(min-width: 1200px) 610px, (min-width: 768px) 50vw, 100vw"
            />
          </div>
        </div>
        <div className="col-span-4 md:col-span-4 xl:col-span-5 xl:col-start-8">
          <SectionIntro
            id="household-title"
            eyebrow={t.eyebrow}
            title={t.title}
          >
            <p>{t.intro1}</p>
            <p>{t.intro2}</p>
          </SectionIntro>
          <ul className="mt-(--space-intro-content)">
            {t.rows.map((row) => (
              <li key={row.title} className="border-t border-line py-5 last:border-b">
                <h3 className="t-h4 text-navy">{row.title}</h3>
                <p className="mt-2 text-secondary">{row.copy}</p>
              </li>
            ))}
          </ul>
          <ButtonLink href="/quote?source=home_household" variant="secondary" className="mt-8">
            {t.requestQuote}
          </ButtonLink>
        </div>
      </div>
    </section>
  );
}
