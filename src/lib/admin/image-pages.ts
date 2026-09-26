/**
 * Which photo appears on which page of the website, so the Images page can be browsed page by
 * page and every slot says where else it shows. Pure data (no imports), unit-tested against
 * the real slot list so a new slot can't silently go missing from the admin.
 *
 * A photo is one slot: replacing it changes it everywhere it appears (listed under "Also on").
 */

const STAGES = ["Collected", "Checked in", "Tagged", "Checked before cleaning", "Cleaned & finished", "Checked before packing", "Packed", "Returned"];

const NAMES: Record<string, string> = {
  hero: "Main hero photo",
  dryCleaning: "Dry Cleaning",
  washAndIron: "Wash & Iron",
  ironing: "Ironing",
  household: "Curtain Cleaning",
  carpet: "Carpet Cleaning",
  blankets: "Blankets & Comforters",
  bedding: "Bedding (blanket page section)",
  express: "Express",
  delicate: "Delicate garments",
  householdSection: "Household items section",
  regular: "Regular laundry",
  final: "Closing booking section",
  about: "About Velto",
  curtainsMeasured: "Curtains being measured",
  carpetMeasured: "Carpet being measured",
  "locations.sector-11": "Sector 11 outlet",
  "locations.sector-18": "Sector 18 outlet",
};

export const slotName = (id: string) =>
  NAMES[id] ?? (id.startsWith("process.") ? `Process step ${Number(id.split(".")[1]) + 1}: ${STAGES[Number(id.split(".")[1])] ?? ""}`.trim() : id);

const process = (...steps: number[]) => steps.map((n) => `process.${n}`);

export type SitePage = { key: string; title: string; path: string; slots: string[] };

/** In site-menu order. A slot may appear on several pages. */
export const SITE_PAGES: SitePage[] = [
  {
    key: "home",
    title: "Homepage",
    path: "/",
    slots: ["hero", "dryCleaning", "washAndIron", "ironing", "household", "carpet", "blankets", ...process(0, 1, 2, 3, 4, 5, 6, 7), "delicate", "householdSection", "regular", "final"],
  },
  { key: "services", title: "All services", path: "/services", slots: ["dryCleaning", "washAndIron", "ironing", "household", "carpet", "blankets", "express", "final"] },
  { key: "dry-cleaning", title: "Dry Cleaning", path: "/services/dry-cleaning", slots: ["dryCleaning", ...process(3)] },
  { key: "wash-and-iron", title: "Wash & Iron", path: "/services/wash-and-iron", slots: ["washAndIron", ...process(6)] },
  { key: "ironing", title: "Ironing", path: "/services/ironing", slots: ["ironing", ...process(4)] },
  { key: "curtain-cleaning", title: "Curtain Cleaning", path: "/services/curtain-cleaning", slots: ["household"] },
  { key: "carpet-cleaning", title: "Carpet Cleaning", path: "/services/carpet-cleaning", slots: ["carpet"] },
  { key: "blankets", title: "Blankets & Comforters", path: "/services/blanket-comforter-cleaning", slots: ["blankets", "bedding"] },
  { key: "express", title: "Express", path: "/services/express", slots: ["express"] },
  { key: "regular-laundry", title: "Regular Laundry", path: "/regular-laundry", slots: ["regular"] },
  { key: "how-it-works", title: "How It Works", path: "/how-it-works", slots: ["hero", ...process(2, 3, 4, 6)] },
  { key: "about", title: "About", path: "/about", slots: ["about"] },
  { key: "locations", title: "Locations", path: "/locations", slots: [...process(0)] },
  { key: "sector-11", title: "Sector 11 outlet", path: "/locations/sector-11", slots: ["locations.sector-11"] },
  { key: "sector-18", title: "Sector 18 outlet", path: "/locations/sector-18", slots: ["locations.sector-18"] },
];

/** Slots ready for photos but not on any page yet. */
export const UNUSED_SLOTS = ["curtainsMeasured", "carpetMeasured"];

export const pagesForSlot = (id: string) => SITE_PAGES.filter((p) => p.slots.includes(id));
