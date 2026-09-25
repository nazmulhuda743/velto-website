import type { ReactNode } from "react";
import { SectionIntro } from "@/components/home/SectionIntro";
import { ResponsiveImage } from "@/components/ui/ResponsiveImage";
import { IMAGES, type ImageSlot } from "@/content/mock";

type Group = { label: string; image: ImageSlot; steps: { title: string; copy: string }[] };

/**
 * The full operational sequence (How It Works), grouped into four stages so
 * ten steps scan as one short read rather than ten equal rows. Copy reuses
 * the approved step wording from the service pages.
 */
const GROUPS: Group[] = [
  {
    label: "Collect and check in",
    image: IMAGES.process[2],
    steps: [
      { title: "Pickup", copy: "We collect the order from your address in Uttara." },
      { title: "Structured intake", copy: "The order is counted and connected to you." },
      { title: "Identification and tagging", copy: "Each item is tagged so it stays with your order from check-in to packing." },
    ],
  },
  {
    label: "Assess and route",
    image: IMAGES.process[3],
    steps: [
      { title: "Assessment", copy: "We look over the fabric, condition and visible stains before choosing the treatment." },
      { title: "Service routing", copy: "Each item goes to the treatment it was assessed for." },
    ],
  },
  {
    label: "Clean and finish",
    image: IMAGES.process[4],
    steps: [
      { title: "Cleaning", copy: "Each item is cleaned for the booked service." },
      { title: "Finishing", copy: "It is then pressed or finished where needed." },
    ],
  },
  {
    label: "Check and return",
    image: IMAGES.process[6],
    steps: [
      { title: "Quality check", copy: "Finished items are checked again before they are packed." },
      { title: "Packaging", copy: "Your finished order is organised and packed for delivery." },
      { title: "Delivery", copy: "Delivery is arranged back to your address." },
    ],
  },
];

const num = (i: number) => String(i + 1).padStart(2, "0");
/** Running step number where each group starts (01–10 across the groups). */
const OFFSETS = GROUPS.map((_, g) => GROUPS.slice(0, g).reduce((sum, grp) => sum + grp.steps.length, 0));

export function OperationalProcess({ title, intro }: { title: string; intro?: ReactNode }) {
  return (
    <section id="process" aria-labelledby="process-title" className="py-(--space-section)">
      <div className="container-page">
        <SectionIntro id="process-title" eyebrow="After pickup" title={title} titleClassName="max-w-[18ch]">
          {intro}
        </SectionIntro>
        <ol className="mt-(--space-intro-content) grid list-none gap-x-5 gap-y-12 md:grid-cols-2 md:gap-y-16 xl:gap-x-6">
          {GROUPS.map((group, g) => (
            <li key={group.label}>
              <ResponsiveImage
                image={group.image}
                aspect="aspect-[2/1] md:aspect-[16/10]"
                sizes="(min-width: 1200px) 610px, (min-width: 768px) 50vw, 100vw"
              />
              <p className="mt-5 t-label uppercase text-blue md:mt-6">Stage {g + 1} of 4</p>
              <h3 className="mt-1.5 t-h3 text-navy">{group.label}</h3>
              <ol className="mt-4 list-none border-b border-line">
                {group.steps.map((step, i) => (
                  <li key={step.title} className="grid grid-cols-[2.75rem_1fr] gap-x-3 border-t border-line py-3.5">
                    <span className="t-label pt-[3px] text-secondary">{num(OFFSETS[g] + i)}</span>
                    <p>
                      <span className="font-semibold text-navy">{step.title}.</span>{" "}
                      <span className="text-secondary">{step.copy}</span>
                    </p>
                  </li>
                ))}
              </ol>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
