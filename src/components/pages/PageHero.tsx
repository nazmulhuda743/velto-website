import type { ReactNode } from "react";
import { ResponsiveImage } from "@/components/ui/ResponsiveImage";
import type { ImageSlot } from "@/content/mock";
import { Eyebrow } from "@/components/home/SectionIntro";
import { JsonLd } from "@/components/seo/JsonLd";
import { buildBreadcrumbSchema } from "@/lib/seo/schema";
import { Breadcrumbs, type Crumb } from "./Breadcrumbs";
import { localizeHref } from "@/lib/i18n/config";
import { getLocale } from "@/lib/i18n/server";

/** Sets one phrase of the title in Velto blue: the page's single highlighted idea. */
function emphasise(title: ReactNode, phrase?: string) {
  if (!phrase || typeof title !== "string") return title;
  const at = title.indexOf(phrase);
  if (at < 0) return title;
  return (
    <>
      {title.slice(0, at)}
      <span className="text-blue">{phrase}</span>
      {title.slice(at + phrase.length)}
    </>
  );
}

/**
 * Internal-page hero. Same grid, type and CTA hierarchy as the homepage hero,
 * at a quieter scale (H1 style, 4:3 image) so internal pages stay subordinate.
 */
export async function PageHero({
  crumbs,
  path,
  title,
  eyebrow,
  highlight,
  children,
  actions,
  aside,
  image,
  visual,
  priority = true,
  stackActionsOnMobile = false,
}: {
  crumbs: Crumb[];
  /** This page's path. When set, the breadcrumb trail is also emitted as BreadcrumbList JSON-LD. */
  path?: string;
  title: ReactNode;
  /** Small blue label above the H1 (the site-wide section label system). */
  eyebrow?: string;
  /** One phrase of a string title to set in Velto blue. Ignored if it isn't in the title. */
  highlight?: string;
  children?: ReactNode;
  actions?: ReactNode;
  /** Content under the actions (proof lines, facts). */
  aside?: ReactNode;
  image?: ImageSlot;
  /** Right-column content when there is no photo (e.g. a location plate). Ignored if `image` is set. */
  visual?: ReactNode;
  priority?: boolean;
  /** Stack the two actions on mobile when both are text buttons that won't fit side by side. */
  stackActionsOnMobile?: boolean;
}) {
  const hasVisual = Boolean(image || visual);
  const locale = await getLocale();
  return (
    <section aria-labelledby="page-title" className="pb-14 pt-6 md:pb-20 md:pt-10 xl:pb-24 xl:pt-12">
      <div className="container-page">
        <Breadcrumbs items={crumbs} />
        {path ? (
          <JsonLd data={buildBreadcrumbSchema(crumbs.map((c) => ({ label: c.label, path: localizeHref(c.href ?? path, locale) })))} />
        ) : null}
        <div className="mt-6 grid-page gap-y-8 md:mt-8">
          <div className={hasVisual ? "col-span-4 md:col-span-4 xl:col-span-6" : "col-span-4 md:col-span-8 xl:col-span-9"}>
            {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
            <h1 id="page-title" className="t-h1 max-w-[20ch] text-navy">
              {emphasise(title, highlight)}
            </h1>
            {children ? (
              <div className="mt-5 max-w-[560px] space-y-4 t-body text-body md:mt-6 md:t-body-lg">{children}</div>
            ) : null}
            {actions ? (
              <div className={`mt-7 flex gap-2.5 md:mt-8 md:flex-wrap md:gap-3 ${stackActionsOnMobile ? "max-md:flex-col" : ""}`}>
                {actions}
              </div>
            ) : null}
            {aside ? <div className="mt-8 max-w-[560px]">{aside}</div> : null}
          </div>
          {image ? (
            <div className="col-span-4 md:col-span-4 md:col-start-5 xl:col-span-6 xl:col-start-7">
              <ResponsiveImage
                image={image}
                aspect="aspect-[16/10] md:aspect-[4/5] xl:aspect-[4/3]"
                sizes="(min-width: 1200px) 610px, (min-width: 768px) 50vw, 100vw"
                priority={priority}
              />
            </div>
          ) : visual ? (
            <div className="col-span-4 md:col-span-4 md:col-start-5 xl:col-span-6 xl:col-start-7">{visual}</div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
