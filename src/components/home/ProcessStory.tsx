import { ResponsiveImage } from "@/components/ui/ResponsiveImage";
import { TextLink } from "@/components/ui/TextLink";
import { IMAGES } from "@/content/mock";
import { SERVICES } from "@/content/site";
import { ProcessScrollSync } from "./ProcessScrollSync";
import { SectionIntro } from "./SectionIntro";

const STAGES = [
  { title: "Collected", copy: "We arrange pickup from your address in Uttara." },
  {
    title: "Received & identified",
    copy: "Your order is checked in and connected to the correct customer and order.",
  },
  {
    title: "Tagged",
    copy: "Items are identified so they stay connected to the correct order while they move through Velto.",
  },
  {
    title: "Checked before cleaning",
    copy: "Garment condition and visible stains are reviewed before work begins.",
  },
  {
    title: "Cleaned & finished",
    copy: "The garment is cleaned according to the booked service, then finished or pressed where required.",
  },
  {
    title: "Checked before packing",
    copy: "Finished items go through Velto's QC before they are packed.",
  },
  {
    title: "Packed for return",
    copy: "Your finished order is organised and packed before delivery.",
  },
  { title: "Returned to you", copy: "Delivery is arranged back to your address." },
];

/** Mobile editorial groups — pairs of stages (spec §20 section 03). */
const GROUPS = [0, 2, 4, 6];

const num = (i: number) => String(i + 1).padStart(2, "0");

export function ProcessStory() {
  return (
    <section id="process" aria-labelledby="process-title" className="py-(--space-section)">
      <div className="container-page">
        <SectionIntro id="process-title" title="What happens to your clothes after pickup?" titleClassName="max-w-[18ch]">
          <p>
            Your order is checked in, identified and tagged before cleaning starts. Garments and
            visible stains are reviewed, the work is completed, checked again, packed and returned.
          </p>
        </SectionIntro>

        <div className="mt-(--space-intro-content) grid-page">
          {/* Sticky visual — desktop/laptop only */}
          <div className="hidden lg:col-span-4 lg:block xl:col-span-7" aria-hidden="true">
            <div className="sticky top-[100px]">
              <div className="relative h-[min(72vh,720px)] min-h-[440px] overflow-hidden rounded-md">
                {IMAGES.process.map((image, i) => (
                  <div
                    key={i}
                    data-frame={i}
                    data-active={i === 0}
                    className="process-frame absolute inset-0"
                  >
                    <ResponsiveImage
                      image={image}
                      decorative
                      aspect="h-full"
                      sizes="(min-width: 1200px) 720px, 50vw"
                    />
                  </div>
                ))}
              </div>
              <div className="mt-4 flex items-center gap-6">
                <div className="relative h-5 flex-1">
                  {STAGES.map((stage, i) => (
                    <p
                      key={i}
                      data-frame={i}
                      data-active={i === 0}
                      className="process-frame absolute inset-0 t-caption text-secondary"
                    >
                      <span className="font-semibold text-navy">{num(i)}</span> / 08 · {stage.title}
                    </p>
                  ))}
                </div>
                <div className="flex gap-1">
                  {STAGES.map((_, i) => (
                    <span key={i} data-frame={i} data-active={i === 0} className="process-tick h-0.5 w-5 rounded-full" />
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Narrative */}
          <div className="col-span-4 md:col-span-8 lg:col-span-4 lg:pb-[24vh] xl:col-span-5">
            {GROUPS.map((start, g) => (
              <div key={start} className={g > 0 ? "mt-12 md:mt-16 lg:mt-0" : ""}>
                <div className="mb-8 lg:hidden">
                  <ResponsiveImage
                    image={IMAGES.process[start]}
                    aspect="aspect-[4/3] md:aspect-[16/9]"
                    sizes="(min-width: 768px) 90vw, 100vw"
                  />
                </div>
                <ol start={start + 1} className="list-none md:grid md:grid-cols-2 md:gap-5 lg:block">
                  {STAGES.slice(start, start + 2).map((stage, j) => {
                    const i = start + j;
                    return (
                      <li
                        key={i}
                        data-stage={i}
                        data-active={i === 0}
                        className="process-stage relative border-t border-line pb-8 pt-5 lg:flex lg:min-h-[30vh] lg:flex-col lg:pb-10 lg:pt-6"
                      >
                        <span
                          aria-hidden="true"
                          className="process-marker absolute -top-px left-0 hidden h-0.5 w-full bg-blue lg:block"
                        />
                        <span className="process-num t-label text-secondary">{num(i)}</span>
                        <h3 className="process-title mt-3 t-h4 text-navy">{stage.title}</h3>
                        <p className="mt-2 max-w-[40ch] text-secondary">{stage.copy}</p>
                      </li>
                    );
                  })}
                </ol>
              </div>
            ))}
          </div>
        </div>

        {/* Delicate garment insert */}
        <div className="mt-(--space-related) grid-page gap-y-8 border-t border-line pt-(--space-related) lg:mt-0">
          <div className="col-span-4 md:col-span-4 xl:col-span-6">
            <ResponsiveImage
              image={IMAGES.delicate}
              aspect="aspect-[4/3] xl:aspect-[3/2]"
              sizes="(min-width: 1200px) 610px, (min-width: 768px) 50vw, 100vw"
            />
          </div>
          <div className="col-span-4 md:col-span-4 md:self-center xl:col-span-5 xl:col-start-8">
            <h3 className="t-h3 max-w-[18ch] text-navy">Some garments need a closer look.</h3>
            <div className="mt-5 max-w-[48ch] space-y-4 text-body">
              <p>
                A blazer, saree or sherwani is not the same job as everyday laundry. We check the
                garment and visible stains before cleaning starts.
              </p>
              <p>
                Some stains cannot be fully removed. If a garment needs extra attention, that should
                be clear before unrealistic promises are made.
              </p>
            </div>
            <div className="mt-5">
              <TextLink href={SERVICES.dryCleaning.href} placement="process_delicate">
                See Dry Cleaning
              </TextLink>
            </div>
          </div>
        </div>
      </div>
      <ProcessScrollSync rootId="process" />
    </section>
  );
}
