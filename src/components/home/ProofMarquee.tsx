import type { ReactNode } from "react";
import { Marquee } from "@/components/ui/Marquee";
import { FREE_DELIVERY_THRESHOLD, LOCATIONS, REGULAR_FREE_DELIVERY_THRESHOLD } from "@/content/site";

const Icon = ({ children }: { children: ReactNode }) => (
  <span aria-hidden="true" className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-soft text-blue">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="size-5">
      {children}
    </svg>
  </span>
);

const ICONS = {
  star: <path d="m12 3.5 2.6 5.3 5.9.8-4.3 4.1 1 5.8L12 16.8l-5.2 2.7 1-5.8-4.3-4.1 5.9-.8z" />,
  pin: (
    <>
      <path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z" />
      <circle cx="12" cy="10" r="2.3" />
    </>
  ),
  truck: (
    <>
      <path d="M3 6.5h11v9H3zM14 10h4l3 3v2.5h-7z" />
      <circle cx="7" cy="17.5" r="1.8" />
      <circle cx="17.5" cy="17.5" r="1.8" />
    </>
  ),
  repeat: <path d="M4 12a7 7 0 0 1 12-5l2 2M20 12a7 7 0 0 1-12 5l-2-2M18 4v5h-5M6 20v-5h5" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </>
  ),
  tag: (
    <>
      <path d="M3.5 12.5V4h8.5l8.5 8.5-8.5 8.5z" />
      <circle cx="8" cy="8.5" r="1.4" />
    </>
  ),
  check: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="m8.2 12.3 2.6 2.6 5-5.3" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="6" />
      <path d="m20 20-4.5-4.5" />
    </>
  ),
  store: <path d="M4 9.5 5.5 4h13L20 9.5M4 9.5h16M5 9.5V20h14V9.5M9.5 20v-5h5v5" />,
};

const [s11, s18] = LOCATIONS;

/** Facts only from the spec and owner confirmations — never invented stats. */
const ITEMS: { icon: keyof typeof ICONS; title: string; sub: string }[] = [
  { icon: "star", title: `${s11.rating} on Google`, sub: `${s11.name} · ${s11.reviewCount} reviews` },
  { icon: "pin", title: "Uttara Sectors 1–18", sub: "Pickup from your door" },
  { icon: "truck", title: "Free pickup & delivery", sub: `On orders of ${FREE_DELIVERY_THRESHOLD}+` },
  { icon: "repeat", title: `${REGULAR_FREE_DELIVERY_THRESHOLD}+ on regular pickups`, sub: "Weekly or fortnightly" },
  { icon: "clock", title: "Usually around 72 hours", sub: "Dry Cleaning & Wash & Iron" },
  { icon: "tag", title: "Every item tagged", sub: "At check-in, to your order" },
  { icon: "check", title: "Checked before packing", sub: "Quality check on every order" },
  { icon: "search", title: "Prices you can check", sub: "Per item, before you send" },
  { icon: "star", title: `${s18.rating} on Google`, sub: `${s18.name} · ${s18.reviewCount} reviews` },
  { icon: "store", title: "Two outlets", sub: `${s11.name} & ${s18.name}` },
];

/** Moving proof strip directly under the hero. */
export function ProofMarquee() {
  return (
    <section aria-label="Why people use Velto" className="border-y border-line bg-white py-5 md:py-6">
      <div className="container-page">
        <Marquee label="Velto facts" seconds={55} gapClass="gap-3" toggleAt="side">
          {ITEMS.map((item) => (
            <div
              key={item.title}
              className="inline-flex shrink-0 items-center gap-3 rounded-full border border-line bg-white py-2 pl-2 pr-6"
            >
              <Icon>{ICONS[item.icon]}</Icon>
              <span className="whitespace-nowrap">
                <span className="block t-small font-semibold text-navy">{item.title}</span>
                <span className="block t-caption text-secondary">{item.sub}</span>
              </span>
            </div>
          ))}
        </Marquee>
      </div>
    </section>
  );
}
