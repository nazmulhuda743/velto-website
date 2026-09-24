import type { ReactNode } from "react";
import { ResponsiveImage } from "@/components/ui/ResponsiveImage";
import type { ImageSlot } from "@/content/mock";
import { Breadcrumbs, type Crumb } from "./Breadcrumbs";

/**
 * Internal-page hero. Same grid, type and CTA hierarchy as the homepage hero,
 * at a quieter scale (H1 style, 4:3 image) so internal pages stay subordinate.
 */
export function PageHero({
  crumbs,
  title,
  children,
  actions,
  aside,
  image,
  priority = true,
}: {
  crumbs: Crumb[];
  title: ReactNode;
  children?: ReactNode;
  actions?: ReactNode;
  /** Content under the actions (proof lines, facts). */
  aside?: ReactNode;
  image?: ImageSlot;
  priority?: boolean;
}) {
  return (
    <section aria-labelledby="page-title" className="pb-14 pt-6 md:pb-20 md:pt-10 xl:pb-24 xl:pt-12">
      <div className="container-page">
        <Breadcrumbs items={crumbs} />
        <div className="mt-6 grid-page gap-y-8 md:mt-8">
          <div className={image ? "col-span-4 md:col-span-4 xl:col-span-6" : "col-span-4 md:col-span-8 xl:col-span-9"}>
            <h1 id="page-title" className="t-h1 max-w-[20ch] text-navy">
              {title}
            </h1>
            {children ? (
              <div className="mt-5 max-w-[560px] space-y-4 t-body text-body md:mt-6 md:t-body-lg">{children}</div>
            ) : null}
            {actions ? <div className="mt-7 flex gap-2.5 md:mt-8 md:flex-wrap md:gap-3">{actions}</div> : null}
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
          ) : null}
        </div>
      </div>
    </section>
  );
}
