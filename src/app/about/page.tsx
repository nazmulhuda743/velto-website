import type { Metadata } from "next";
import { FinalBookingCTA } from "@/components/home/FinalBookingCTA";
import { SectionIntro } from "@/components/home/SectionIntro";
import { BulletList } from "@/components/pages/BulletList";
import { PageHero } from "@/components/pages/PageHero";
import { ButtonLink } from "@/components/ui/Button";
import { TextLink } from "@/components/ui/TextLink";
import { IMAGES } from "@/content/mock";
import { bookHref } from "@/content/site";

export const metadata: Metadata = {
  title: "About Velto — laundry and dry cleaning in Uttara",
  description:
    "Velto is a laundry and dry cleaning service in Uttara with outlets in Sector 11 and Sector 18 and written procedures for every order.",
};

export default function AboutPage() {
  return (
    <>
      <PageHero
        crumbs={[{ label: "Home", href: "/" }, { label: "About" }]}
        title="A laundry in Uttara that works to a written process."
        image={IMAGES.process[1]}
        actions={
          <ButtonLink href={bookHref("about-page")} event="book_pickup_click" placement="about_hero">
            Book a Pickup
          </ButtonLink>
        }
      >
        <p>
          Velto cleans clothes and household items for homes across Uttara, with pickup from your door
          and outlets in Sector 11 and Sector 18.
        </p>
      </PageHero>

      <section aria-labelledby="sops-title" className="bg-warm py-(--space-section)">
        <div className="container-page grid-page gap-y-10">
          <div className="col-span-4 md:col-span-8 xl:col-span-5">
            <SectionIntro id="sops-title" title="Written down, not left to memory.">
              <p>
                The key steps of every order follow written operating procedures, so each order goes
                through the same checks.
              </p>
            </SectionIntro>
          </div>
          <div className="col-span-4 md:col-span-8 xl:col-span-6 xl:col-start-7">
            <BulletList
              items={[
                "Garment intake",
                "Item and order identification",
                "Tagging",
                "Stain identification and handling",
                "Quality control",
              ]}
            />
            <div className="mt-6">
              <TextLink href="/how-it-works" placement="about_process">
                See how an order is handled
              </TextLink>
            </div>
          </div>
        </div>
      </section>

      <section aria-labelledby="promise-title" className="py-(--space-section)">
        <div className="container-page grid-page gap-y-6">
          <div className="col-span-4 md:col-span-8 xl:col-span-5">
            <SectionIntro id="promise-title" title="What we will and won't promise." />
          </div>
          <div className="col-span-4 space-y-4 t-body-lg text-body md:col-span-8 xl:col-span-6 xl:col-start-7">
            <p>
              We check garments and visible stains before cleaning. Some stains cannot be fully
              removed, and we would rather tell you that first than promise otherwise.
            </p>
            <p>
              Turnaround times are usual times, not guarantees. Special garments and household items
              can take longer, and we will say so when they do.
            </p>
          </div>
        </div>
      </section>

      <FinalBookingCTA id="book" source="about-final" />
    </>
  );
}
