/**
 * Service page content (internal pages, phase 4).
 *
 * Facts are limited to docs/PROJECT-BUILD-SPEC.md §4 (turnaround, express,
 * delivery rule), §5 (verified workflows) and §7 (household quote logic).
 * Anything that still needs live verification is marked TODO_VERIFY.
 */
import { IMAGES, type ImageSlot } from "./mock";
import type { FAQ_KEYS } from "@/components/home/FAQ";
import type { Step } from "@/components/pages/ProcessSteps";

export type ServiceSlug =
  | "dry-cleaning"
  | "wash-and-iron"
  | "ironing"
  | "curtain-cleaning"
  | "carpet-cleaning"
  | "blanket-comforter-cleaning";

export type ServiceContent = {
  slug: ServiceSlug;
  kind: "garment" | "household";
  name: string;
  /** Short line used on the services overview. */
  summary: string;
  h1: string;
  intro: string[];
  image: ImageSlot;
  processImage: ImageSlot;
  primary: "book" | "quote";
  /** Overview label for how the job is priced/timed. */
  turnaround: string;
  handles: { title: string; items: string[] };
  goodToKnow: { title: string; copy: string }[];
  process: { title: string; intro: string; steps: Step[] };
  /** Household only: what to share for an accurate quote. */
  quoteDetails?: string[];
  faq: (keyof typeof FAQ_KEYS)[];
  final: { title: string; body: string };
  metaDescription: string;
};

const GARMENT_RETURN: Step[] = [
  { title: "Checked before packing", copy: "Finished items are checked again before they are packed." },
  { title: "Packed and returned", copy: "Your order is packed and delivered back to your address." },
];

