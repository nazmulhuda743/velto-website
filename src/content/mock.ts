/**
 * MOCK — temporary homepage development data (spec §27).
 *
 * Images here are placeholders or licensed stock and must be replaced with real
 * Velto photography before launch. The reviews are verified, owner-supplied
 * Google reviews. No prices live in this file.
 */

export type ImageSlot = {
  /** Stable slot id ("hero", "process.3") used by the admin dashboard to replace the photo. */
  id?: string;
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
  source?: { platform: string; url?: string; photographer?: string };
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

/**
 * Photography supplied by the Velto owner (batch received 2026-09-25), stored
 * in public/images/home and listed in docs/brand/IMAGE-SOURCES.md. Origin and
 * licence are to be confirmed by the owner. The same trust rule applies: alt
 * text describes what the photo shows and does not present the people in it
 * as Velto staff.
 */
const supplied = (file: string, alt: string, width: number, height: number, position?: string): ImageSlot => ({
  src: `/images/home/${file}.webp`,
  alt,
  width,
  height,
  position,
  source: { platform: "Supplied by Velto" },
});

/**
 * Licensed Pexels stock for internal pages (Pexels License), optimised to WebP
 * in public/images/pages and credited in docs/brand/IMAGE-SOURCES.md. Same
 * trust rule as `stock`.
 */
const pageStock = (
  file: string,
  alt: string,
  width: number,
  height: number,
  pexelsId: number,
  photographer: string,
  position?: string,
): ImageSlot => ({
  src: `/images/pages/${file}.webp`,
  alt,
  width,
  height,
  position,
  source: { platform: "Pexels", url: `https://www.pexels.com/photo/${pexelsId}/`, photographer },
});

export const IMAGES = {
  hero: supplied(
    "hero",
    "A courier in a navy cap handing a bundle of garments in clear covers to a smiling woman at her front door.",
    1030, 1448, "center 30%",
  ),
  dryCleaning: supplied(
    "dry-cleaning",
    "A hand holding up a grey suit jacket in a clear garment cover on a wooden hanger, with covered garments on rails behind.",
    1619, 971, "center 40%",
  ),
  washAndIron: supplied(
    "wash-and-iron",
    "A heap of everyday clothes, including shirts, jeans, chinos and knitwear, on a living-room table.",
    1430, 1100, "center 55%",
  ),
  ironing: supplied(
    "ironing",
    "A person holding a stack of neatly folded shirts beside a steam iron on an ironing board.",
    1254, 1254, "45% 55%",
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
  blankets: pageStock(
    "bedding-folded",
    "A folded herringbone wool blanket on a folded cream blanket, on a wooden table.",
    1600, 2400, 11125918, "Qiana Zhang", "center 62%",
  ),
  /** Supporting bedding image (blanket page process block). */
  bedding: pageStock(
    "bedding-linen-stack",
    "A neat stack of folded white bed sheets and pillowcases.",
    2000, 1333, 31902663, "chikawaztla", "center 55%",
  ),
  carpet: pageStock(
    "carpet-woven",
    "A woven grey carpet under the corner of a blue sofa.",
    1600, 1067, 35964344, "Thomas Parker", "center",
  ),
  express: pageStock(
    "express-shirt-hanger",
    "A hand holding up a pressed green shirt on a wooden hanger.",
    2000, 1334, 9594952, "Ron Lach", "55% center",
  ),
  about: pageStock(
    "finished-shirts-rail",
    "A row of pressed linen shirts on wooden hangers along a rail.",
    1600, 2400, 17293343, "nguyendesigner", "center 35%",
  ),
  curtainsMeasured: slot("Curtain panels being measured for a quote.", 1600, 1200),
  carpetMeasured: slot("A carpet being measured for a quote.", 1600, 1200),
  /** Real Velto outlets: never substituted with stock storefronts. MOCK until supplied. */
  locations: {
    // Real outlet photo supplied by the owner (2026-09-25). Focal point keeps the Velto sign in crop.
    "sector-11": {
      src: "/images/locations/sector-11.webp",
      alt: "The Velto Sector 11 outlet at night: the lit Velto sign above the entrance, with service posters in the window.",
      width: 1112,
      height: 1280,
      position: "center top",
      source: { platform: "Supplied by Velto" },
    },
    "sector-18": slot("The Velto outlet at Poncoboti Bazar, Sector 18, Uttara.", 1500, 1000),
  },
  regular: supplied(
    "regular",
    "Freshly folded shirts, trousers and sweaters laid out in neat stacks.",
    1536, 1024, "center",
  ),
  final: stock(
    "final",
    "Hands placing a folded white shirt on a neat stack.",
    2400, 1600, 4440572, "Polina Tankilevitch", "center",
  ),
} as const;

/** Every image slot with its id, for the admin dashboard. Ids are assigned in place. */
export const IMAGE_SLOTS: { id: string; slot: ImageSlot }[] = [];
(function assignIds(node: unknown, path: string) {
  if (Array.isArray(node)) {
    node.forEach((child, i) => assignIds(child, `${path}.${i}`));
  } else if (node && typeof node === "object") {
    if ("alt" in node && "width" in node) {
      (node as ImageSlot).id = path;
      IMAGE_SLOTS.push({ id: path, slot: node as ImageSlot });
      return;
    }
    for (const [k, v] of Object.entries(node)) assignIds(v, path ? `${path}.${k}` : k);
  }
})(IMAGES, "");

export type Review = {
  /** TODO_VERIFY: exact reviewer name. */
  name: string | null;
  platform: "Google" | "Facebook";
  /** Outlet profile the review was left on (never merged across branches). */
  branch?: "sector-11" | "sector-18";
  /** Rating out of 5, or "recommends" for Facebook recommendations. */
  rating: number | "recommends" | null;
  /** TODO_VERIFY: exact, unedited customer text. null = placeholder. */
  text: string | null;
  /**
   * Optional pull line: an exact substring of `text`, never reworded. It is
   * only shown if it still matches the text character for character.
   */
  highlight?: string;
  sourceUrl: string | null;
  /**
   * Service pages this review speaks to (service slugs, or "regular-laundry").
   * Optional: untagged reviews are matched from their own words (src/lib/reviews.ts).
   */
  services?: string[];
  /** Google's relative date ("3 months ago"), shown only for reviews fetched live from Google. */
  relativeTime?: string;
  /** "google_live" = fetched from the Google Places API; otherwise owner-verified. */
  origin?: "verified" | "google_live";
};

/**
 * Verified Google reviews supplied by the owner, with the outlet profile each
 * was left on. Text is transcribed exactly; paragraphs are separated by a blank
 * line. Without a direct review link, the outlet's Google reviews are linked.
 */
export const REVIEW_FAHIM: Review = {
  name: "Mahmudur Rahman Fahim",
  platform: "Google",
  branch: "sector-18",
  rating: 5,
  text: "I’ve been living in RUAP in my own residence for the past three years, and during this time, I’ve tried at least 8–10 different laundry services. Honestly, the experience was always horrible.\n\nThen I connected with Velto, and since then, the experience has been absolutely top-notch. I’ve never experienced this level of professionalism from any laundry service before.\n\nPlease keep up the good work and continue providing us with such amazing service.\n\nThank you! ❤️",
  highlight: "I’ve never experienced this level of professionalism from any laundry service before.",
  sourceUrl: null,
  // A long-term customer comparing Velto with other laundries: regular and everyday laundry.
  services: ["regular-laundry", "wash-and-iron"],
};

export const REVIEW_ANGELA: Review = {
  name: "Angela Sung",
  platform: "Google",
  branch: "sector-11",
  rating: 5,
  text: "Near midnight,  after discovering to my horror all beddings and comforter were soiled by my kittens, I decided to try my luck and made a frantic whatsapp sos to Velto for help.  To my surprise, I received an immediate response from Mr. Nazmul, CEO of Velto, at such late hour (sorry).\nHe was extremely professional and provided sound advice to the services required for my many concerns.\n\nPrompt collection was done at my door next early morning and was delivered right at the scheduled time.\n\nAll my cleaned laundry were carefully packed, properly labeled for traceability and validated with quality check. My soiled beddings and comforter from nightmare were returned to me looking pristine, smelling fresh and clean, exactly as what Mr. Nazmul@Velto had assured and committed.\n\nVelto has indeed lived up to their claim of being \"Premium Laundry at your Doorstep\".  I am happy to have found a jewel in Uttara and have Velto a door step away.\n\nFor all folks like me who cares about your cherishables, Velto is the indubitable choice for assurance in professionalism to take care of all your necessities.\n\nI found Velto noteworthy to be:\n1) prompt & accurate in status update;\n2) attentive to quality assurance;\n3) service oriented and reliable.\n\nLastly, a note of appreciation to rider Moniruzzaman for always keeping a pleasant smile and doing the rounds.\n\nKittens Soiling - No panic - Call Velto ~\nHappy New Year Everybody ~",
  highlight: "All my cleaned laundry were carefully packed, properly labeled for traceability and validated with quality check.",
  sourceUrl: null,
  services: ["blanket-comforter-cleaning"],
};

export const REVIEW_ETR: Review = {
  name: "ETR I SAI",
  platform: "Google",
  branch: "sector-11",
  rating: 5,
  text: "Very satisfied after received my laundry, items smells very nice. Excellent service. Friendly Pro staff. Reasonable price. Will comeback for this laundry service.",
  sourceUrl: null,
  services: ["wash-and-iron"],
};

/** "What customers noticed" (homepage). */
export const REVIEWS: Review[] = [REVIEW_FAHIM, REVIEW_ANGELA, REVIEW_ETR];

/** TODO_VERIFY: verified repeat-customer review for Regular laundry. Rendered only when present. */
export const REGULAR_REVIEW: Review | null = null;
