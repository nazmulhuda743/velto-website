/**
 * MOCK — temporary homepage development data (spec §27).
 *
 * Everything in this file is a placeholder and must be replaced with verified
 * material before launch. Nothing here is a real review, price or Velto photograph.
 */

export type ImageSlot = {
  /** Path under /public once production photography is supplied. null = MOCK placeholder. */
  src: string | null;
  /**
   * Alt text (§24). While src is null this is the shot brief. For licensed stock
   * photography it must describe what the photo actually shows and must not
   * present stock people, places or tags as Velto's own staff, outlets or SOPs.
   */
  alt: string;
  /** Intrinsic dimensions of the final image; used to reserve space. */
  width: number;
  height: number;
  /** CSS object-position focal point used when the component crops the photo. */
  position?: string;
  /** Provenance for licensed stock (mirrored in docs/brand/IMAGE-SOURCES.md). */
  source?: { platform: string; url: string; photographer?: string };
};

const slot = (alt: string, width: number, height: number): ImageSlot => ({
  src: null,
  alt,
  width,
  height,
});

/**
 * Licensed Pexels stock photography (Pexels License), stored in
 * public/images/home and credited in docs/brand/IMAGE-SOURCES.md.
 *
 * TRUST RULE: these photos are illustrative. Alt text describes what each
 * photo shows and never presents stock people, places or tags as Velto's own
 * staff, outlets or SOP evidence. Replace with real Velto photography before
 * launch, especially for intake, tagging, QC, packing, riders and outlets.
 */
const stock = (
  file: string,
  alt: string,
  width: number,
  height: number,
  pexelsId: number,
  photographer: string,
  position?: string,
): ImageSlot => ({
  src: `/images/home/${file}.jpg`,
  alt,
  width,
  height,
  position,
  source: { platform: "Pexels", url: `https://www.pexels.com/photo/${pexelsId}/`, photographer },
});

export const IMAGES = {
  hero: stock(
    "hero",
    "A courier at a doorway holding out two packed paper-bag orders.",
    2400, 1600, 6969972, "Mikhail Nilov", "center 40%",
  ),
  dryCleaning: stock(
    "dry-cleaning",
    "A dark suit jacket with shirt and tie on a tailor's mannequin.",
    1600, 2400, 6764952, "Tima Miroshnichenko", "center 42%",
  ),
  washAndIron: stock(
    "wash-and-iron",
    "A stack of neatly folded shirts held in two hands.",
    2400, 1600, 4440574, "Polina Tankilevitch", "40% center",
  ),
  ironing: stock(
    "ironing",
    "Hands pressing a white shirt with a steam iron.",
    2400, 1600, 5901624, "cottonbro studio", "40% 60%",
  ),
  household: stock(
    "household-curtains",
    "Sheer white curtains being drawn open at a bright window.",
    2400, 1600, 6619046, "Thirdman", "35% center",
  ),
  process: [
    stock("process-01-collected", "A courier holding out a packed box order at a doorway.", 2400, 1600, 6969971, "Mikhail Nilov", "center"),
    stock("process-02-received", "A tailor and a customer reviewing a garment order together.", 2400, 1600, 6764934, "Tima Miroshnichenko", "55% center"),
    stock("process-03-tagged", "A blank paper tag on a string resting on folded fabric.", 2400, 1599, 11485130, "Andrzej Gdula", "center"),
    stock("process-04-checked", "Hands checking the sleeve of a checked wool jacket.", 1600, 2400, 6764947, "Tima Miroshnichenko", "center 40%"),
    stock("process-05-finished", "Hands pressing a garment with a steam iron.", 1600, 2400, 5901623, "cottonbro studio", "center 55%"),
    stock("process-06-qc", "A person checking finished garments on a rail in a bright studio.", 2400, 1602, 3965552, "Ksenia Chernaya", "30% center"),
    stock("process-07-packed", "Hands stacking neatly folded shirts on a navy blanket.", 2400, 1600, 4440571, "Polina Tankilevitch", "center"),
    stock("process-08-returned", "A customer picking up a stack of packed orders at her front door.", 1600, 2400, 6969968, "Mikhail Nilov", "center 60%"),
  ],
  delicate: stock(
    "delicate",
    "Close-up of a wool coat lapel over a striped shirt and tie.",
    2400, 1600, 6764932, "Tima Miroshnichenko", "center",
  ),
  householdSection: stock(
    "household-section",
    "Hands rolling up a woven jute rug on a wooden floor.",
    2400, 1600, 7217758, "Blue Bird", "60% center",
  ),
  /** No suitable bedding photography yet: MOCK placeholder rather than a mismatched stock image. */
  blankets: slot("Folded comforters and blankets received for cleaning.", 1600, 1200),
  curtainsMeasured: slot("Curtain panels being measured for a quote.", 1600, 1200),
  carpetMeasured: slot("A carpet being measured for a quote.", 1600, 1200),
  /** Real Velto outlets: never substituted with stock storefronts. MOCK until supplied. */
  locations: {
    "sector-11": slot("The Velto outlet at House 2, Road 14, Sector 11, Uttara.", 1500, 1000),
    "sector-18": slot("The Velto outlet at Poncoboti Bazar, Sector 18, Uttara.", 1500, 1000),
  },
  regular: stock(
    "regular",
    "Folded shirts laid out in a row on a navy blanket.",
    2400, 1600, 4440566, "Polina Tankilevitch", "center",
  ),
  final: stock(
    "final",
    "Hands placing a folded white shirt on a neat stack.",
    2400, 1600, 4440572, "Polina Tankilevitch", "center",
  ),
} as const;

export type Review = {
  /** TODO_VERIFY: exact reviewer name. */
  name: string | null;
  platform: "Google" | "Facebook";
  /** Rating out of 5, or "recommends" for Facebook recommendations. */
  rating: number | "recommends" | null;
  /** TODO_VERIFY: exact, unedited customer text. null = placeholder. */
  text: string | null;
  sourceUrl: string | null;
};

/** MOCK: review slots for "What customers noticed". Never fill with invented text. */
export const REVIEWS: Review[] = [
  { name: null, platform: "Google", rating: null, text: null, sourceUrl: null },
  { name: null, platform: "Google", rating: null, text: null, sourceUrl: null },
  { name: null, platform: "Google", rating: null, text: null, sourceUrl: null },
  { name: null, platform: "Facebook", rating: null, text: null, sourceUrl: null },
];

/** TODO_VERIFY: verified repeat-customer review for Regular laundry. Rendered only when present. */
export const REGULAR_REVIEW: Review | null = null;