export const SERVICE_PAGES: ServiceContent[] = [
  {
    slug: "dry-cleaning",
    kind: "garment",
    name: "Dry Cleaning",
    summary: "Suits, blazers, sarees, sherwanis and garments that need a closer look.",
    h1: "Dry cleaning for garments that need a closer look.",
    intro: [
      "Suits, blazers, sarees and sherwanis are checked in, tagged and looked over before any cleaning starts. We collect from your door in Uttara and bring them back finished and packed.",
    ],
    image: IMAGES.dryCleaning,
    processImage: IMAGES.process[3],
    primary: "book",
    turnaround: "Usually around 72 hours",
    handles: {
      title: "What people send for dry cleaning",
      items: ["Suits and blazers", "Sarees", "Sherwanis", "Other garments that need closer attention"],
    },
    goodToKnow: [
      {
        title: "Stains are checked first",
        copy: "We look at visible stains before cleaning and treat them for the garment and service. Some stains cannot be fully removed. If something needs extra attention, we'll explain the options first.",
      },
      {
        title: "Timing",
        copy: "Dry cleaning is usually around 72 hours. Special garments and unusual conditions may take longer.",
      },
      {
        title: "Need it sooner?",
        copy: "Express may be available depending on the item and current workload. Confirm with Velto before booking.",
      },
    ],
    process: {
      title: "How a dry cleaning order is handled",
      intro: "Each garment is assessed and routed to the right treatment, rather than handled as anonymous laundry.",
      steps: [
        { title: "Collected", copy: "We collect the order from your address in Uttara." },
        { title: "Checked in and tagged", copy: "Each item is identified and tagged so it stays connected to your order." },
        { title: "Garment and stain assessment", copy: "We look over the fabric, condition and visible stains before choosing the treatment." },
        { title: "Dry cleaned", copy: "The garment goes to the treatment it was assessed for." },
        { title: "Finished and pressed", copy: "After cleaning, it is pressed and finished." },
        ...GARMENT_RETURN,
      ],
    },
    faq: ["turnaround", "stains", "express", "unsure"],
    final: {
      title: "Send your dry cleaning.",
      body: "Tell us where to collect from and what you are sending. If a garment needs a closer look, mention it in the notes.",
    },
    metaDescription:
      "Dry cleaning in Uttara for suits, blazers, sarees and sherwanis. Garments are checked and tagged before cleaning, with pickup from your door.",
  },
  {
    slug: "wash-and-iron",
    kind: "garment",
    name: "Wash & Iron",
    summary: "Everyday clothes washed, ironed and returned ready to wear.",
    h1: "Wash & Iron, collected from your door.",
    intro: [
      "Everyday clothes are counted and tagged to your order, then washed, dried, ironed and packed. You get them back ready to wear.",
    ],
    image: IMAGES.washAndIron,
    processImage: IMAGES.process[6],
    primary: "book",
    turnaround: "Usually around 72 hours",
    handles: {
      title: "Good for",
      items: ["Shirts and office wear", "Everyday clothes", "A week's household laundry"],
    },
    goodToKnow: [
      {
        title: "Timing",
        copy: "Wash & Iron is usually around 72 hours. Larger or unusual orders may take longer.",
      },
      {
        title: "Free pickup and delivery",
        copy: "Orders of ৳499+ qualify for free pickup and delivery. For smaller orders, the applicable charge is shown before booking.",
      },
      {
        title: "Every week?",
        copy: "If the laundry comes back every week, a regular pickup saves booking from scratch each time.",
      },
    ],
    process: {
      title: "How a Wash & Iron order is handled",
      intro: "Items are counted and tagged before washing, so everything that goes out comes back to the right order.",
      steps: [
        { title: "Collected", copy: "We collect the order from your address in Uttara." },
        { title: "Counted and identified", copy: "Items are counted and connected to your order." },
        { title: "Tagged", copy: "Each item is tagged so it stays with the right order." },
        { title: "Washed and dried", copy: "Items are routed to the right wash, then dried." },
        { title: "Ironed and finished", copy: "Everything is ironed and finished ready to wear." },
        ...GARMENT_RETURN,
      ],
    },
    faq: ["turnaround", "freeDelivery", "area", "unsure"],
    final: {
      title: "Send this week's laundry.",
      body: "Tell us where to collect from and when suits you. Orders of ৳499+ qualify for free pickup and delivery.",
    },
    metaDescription:
      "Wash & Iron in Uttara with pickup from your door. Clothes are counted, tagged, washed, ironed and returned ready to wear.",
  },
  {
    slug: "ironing",
    kind: "garment",
    name: "Ironing",
    summary: "Already washed? Ironing and finishing only.",
    h1: "Ironing for clothes that are already washed.",
    intro: [
      "Send clean clothes and we'll iron and finish them, then pack them and bring them back to your door.",
    ],
    image: IMAGES.ironing,
    processImage: IMAGES.process[4],
    primary: "book",
    turnaround: "General orders usually around 48 hours",
    handles: {
      title: "Good for",
      items: ["Shirts and trousers", "Office wear", "Clothes washed at home"],
    },
    goodToKnow: [
      {
        title: "Timing",
        copy: "General orders are usually around 48 hours. Special garments may take longer.",
      },
      {
        title: "Needs washing too?",
        copy: "If the clothes still need washing, book Wash & Iron instead and we'll do both.",
      },
    ],
    process: {
      title: "How an ironing order is handled",
      intro: "Even an ironing-only order is counted and tagged, so it comes back complete.",
      steps: [
        { title: "Collected", copy: "We collect the order from your address in Uttara." },
        { title: "Counted and tagged", copy: "Items are counted and tagged to your order." },
        { title: "Ironed and finished", copy: "Each item is ironed and finished." },
        ...GARMENT_RETURN,
      ],
    },
    faq: ["turnaround", "freeDelivery", "unsure"],
    final: {
      title: "Send your ironing.",
      body: "Tell us where to collect from and roughly how much there is. That's enough to get started.",
    },
    metaDescription: "Ironing service in Uttara for clothes that are already washed, with pickup and delivery.",
  },
  {
    slug: "curtain-cleaning",
    kind: "household",
    name: "Curtain Cleaning",
    summary: "Priced from the number of curtains and their size.",
    h1: "Curtain cleaning, starting with a few details.",
    intro: [
      "Curtain pricing depends on how many you have and their size. Tell us roughly what you have, add a photo if it helps, and we'll help you work out the price before pickup.",
    ],
    image: IMAGES.household,
    processImage: IMAGES.curtainsMeasured,
    primary: "quote",
    turnaround: "Quantity and size decide the price",
    handles: {
      title: "What we need to know",
      items: [],
    },
    quoteDetails: [
      "How many curtains or panels you have",
      "Their approximate length and width",
      "The fabric, if you know it",
      "A photo, optional",
    ],
    goodToKnow: [
      {
        title: "Final price",
        copy: "We confirm the final amount when measurement or condition needs to be checked.",
      },
      {
        title: "Timing",
        // TODO_VERIFY: current curtain turnaround range (spec §36).
        copy: "Household items can take longer than everyday laundry. We'll confirm timing with your quote.",
      },
    ],
    process: {
      title: "How a curtain quote works",
      intro: "A few details up front means fewer surprises later.",
      steps: [
        { title: "Tell us what you have", copy: "Share the approximate quantity and size, and a photo if it helps." },
        { title: "Price guidance", copy: "We guide you on the price from Velto's current pricing." },
        { title: "Confirmation", copy: "We confirm the final amount when measurement or condition needs checking." },
        { title: "Pickup", copy: "We collect the curtains from your address in Uttara." },
      ],
    },
    faq: ["household", "area", "freeDelivery"],
    final: {
      title: "Start a curtain quote.",
      body: "Send the quantity and approximate size. A photo helps but is optional.",
    },
    metaDescription:
      "Curtain cleaning in Uttara. Share the quantity and approximate size for price guidance, then book a pickup.",
  },
  {
    slug: "carpet-cleaning",
    kind: "household",
    name: "Carpet Cleaning",
    summary: "Priced by size. Material and condition can change the price.",
    h1: "Carpet cleaning, priced from the size.",
    intro: [
      "Share the approximate length and width of your carpet. The material and condition can change the final price, so a photo helps us guide you before pickup.",
    ],
    image: IMAGES.householdSection,
    processImage: IMAGES.carpetMeasured,
    primary: "quote",
    turnaround: "Size, material and condition decide the price",
    handles: { title: "What we need to know", items: [] },
    quoteDetails: [
      "Approximate length and width",
      "The material, if you know it",
      "Anything about its condition, such as stains or wear",
      "A photo, optional",
    ],
    goodToKnow: [
      {
        title: "No guessing",
        copy: "When the size is uncertain or the material and condition change the work, we won't promise an exact price until it is confirmed.",
      },
      {
        title: "Timing",
        // TODO_VERIFY: current carpet turnaround range (spec §36).
        copy: "Carpets can take longer than everyday laundry. We'll confirm timing with your quote.",
      },
    ],
    process: {
      title: "How a carpet quote works",
      intro: "Dimensions first, then confirmation, then pickup.",
      steps: [
        { title: "Send the dimensions", copy: "Tell us the approximate length and width." },
        { title: "Price guidance or quote", copy: "We guide you on the price, or prepare a quote." },
        { title: "Add a photo", copy: "Optional, but it helps when material or condition matters." },
        { title: "Confirmation", copy: "Velto confirms the final amount." },
        { title: "Pickup", copy: "We collect the carpet from your address in Uttara." },
      ],
    },
    faq: ["household", "area", "freeDelivery"],
    final: {
      title: "Start a carpet quote.",
      body: "Send the approximate length and width. Add a photo if the material or condition matters.",
    },
    metaDescription:
      "Carpet cleaning in Uttara. Share approximate dimensions and a photo for price guidance, then book a pickup.",
  },
  {
    slug: "blanket-comforter-cleaning",
    kind: "household",
    name: "Blankets & Comforters",
    summary: "Priced by item, type and size.",
    h1: "Blanket and comforter cleaning.",
    intro: [
      "Blankets, heavy blankets, comforters and quilts are priced mainly by the item, type and size. These jobs take longer than everyday laundry.",
    ],
    image: IMAGES.blankets,
    processImage: IMAGES.blankets,
    primary: "book",
    // TODO_VERIFY: planning range from spec §7, confirm against current operations.
    turnaround: "Roughly 3–4 days",
    handles: {
      title: "What we clean",
      items: ["Blankets", "Heavy blankets", "Comforters", "Quilts and similar bedding"],
    },
    goodToKnow: [
      {
        title: "Pricing",
        copy: "Pricing depends mainly on the item, type and size, not on measurements.",
      },
      {
        title: "Timing",
        // TODO_VERIFY: spec §7 planning range.
        copy: "Plan for roughly 3–4 days. Bedding takes longer to clean and dry than everyday laundry.",
      },
    ],
    process: {
      title: "How a bedding order is handled",
      intro: "Bedding follows the same intake as the rest of your order.",
      steps: [
        { title: "Collected", copy: "We collect from your address in Uttara." },
        { title: "Checked in and tagged", copy: "Each item is identified and tagged to your order." },
        { title: "Cleaned", copy: "Each item is cleaned for its type and size." },
        ...GARMENT_RETURN,
      ],
    },
    faq: ["household", "turnaround", "freeDelivery"],
    final: {
      title: "Send your bedding.",
      body: "Tell us what you are sending and where to collect from. Not sure of the price? Request a quote first.",
    },
    metaDescription:
      "Blanket, comforter and quilt cleaning in Uttara, priced by item, type and size, with pickup from your door.",
  },
];

export const getServicePage = (slug: string) => SERVICE_PAGES.find((s) => s.slug === slug);
