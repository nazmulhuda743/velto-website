import { ResponsiveImage } from "@/components/ui/ResponsiveImage";
import { TextLink } from "@/components/ui/TextLink";
import { IMAGES } from "@/content/mock";
import { SERVICES } from "@/content/site";
import { ProcessScrollSync } from "./ProcessScrollSync";
import { SectionIntro } from "./SectionIntro";

const STAGES = [
  { title: "Collected", copy: "We arrange pickup from your address in Uttara." },
  {
    title: "Checked in",
    copy: "We count the order and connect the items to the right customer and order.",
  },
  { title: "Tagged", copy: "Items are tagged so they stay connected to the correct order." },
  {
    title: "Checked before cleaning",
    copy: "We look over the garment condition and visible stains before cleaning starts.",
  },
  {
    title: "Cleaned & finished",
    copy: "The garment is cleaned for the booked service, then pressed or finished where needed.",
  },
  { title: "Checked before packing", copy: "Finished items are checked again before they are packed." },
  { title: "Packed for return", copy: "Your finished order is organised and packed for delivery." },
  { title: "Returned to you", copy: "Delivery is arranged back to your address." },
];

/**
 * Four movements (mobile/tablet visual grouping). All eight stages stay in the
 * DOM; on desktop the grouping is transparent and the sticky story runs per stage.
 */
const MOVEMENTS = [
  { label: "Pickup", stages: [0], image: 0 },
  { label: "Intake", stages: [1, 2, 3], image: 2 },
  { label: "Cleaning & finishing", stages: [4], image: 4 },
  { label: "QC & return", stages: [5, 6, 7], image: 6 },
];

const num = (i: number) => String(i + 1).padStart(2, "0");
const stage = (i: number) => STAGES[i];

const DEFAULT_INTRO = (
  <p>
    Once your order reaches Velto, we check it in, identify the items and look over the garments
    before cleaning starts. When the work is finished, everything is checked again, packed and
    returned.
  </p>
);

export function ProcessStory({
  title = "What happens to your clothes after pickup?",
  intro = DEFAULT_INTRO,
  showInsert = true,
}: {
  title?: string;
  intro?: React.ReactNode;
  showInsert?: boolean;
} = {}) {
  return (
    <section id="process" aria-labelledby="process-title" className="py-(--space-section)">
      <div className="container-page">
        <SectionIntro id="process-title" title={title} titleClassName="max-w-[18ch]">
          {intro}
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
            {MOVEMENTS.map((movement, g) => (
              <div
                key={movement.label}
                className={`md:grid md:grid-cols-2 md:items-start md:gap-x-5 lg:block ${
                  g > 0 ? "mt-8 md:mt-12 lg:mt-0" : ""
                }`}
              >
                <div className="mb-4 md:mb-0 lg:hidden">
                  <ResponsiveImage
                    image={IMAGES.process[movement.image]}
                    aspect="aspect-[2/1] md:aspect-[4/3]"
                    sizes="(min-width: 768px) 45vw, 100vw"
                  />
                </div>
                <div>
                  <p className="mb-2 flex items-baseline gap-3 lg:hidden">
                    <span className="t-label text-blue">{num(g)}</span>
                    <span className="t-h4 text-navy">{movement.label}</span>
                  </p>
                  <ol start={movement.stages[0] + 1} className="list-none">
                    {movement.stages.map((i) => (
                      <li
                        key={i}
                        data-stage={i}
                        data-active={i === 0}
                        className="process-stage relative border-t border-line py-2.5 lg:flex lg:min-h-[30vh] lg:flex-col lg:pb-10 lg:pt-6"
                      >
                        <span
                          aria-hidden="true"
                          className="process-marker absolute -top-px left-0 hidden h-0.5 w-full bg-blue lg:block"
                        />
                        <span className="process-num hidden t-label text-secondary lg:block">{num(i)}</span>
                        <h3 className="process-title inline text-[15px] font-semibold leading-snug text-navy lg:mt-3 lg:block lg:t-h4">
                          {stage(i).title}
                        </h3>
                        <p className="ml-1.5 inline t-small text-secondary lg:mt-2 lg:ml-0 lg:block lg:max-w-[40ch] lg:t-body">
                          {stage(i).copy}
                        </p>
                      </li>
                    ))}
                  </ol>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Delicate garment insert */}
        {showInsert ? (
        <div className="mt-(--space-related) grid-page gap-y-8 border-t border-line pt-(--space-related) lg:mt-0">
          <div className="col-span-4 md:col-span-4 xl:col-span-6">
            <ResponsiveImage
              image={IMAGES.delicate}
              aspect="aspect-[16/9] md:aspect-[4/3] xl:aspect-[3/2]"
              sizes="(min-width: 1200px) 610px, (min-width: 768px) 50vw, 100vw"
            />
          </div>
          <div className="col-span-4 md:col-span-4 md:self-center xl:col-span-5 xl:col-start-8">
            <h3 className="t-h3 max-w-[18ch] text-navy">Some garments need a closer look.</h3>
            <div className="mt-5 max-w-[48ch] space-y-4 text-body">
              <p>
                A blazer, saree or sherwani isn&apos;t the same job as everyday laundry. We check the
                garment and visible stains before cleaning starts.
              </p>
              <p>
                Some stains cannot be fully removed. If something needs extra attention, we&apos;ll
                explain the options first.
              </p>
            </div>
            <div className="mt-5">
              <TextLink href={SERVICES.dryCleaning.href} placement="process_delicate">
                See Dry Cleaning
              </TextLink>
            </div>
          </div>
        </div>
        ) : null}
      </div>
      <ProcessScrollSync rootId="process" />
    </section>
  );
}
