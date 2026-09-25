import { pageMetadata } from "@/lib/seo/page-metadata";
import { ProofFigures } from "@/components/pages/ProofFigures";
import { pageFigures } from "@/components/pages/figures";
import { FinalBookingCTA } from "@/components/home/FinalBookingCTA";
import { SectionIntro } from "@/components/home/SectionIntro";
import { BulletList } from "@/components/pages/BulletList";
import { PageHero } from "@/components/pages/PageHero";
import { ButtonLink } from "@/components/ui/Button";
import { TextLink } from "@/components/ui/TextLink";
import { IMAGES } from "@/content/mock";
import { bookHref } from "@/content/site";
import { dictionary } from "@/content/i18n";
import { pageText } from "@/content/i18n/pages";
import { getLocale } from "@/lib/i18n/server";

export const generateMetadata = () => pageMetadata("/about");

export default async function AboutPage() {
  const locale = await getLocale();
  const d = dictionary(locale);
  const t = pageText(locale).aboutPage;
  const fig = await pageFigures();
  return (
    <>
      <PageHero
        path={"/about"}
        crumbs={[{ label: d.common.home, href: "/" }, { label: t.crumb }]}
        title={t.title}
        eyebrow={t.eyebrow}
        highlight={t.highlight}
        aside={<ProofFigures wide={3} figures={[await fig.google("about_hero"), fig.outlets, fig.sectors]} />}
        image={IMAGES.about}
        actions={
          <ButtonLink href={bookHref("about-page")} event="book_pickup_click" placement="about_hero">
            {d.common.bookPickup}
          </ButtonLink>
        }
      >
        <p>{t.intro}</p>
      </PageHero>

      <section aria-labelledby="sops-title" className="bg-warm py-(--space-section)">
        <div className="container-page grid-page gap-y-10">
          <div className="col-span-4 md:col-span-8 xl:col-span-5">
            <SectionIntro id="sops-title" eyebrow={t.sopsEyebrow} title={t.sopsTitle}>
              <p>{t.sopsIntro}</p>
            </SectionIntro>
          </div>
          <div className="col-span-4 md:col-span-8 xl:col-span-6 xl:col-start-7">
            <BulletList items={t.sops} />
            <div className="mt-6">
              <TextLink href="/how-it-works" placement="about_process">
                {t.seeHandled}
              </TextLink>
            </div>
          </div>
        </div>
      </section>

      <section aria-labelledby="promise-title" className="py-(--space-section)">
        <div className="container-page grid-page gap-y-6">
          <div className="col-span-4 md:col-span-8 xl:col-span-5">
            <SectionIntro id="promise-title" eyebrow={t.promiseEyebrow} title={t.promiseTitle} />
          </div>
          <div className="col-span-4 space-y-4 t-body-lg text-body md:col-span-8 xl:col-span-6 xl:col-start-7">
            <p>{t.promise1}</p>
            <p>{t.promise2}</p>
          </div>
        </div>
      </section>

      <FinalBookingCTA id="book" source="about-final" />
    </>
  );
}
