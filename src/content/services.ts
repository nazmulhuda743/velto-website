/**
 * Service page content.
 *
 * Facts come from docs/PROJECT-BUILD-SPEC.md (§4 turnaround/express/delivery,
 * §5 verified workflows, §7 household quote logic) and from the live Velto
 * price list, which is only ever read through the public pricing view: this
 * file names the items a page features, never their prices.
 * Anything that still needs live verification is marked TODO_VERIFY.
 */
import { IMAGES, REVIEW_ANGELA, type ImageSlot, type Review } from "./mock";
import type { FAQ_KEYS } from "@/components/home/FAQ";
import type { Step } from "@/components/pages/ProcessSteps";
import { keepBanglaSuffixes, type Locale } from "@/lib/i18n/config";
import { SERVICE_PAGES_BN } from "./i18n/services.bn";

export type ServiceSlug =
  | "dry-cleaning"
  | "wash-and-iron"
  | "ironing"
  | "curtain-cleaning"
  | "carpet-cleaning"
  | "blanket-comforter-cleaning"
  | "express";

/** Service slugs used by the public pricing view. */
export type PriceColumn = "dry-cleaning" | "wash-and-iron" | "ironing";

export type CustomFAQ = { q: string; a: string[] };
export type FAQRef = keyof typeof FAQ_KEYS | CustomFAQ;

export type ServiceBlock =
  | {
      type: "scope";
      title: string;
      intro?: string;
      groups: { title: string; copy: string }[];
    }
  | {
      type: "prices";
      title: string;
      intro: string;
      columns: PriceColumn[];
      /** Exact item names in the price list, grouped for display. */
      groups: { label: string; names: string[] }[];
      note?: string;
      /** Pre-filled search for the "look up another item" link. */
      searchHint?: string;
    }
  | {
      type: "process";
      title: string;
      intro: string;
      steps: Step[];
      /** Optional: without a photo the block uses the plain two-column text layout. */
      image?: ImageSlot;
    }
  | {
      type: "notes";
      title: string;
      intro?: string;
      items: { title: string; copy: string }[];
    }
  | { type: "compare"; title: string; intro?: string; current: "wash-and-iron" | "ironing" | "dry-cleaning" | null }
  | {
      type: "measure";
      title: string;
      intro: string;
      steps: Step[];
      examples: { label: string; value: string }[];
      note: string;
    }
  | {
      type: "facts";
      title: string;
      intro?: string;
      rows: { label: string; value: string }[];
      /** Text + link rendered under the rows. */
      footnote?: string;
      steps?: { title: string; steps: Step[] };
    }
  | { type: "review"; title: string; review: Review };

export type ServiceContent = {
  slug: ServiceSlug;
  name: string;
  /** Situation-first line used on the services decision page. */
  whenToChoose: string;
  /** One-line answer to "how is it priced / how long". */
  overviewFact: string;
  h1: string;
  /** The one phrase of the H1 set in Velto blue (must appear in h1 exactly). */
  h1Highlight?: string;
  intro: string[];
  image: ImageSlot;
  /** Book-first for itemised services; quote-first where the amount needs confirming. */
  primary: "book" | "quote";
  secondary?: "book" | "quote" | "whatsapp";
  /**
   * "At a glance" band under the hero (S1). Restates facts already on the page
   * (overviewFact, the former hero facts, whenToChoose); never a new claim.
   */
  glance: { pricing: string; turnaround: string; bestFor: string };
  heroGoogleProof?: boolean;
  blocks: ServiceBlock[];
  faq: { title: string; items: FAQRef[] };
  final: { title: string; body: string };
  meta: { title: string; description: string };
};

const RETURN_STEPS: Step[] = [
  { title: "Checked before packing", copy: "Finished items are checked again before they are packed." },
  { title: "Packed and returned", copy: "Your order is packed and delivered back to your address." },
];


