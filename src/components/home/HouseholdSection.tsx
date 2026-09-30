import { ButtonLink } from "@/components/ui/Button";
import { dictionary } from "@/content/i18n";
import { getLocale } from "@/lib/i18n/server";

/**
 * Curtains, carpets & bedding (section 07), kept as a compact strip: the three services are
 * already listed, with photos and links, in the service chooser, so this section carries only
 * the quote-based pricing note and the Request a Quote action.
 */
export async function HouseholdSection() {
  const t = dictionary(await getLocale()).home.household;
  return (
    <section id="household" aria-labelledby="household-title" className="py-(--space-related)">
      <div className="container-page grid-page gap-y-5 md:items-center">
        <h2 id="household-title" className="col-span-4 t-h3 text-navy md:col-span-5 md:max-w-[24ch] xl:col-span-7">
          {t.title}
        </h2>
        <div className="col-span-4 md:col-span-3 xl:col-span-4 xl:col-start-9">
          <p className="t-body text-body">{t.intro2}</p>
          <ButtonLink href="/quote?source=home_household" variant="secondary" className="mt-5">
            {t.requestQuote}
          </ButtonLink>
        </div>
      </div>
    </section>
  );
}
