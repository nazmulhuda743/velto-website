import { ButtonLink } from "@/components/ui/Button";
import { ResponsiveImage } from "@/components/ui/ResponsiveImage";
import { IMAGES } from "@/content/mock";
import { SectionIntro } from "./SectionIntro";

const ROWS = [
  {
    title: "Curtains",
    copy: "Approximate quantity and dimensions help us quote more accurately.",
  },
  {
    title: "Carpets",
    copy: "Send the approximate length and width. Material and condition can change the final price.",
  },
  {
    title: "Blankets & Comforters",
    copy: "Pricing depends mainly on the item, type and size. These jobs can take longer than everyday laundry.",
  },
];

export function HouseholdSection() {
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
            eyebrow="Household care"
            title="For curtains, carpets and bedding, start with a few details."
          >
            <p>
              Size, material and condition can affect the price. Tell us what you have, add
              approximate measurements where useful and upload a photo if it helps.
            </p>
            <p>We will confirm the final amount when measurement or condition needs to be checked.</p>
          </SectionIntro>
          <ul className="mt-(--space-intro-content)">
            {ROWS.map((row) => (
              <li key={row.title} className="border-t border-line py-5 last:border-b">
                <h3 className="t-h4 text-navy">{row.title}</h3>
                <p className="mt-2 text-secondary">{row.copy}</p>
              </li>
            ))}
          </ul>
          <ButtonLink href="/quote?source=home_household" variant="secondary" className="mt-8">
            Request a Quote
          </ButtonLink>
        </div>
      </div>
    </section>
  );
}
