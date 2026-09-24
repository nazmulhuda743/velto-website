/**
 * MOCK — temporary homepage development data (spec §27).
 *
 * Everything in this file is a placeholder and must be replaced with verified
 * material before launch. Nothing here is a real review, price or photograph.
 */

export type ImageSlot = {
  /** Path under /public once production photography is supplied. null = MOCK placeholder. */
  src: string | null;
  /** Meaningful alt text describing the evidence the photo shows (§24). */
  alt: string;
  /** Intrinsic dimensions of the final image; used to reserve space. */
  width: number;
  height: number;
};

const slot = (alt: string, width: number, height: number): ImageSlot => ({
  src: null,
  alt,
  width,
  height,
});

/** MOCK: production photography shot list. */
export const IMAGES = {
  hero: slot(
    "Velto rider handing a packed order to a customer at their door in Uttara.",
    1500,
    1800,
  ),
  dryCleaning: slot(
    "A Velto team member checking the lapel of a blazer before dry cleaning.",
    1800,
    1200,
  ),
  washAndIron: slot("Freshly ironed shirts folded and stacked for a customer's order.", 1600, 1200),
  ironing: slot("A shirt being pressed on an ironing board at Velto.", 1600, 1200),
  household: slot("Curtains being measured before cleaning at Velto.", 1600, 1200),
  process: [
    slot("Velto rider collecting a laundry bag from a customer's door.", 1400, 1600),
    slot("An order being checked in at the Velto counter.", 1400, 1600),
    slot("Velto staff attaching an order tag to a customer's garment during intake.", 1400, 1600),
    slot("A team member inspecting a visible stain on a shirt collar before cleaning.", 1400, 1600),
    slot("A garment being pressed and finished after cleaning.", 1400, 1600),
    slot("A finished garment being checked before packing.", 1400, 1600),
    slot("A finished order being folded and packed for return.", 1400, 1600),
    slot("Velto rider delivering a packed order back to the customer.", 1400, 1600),
  ],
  delicate: slot("A saree being examined closely before dry cleaning.", 1400, 1600),
  householdSection: slot(
    "Curtains, a rolled carpet and a folded comforter received for cleaning.",
    1600,
    1200,
  ),
  locations: {
    "sector-11": slot("The Velto outlet at House 2, Road 14, Sector 11, Uttara.", 1500, 1000),
    "sector-18": slot("The Velto outlet at Poncoboti Bazar, Sector 18, Uttara.", 1500, 1000),
  },
  regular: slot("A week's laundry being handed to a Velto rider for regular pickup.", 1600, 1200),
  final: slot("A packed Velto order ready to go out for delivery.", 1600, 1200),
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