export const SERVICE_PAGES: ServiceContent[] = [
  {
    slug: "dry-cleaning",
    name: "Dry Cleaning",
    whenToChoose: "A suit, blazer, sari, sherwani or anything that needs a closer look before cleaning.",
    overviewFact: "Priced per item · usually around 72 hours",
    h1: "Dry cleaning for garments that need a closer look.",
    h1Highlight: "a closer look",
    intro: [
      "Suits, blazers, saris and sherwanis are checked in, tagged and looked over before any cleaning starts. We collect from your door in Uttara and bring them back finished and packed.",
    ],
    image: IMAGES.dryCleaning,
    primary: "book",
    secondary: "whatsapp",
    glance: { pricing: "Per item, each garment has its own price", turnaround: "Usually around 72 hours", bestFor: "A suit, blazer, sari, sherwani or anything that needs a closer look before cleaning." },
    heroGoogleProof: true,
    blocks: [
      {
        type: "scope",
        title: "What people send for dry cleaning",
        intro: "Every item below has its own line on the Velto price list.",
        groups: [
          { title: "Suits, blazers and coats", copy: "From a single blazer to three-piece suits, overcoats and waistcoats." },
          { title: "Saris", copy: "Cotton, silk, katan, Jamdani, Tangail and Banarasi saris are each priced separately." },
          { title: "Occasion and ethnic wear", copy: "Sherwanis, silk panjabis, lehengas, gowns and heavy kamiz suits." },
          { title: "Winter wear", copy: "Shawls, sweaters, cardigans and jackets." },
        ],
      },
      {
        type: "process",
        title: "What happens to a garment after you hand it over",
        intro: "Each garment is assessed and routed to the treatment it needs, rather than handled as anonymous laundry.",
        image: IMAGES.process[3],
        steps: [
          { title: "Collected", copy: "We collect the order from your address in Uttara." },
          { title: "Checked in", copy: "The order is counted and connected to you." },
          { title: "Identified and tagged", copy: "Each garment is tagged so it stays with your order from check-in to packing." },
          { title: "Garment and stain assessment", copy: "We look over the fabric, condition and visible stains before choosing the treatment." },
          { title: "Routed to the right treatment", copy: "The garment goes to the treatment it was assessed for." },
          { title: "Dry cleaned, finished and pressed", copy: "After cleaning, it is pressed and finished." },
          { title: "Quality check", copy: "Finished garments are checked again before they are packed." },
          { title: "Packed and returned", copy: "Your order is packed and delivered back to your address." },
        ],
      },
      {
        type: "prices",
        title: "Current dry cleaning prices",
        intro: "A selection from the Velto price list. Search for anything else before you book.",
        columns: ["dry-cleaning"],
        groups: [
          { label: "Suits and jackets", names: ["Blazer", "Suit (2pc)", "Suit (3pc)", "Coat", "Overcoat", "Waist Coat"] },
          { label: "Saris", names: ["Sari (Cotton)", "Sari (Silk)", "Sari (Silk Jamdani)", "Sari (Katan)", "Banarashi (Normal)", "Banarashi (Heavy)"] },
          { label: "Occasion wear", names: ["Sherwani", "Panjabi (Silk/Heavy)", "Kamiz Suit (3pc Heavy)", "Lahanga (Heavy 2pc)", "Gown"] },
          { label: "Priced after inspection", names: ["Wedding Gown", "Leather Jacket"] },
        ],
        searchHint: "saree",
      },
      {
        type: "notes",
        title: "Before you send something valuable",
        items: [
          {
            title: "Tell us what worries you",
            copy: "Mention a stain, a delicate detail or anything you're unsure about in the booking notes, or send a photo on WhatsApp before pickup.",
          },
          {
            title: "Stains are checked, not promised",
            copy: "We look at visible stains before cleaning and treat them for the garment and service. Some stains cannot be fully removed. If something needs extra attention, we'll explain the options first.",
          },
          {
            title: "Timing",
            copy: "Dry cleaning is usually around 72 hours. Special garments and unusual conditions may take longer.",
          },
          {
            title: "Need it sooner?",
            copy: "Express may be possible depending on the item and current workload. Ask before you book.",
          },
        ],
      },
    ],
    faq: {
      title: "Questions people ask before sending a garment.",
      items: [
        "stains",
        {
          q: "What if my garment isn't on the price list?",
          a: [
            "Send a photo on WhatsApp or mention it when you book.",
            "Some items, such as wedding gowns and leather jackets, are priced after Velto has seen them.",
          ],
        },
        "turnaround",
        "express",
        "unsure",
      ],
    },
    final: {
      title: "Send your dry cleaning.",
      body: "Tell us where to collect from and what you are sending. If a garment needs a closer look, mention it in the notes.",
    },
    meta: {
      title: "Dry Cleaning in Uttara: Suits, Saris & Sherwanis | Velto",
      description:
        "Dry cleaning with pickup across Uttara Sectors 1–18. Garments are tagged and checked for stains before cleaning. See current prices for suits, blazers and saris.",
    },
  },
  {
    slug: "wash-and-iron",
    name: "Wash & Iron",
    whenToChoose: "Everyday clothes and linen that need washing and ironing.",
    overviewFact: "Priced per item · usually around 72 hours",
    h1: "Everyday laundry, washed, ironed and brought back.",
    h1Highlight: "brought back",
    intro: [
      "Shirts, trousers, kamiz and bed sheets are counted and tagged to your order, then washed, dried, ironed and packed. They come back ready to wear or put away.",
    ],
    image: IMAGES.washAndIron,
    primary: "book",
    secondary: "whatsapp",
    glance: { pricing: "Per item, from the Velto price list", turnaround: "Usually around 72 hours", bestFor: "Everyday clothes and linen that need washing and ironing." },
    blocks: [
      {
        type: "prices",
        title: "What Wash & Iron costs",
        intro: "Priced per item. These are some of the pieces people send most often.",
        columns: ["wash-and-iron"],
        groups: [
          { label: "Everyday wear", names: ["Shirt", "T-Shirt", "Pant", "Jeans", "Kamiz", "Salwar", "Panjabi", "Kurta"] },
          { label: "Around the house", names: ["Bed Sheet (Medium)", "Bed Sheet (Large)", "Pillow Cover", "Towel (Bath)"] },
        ],
        searchHint: "shirt",
      },
      {
        type: "compare",
        title: "Wash & Iron or Ironing?",
        intro: "If the clothes are already clean, Ironing costs less per piece.",
        current: "wash-and-iron",
      },
      {
        type: "process",
        title: "What Wash & Iron includes",
        intro: "Items are counted and tagged before washing, so everything that goes out comes back to the right order.",
        image: IMAGES.process[6],
        steps: [
          { title: "Collected", copy: "We collect the order from your address in Uttara." },
          { title: "Counted and tagged", copy: "Items are counted, identified and tagged to your order." },
          { title: "Washed and dried", copy: "Items are routed to the right wash, then dried." },
          { title: "Ironed and finished", copy: "Everything is ironed and finished ready to wear." },
          ...RETURN_STEPS,
        ],
      },
      {
        type: "notes",
        title: "Who uses Wash & Iron",
        items: [
          {
            title: "Households sending a week's laundry",
            copy: "Put the week's clothes and linen together. Orders of ৳499+ qualify for free pickup and delivery.",
          },
          {
            title: "Office shirts and everyday wear",
            copy: "Shirts, trousers and kamiz come back ironed, so there is nothing left to do at home.",
          },
          {
            title: "People who send every week",
            copy: "Set up a fixed weekly or fortnightly pickup. Regular orders of ৳300+ then qualify for free pickup and delivery.",
          },
        ],
      },
    ],
    faq: {
      title: "Questions about Wash & Iron.",
      items: ["turnaround", "freeDelivery", "area"],
    },
    final: {
      title: "Send this week's laundry.",
      body: "Tell us where to collect from and when suits you. Orders of ৳499+ qualify for free pickup and delivery.",
    },
    meta: {
      title: "Wash & Iron Laundry Service in Uttara, Dhaka | Velto",
      description:
        "Everyday clothes and bed linen collected from your door in Uttara, washed, ironed and returned. Priced per item, usually around 72 hours.",
    },
  },
  {
    slug: "ironing",
    name: "Ironing",
    whenToChoose: "Clothes you've already washed at home that just need ironing.",
    overviewFact: "Priced per item · general orders usually around 48 hours",
    h1: "Already washed? Send it for ironing.",
    h1Highlight: "Send it for ironing",
    intro: [
      "Send clothes you've washed at home. We count and tag them to your order, iron and finish each piece, then pack them and bring them back.",
    ],
    image: IMAGES.ironing,
    primary: "book",
    secondary: "whatsapp",
    glance: { pricing: "Per item, from the Velto price list", turnaround: "General orders usually around 48 hours", bestFor: "Clothes you've already washed at home that just need ironing." },
    blocks: [
      {
        type: "prices",
        title: "Ironing prices",
        intro: "Priced per piece, straight from the Velto price list.",
        columns: ["ironing"],
        groups: [
          { label: "Everyday wear", names: ["Shirt", "T-Shirt", "Pant", "Trouser", "Kamiz", "Salwar", "Panjabi", "Kurta"] },
          { label: "Saris and linen", names: ["Sari (Cotton)", "Blouse", "Dupatta", "Bed Sheet (Large)"] },
        ],
        note: "Some items, such as towels, blankets and undergarments, don't have an ironing-only price.",
        searchHint: "shirt",
      },
      {
        type: "compare",
        title: "Only ironing, or washing too?",
        current: "ironing",
      },
      {
        type: "process",
        title: "How an ironing order is handled",
        intro: "Even an ironing-only order is counted and tagged, so it comes back complete.",
        image: IMAGES.process[4],
        steps: [
          { title: "Collected", copy: "We collect the clothes from your address in Uttara." },
          { title: "Counted and tagged", copy: "Items are counted and tagged to your order." },
          { title: "Ironed and finished", copy: "Each item is ironed and finished." },
          ...RETURN_STEPS,
        ],
      },
    ],
    faq: {
      title: "Questions about ironing.",
      items: [
        {
          q: "Can everything be sent for ironing only?",
          a: [
            "Not everything. Towels, blankets and undergarments, for example, don't have an ironing-only price.",
            "Search an item on the pricing page to see which services it has.",
          ],
        },
        "turnaround",
        "freeDelivery",
      ],
    },
    final: {
      title: "Send your ironing.",
      body: "Tell us where to collect from and roughly how much there is. That's enough to get started.",
    },
    meta: {
      title: "Ironing Service in Uttara with Pickup & Delivery | Velto",
      description:
        "Ironing for clothes already washed at home, collected and returned across Uttara Sectors 1–18. See the current per-piece ironing prices.",
    },
  },
  {
    slug: "curtain-cleaning",
    name: "Curtain Cleaning",
    whenToChoose: "Curtains from any room, normal or heavy.",
    overviewFact: "Priced per sq ft · amount confirmed before pickup",
    h1: "Curtain cleaning, priced by the square foot.",
    h1Highlight: "priced by the square foot",
    intro: [
      "Velto prices curtains per square foot, with separate rates for normal and heavy curtains. Tell us how many panels you have and roughly how big they are. We'll help you work out the price and confirm it when measurement or condition needs checking.",
    ],
    image: IMAGES.household,
    primary: "quote",
    secondary: "book",
    glance: { pricing: "Per sq ft, normal or heavy rate. Amount confirmed before pickup", turnaround: "Can take longer than everyday laundry. Confirmed with your quote", bestFor: "Curtains from any room, normal or heavy." },
    blocks: [
      {
        type: "prices",
        title: "Curtain rates",
        intro: "Rates per square foot of curtain, by service.",
        columns: ["dry-cleaning", "wash-and-iron", "ironing"],
        groups: [{ label: "Curtains", names: ["Curtain Normal (per sqft)", "Curtain Heavy (per sqft)"] }],
        note: "Not sure if yours count as normal or heavy? Send a photo on WhatsApp and Velto will tell you.",
      },
      {
        type: "measure",
        title: "Work out a rough size before you ask",
        intro: "You don't need exact measurements. An approximate size gets you a useful price guide.",
        steps: [
          { title: "Count the panels", copy: "Count each separate curtain panel, not each window." },
          { title: "Measure one panel", copy: "Width and length in feet. A tape measure is fine, approximate is fine." },
          { title: "Multiply", copy: "Width × length gives the square feet for one panel. Multiply by the number of panels." },
        ],
        examples: [
          { label: "One panel, 4 ft × 8 ft", value: "32 sq ft" },
          { label: "Four panels that size", value: "128 sq ft" },
        ],
        note: "Multiply the total by the rate above for a rough guide. Velto confirms the final amount when measurement or condition needs checking.",
      },
      {
        type: "process",
        title: "From quote to clean curtains",
        intro: "A few details up front means no surprises at pickup.",
        steps: [
          { title: "Tell us what you have", copy: "Send the number of panels and their approximate size, plus a photo on WhatsApp if it helps." },
          { title: "Price guidance", copy: "We guide you on the price from Velto's current rates." },
          { title: "Confirmation", copy: "We confirm the final amount when measurement or condition needs checking." },
          { title: "Pickup", copy: "We collect the curtains from your address in Uttara." },
          { title: "Checked in and tagged", copy: "Each panel is tagged to your order at intake." },
          { title: "Cleaned, checked and returned", copy: "Curtains are cleaned for the booked service, checked, packed and delivered back." },
        ],
      },
    ],
    faq: {
      title: "Curtain questions.",
      items: [
        "household",
        {
          q: "What is the difference between normal and heavy curtains?",
          a: [
            "Heavier curtains have their own rate.",
            "If you're not sure which yours are, send a photo on WhatsApp and Velto will tell you.",
          ],
        },
        {
          q: "How long does curtain cleaning take?",
          // TODO_VERIFY: current curtain turnaround range (spec §36).
          a: ["Curtains can take longer than everyday laundry. Velto confirms the timing with your quote."],
        },
        "area",
      ],
    },
    final: {
      title: "Start a curtain quote.",
      body: "Send the number of panels and their approximate size. It takes a minute, and there's no obligation.",
    },
    meta: {
      title: "Curtain Cleaning in Uttara, Priced per Sq Ft | Velto",
      description:
        "Curtain (porda) cleaning in Uttara with pickup from your door. See the current per-square-foot rates for normal and heavy curtains, then request a quote.",
    },
  },
  {
    slug: "carpet-cleaning",
    name: "Carpet Cleaning",
    whenToChoose: "A carpet, a doormat or a prayer mat.",
    overviewFact: "Priced per sq ft · amount confirmed before pickup",
    h1: "Carpet cleaning, priced by size.",
    h1Highlight: "priced by size",
    intro: [
      "Carpets are priced per square foot. Send the approximate length and width. Material and condition can change the final price, so Velto confirms it before pickup.",
    ],
    image: IMAGES.carpet,
    primary: "quote",
    secondary: "book",
    glance: { pricing: "Per sq ft. Amount confirmed before pickup", turnaround: "Takes longer than everyday laundry. Confirmed with your quote", bestFor: "A carpet, a doormat or a prayer mat." },
    blocks: [
      {
        type: "prices",
        title: "Carpet and mat prices",
        intro: "Carpets are priced per square foot. Doormats and mats are priced per piece.",
        columns: ["dry-cleaning", "wash-and-iron"],
        groups: [
          { label: "Carpets", names: ["Carpet (per sqft)"] },
          { label: "Doormats and mats, per piece", names: ["Paposh (Small)", "Paposh (Medium)", "Paposh (Large)", "Mat (Medium)", "Prayer Mat", "Prayer Mat (Heavy)"] },
        ],
      },
      {
        type: "measure",
        title: "Measure the carpet first",
        intro: "Length and width in feet is enough for a first price guide.",
        steps: [
          { title: "Measure the length and width", copy: "In feet, edge to edge. Approximate is fine." },
          { title: "Multiply", copy: "Length × width gives the square feet." },
          { title: "Note the material and condition", copy: "If you know the material, or there are stains or wear, mention it. A photo helps." },
        ],
        examples: [
          { label: "A 5 ft × 8 ft carpet", value: "40 sq ft" },
          { label: "An 8 ft × 10 ft carpet", value: "80 sq ft" },
        ],
        note: "Multiply by the rate above for a rough guide. When the size is uncertain or the material and condition change the work, Velto confirms the amount before pickup.",
      },
      {
        type: "facts",
        title: "What happens next",
        rows: [
          { label: "Price", value: "Velto guides you on the price, or prepares a quote." },
          { label: "Photo", value: "Optional. Send it on WhatsApp if the material or condition matters." },
          { label: "Confirmation", value: "Velto confirms the final amount before pickup." },
          // TODO_VERIFY: current carpet turnaround range (spec §36).
          { label: "Timing", value: "Carpets take longer than everyday laundry. Velto confirms timing with your quote." },
        ],
      },
    ],
    faq: {
      title: "Carpet questions.",
      items: [
        "household",
        {
          q: "Do you clean doormats and prayer mats?",
          a: ["Yes. They are priced per piece rather than per square foot, and the prices are listed on this page."],
        },
        "area",
        "freeDelivery",
      ],
    },
    final: {
      title: "Start a carpet quote.",
      body: "Send the approximate length and width. Add a photo on WhatsApp if the material or condition matters.",
    },
    meta: {
      title: "Carpet & Rug Cleaning in Uttara, per Sq Ft | Velto",
      description:
        "Carpet, rug and mat cleaning with pickup across Uttara. See the per-square-foot carpet rate and per-piece mat prices, then send the size for a quote.",
    },
  },
  {
    slug: "blanket-comforter-cleaning",
    name: "Blankets & Comforters",
    whenToChoose: "Blankets, comforters, quilts or katha.",
    overviewFact: "Priced per piece · plan for roughly 3–4 days",
    h1: "Blankets, comforters and quilts, priced by type and size.",
    h1Highlight: "priced by type and size",
    intro: [
      "Each blanket, comforter or quilt has a price per piece, set by its type and size, so you can see the cost before you book. Bedding takes longer than everyday laundry.",
    ],
    image: IMAGES.blankets,
    primary: "book",
    secondary: "quote",
    // TODO_VERIFY: planning range from spec §7, confirm against current operations.
    glance: { pricing: "Per piece, by type and size", turnaround: "Plan for roughly 3–4 days", bestFor: "Blankets, comforters, quilts or katha." },
    blocks: [
      {
        type: "prices",
        title: "Bedding prices",
        intro: "Per piece, by type and size.",
        columns: ["dry-cleaning", "wash-and-iron"],
        groups: [
          { label: "Blankets", names: ["Blanket (Small)", "Blanket (Regular/Medium)", "Blanket (Large/Heavy)", "Blanket (Baby)"] },
          { label: "Comforters", names: ["Comforter (Regular)", "Comforter (Heavy)"] },
          { label: "Quilts and katha", names: ["Quilt (Normal)", "Quilt (Synthetic)", "Quilt (Special)", "Katha (Medium)", "Katha (Large)"] },
        ],
        note: "Not sure which size or type yours is? Send a photo on WhatsApp, or request a quote.",
        searchHint: "bed",
      },
      { type: "review", title: "Soiled bedding, collected the next morning", review: REVIEW_ANGELA },
      {
        type: "notes",
        title: "Good to know before you send bedding",
        items: [
          {
            title: "Pricing",
            copy: "Blankets, comforters and quilts are priced by item, type and size, not by measurement.",
          },
          {
            title: "Timing",
            // TODO_VERIFY: spec §7 planning range.
            copy: "Plan for roughly 3–4 days. Bedding takes longer to clean and dry than everyday laundry.",
          },
          {
            title: "Covers and sheets",
            copy: "Quilt covers, bed covers and bed sheets are on the price list too, and can go in the same order.",
          },
        ],
      },
      {
        type: "process",
        title: "How a bedding order is handled",
        intro: "Bedding follows the same intake as the rest of your order.",
        image: IMAGES.bedding,
        steps: [
          { title: "Collected", copy: "We collect from your address in Uttara." },
          { title: "Checked in and tagged", copy: "Each item is identified and tagged to your order." },
          { title: "Cleaned", copy: "Each item is cleaned for the booked service and its type." },
          ...RETURN_STEPS,
        ],
      },
    ],
    faq: {
      title: "Bedding questions.",
      items: [
        {
          q: "Do I need a quote for a blanket or comforter?",
          a: [
            "Usually not. Blankets, comforters and quilts have a price per piece, so you can book a pickup directly.",
            "If you're not sure which type or size yours is, or it isn't on the list, request a quote or send a photo.",
          ],
        },
        {
          q: "How long does bedding take?",
          // TODO_VERIFY: spec §7 planning range.
          a: ["Plan for roughly 3–4 days. Bedding takes longer to clean and dry than everyday laundry."],
        },
        "freeDelivery",
        "area",
      ],
    },
    final: {
      title: "Send your bedding.",
      body: "Tell us what you are sending and where to collect from. Not sure of the size or type? Request a quote first.",
    },
    meta: {
      title: "Blanket & Comforter Cleaning in Uttara | Velto",
      description:
        "Blanket, comforter and quilt cleaning with pickup across Uttara. Priced per piece by type and size. See current prices before you book.",
    },
  },
  {
    slug: "express",
    name: "Express",
    whenToChoose: "You need an order back sooner than usual. Ask first, it isn't always possible.",
    overviewFact: "Not guaranteed · confirmed before pickup",
    h1: "Need it back sooner? Ask about Express.",
    h1Highlight: "Ask about Express",
    intro: [
      "Express isn't a separate kind of cleaning. It is a request to have an order back sooner than usual. Whether it's possible depends on the item, the service and how busy Velto is at the time, so we confirm it before pickup.",
    ],
    image: IMAGES.express,
    primary: "book",
    secondary: "whatsapp",
    glance: { pricing: "Extra charge, confirmed with you first", turnaround: "Depends on the item, service and current workload", bestFor: "You need an order back sooner than usual. Ask first, it isn't always possible." },
    blocks: [
      {
        type: "facts",
        title: "What Express means at Velto",
        rows: [
          { label: "Availability", value: "Depends on the item, the service and current workload. It is never guaranteed in advance." },
          { label: "Timing", value: "Velto gives you a ready time when it confirms Express with you." },
          // Every Express order recorded in Velto Ops carries an Express fee; the amount is TODO_VERIFY (spec §36).
          { label: "Charge", value: "Express carries an extra charge. Velto confirms it with you before the order goes ahead." },
          { label: "Household items", value: "Curtains, carpets and bedding take longer than everyday laundry. Ask about these first." },
        ],
        steps: {
          title: "How to ask for Express",
          steps: [
            { title: "Book a pickup", copy: "Your booking is marked as an Express request. Or ask on WhatsApp first." },
            { title: "Velto confirms", copy: "When we call or WhatsApp to confirm the pickup, we tell you whether Express is possible, when it would be ready and the extra charge." },
            { title: "You decide", copy: "Go ahead with Express, or send it at the usual timing." },
          ],
        },
      },
      {
        type: "facts",
        title: "Usual timing, for comparison",
        rows: [
          { label: "General orders", value: "Usually around 48 hours" },
          { label: "Wash & Iron", value: "Usually around 72 hours" },
          { label: "Dry Cleaning", value: "Usually around 72 hours" },
        ],
        footnote: "Special garments, household items and unusual conditions may take longer.",
      },
    ],
    faq: {
      title: "Express questions.",
      items: [
        "express",
        {
          q: "Does Express cost more?",
          a: ["Yes. Express carries an extra charge, and Velto confirms it with you before the order goes ahead."],
        },
        "turnaround",
        "unsure",
      ],
    },
    final: {
      title: "Ask for Express with your pickup.",
      body: "Book as usual and your request is marked as Express. We'll confirm what's possible before we collect.",
    },
    meta: {
      title: "Express Laundry & Dry Cleaning in Uttara | Velto",
      description:
        "Need laundry or dry cleaning back sooner in Uttara? Express depends on the item, service and workload, and carries an extra charge. Velto confirms before pickup.",
    },
  },
];

/** Service pages in a language (content/i18n/services.bn.ts for Bangla, same structure). */
// Data (images, the customer's review, price-list names) and search metadata pass through untouched.
const SERVICE_PAGES_BN_DISPLAY = keepBanglaSuffixes(SERVICE_PAGES_BN, ["meta", "image", "review", "names"]);
export const servicePages = (locale: Locale): ServiceContent[] => (locale === "bn" ? SERVICE_PAGES_BN_DISPLAY : SERVICE_PAGES);

export const getServicePage = (slug: string, locale: Locale = "en") => servicePages(locale).find((s) => s.slug === slug);
