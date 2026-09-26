/**
 * Itemised booking lines ("10 × Pant, Dry Cleaning"). Runtime-neutral so the
 * booking form, /api/bookings validation and the tests share one definition.
 *
 * The Ops intake (website_create_request) has no items column, so validated
 * lines travel as one plain-text "Items: …" sentence at the start of the
 * booking notes. Ops stays the source of truth for prices and final counts.
 */

/** Services a single line can ask for (the per-garment and household services). */
export const ITEM_SERVICES = {
  "dry-cleaning": "Dry Cleaning",
  "wash-and-iron": "Wash & Iron",
  ironing: "Ironing",
  "curtain-cleaning": "Curtains",
  "carpet-cleaning": "Carpets",
  "blanket-comforter-cleaning": "Blankets & Comforters",
} as const;

export type ItemService = keyof typeof ITEM_SERVICES;

/** The per-garment services a customer chooses first on /book (one or more). */
export const GARMENT_SERVICES = ["dry-cleaning", "wash-and-iron", "ironing"] as const satisfies readonly ItemService[];
export type GarmentService = (typeof GARMENT_SERVICES)[number];
export const isGarmentService = (value: unknown): value is GarmentService =>
  typeof value === "string" && (GARMENT_SERVICES as readonly string[]).includes(value);

/** Orders of ৳499+ get free pickup & delivery (spec §4), in minor units (paisa). */
export const FREE_DELIVERY_MIN_MINOR = 49_900;

/** A booking line for the estimate: its unit price from the Ops price list, or null when priced at pickup. */
export type EstimateLine = { quantity: number; unitMinor: number | null };

export type BookingEstimate = {
  /** Sum of the lines with a price. */
  subtotalMinor: number;
  /** Lines without a price (not on the list, per sq ft, or needing a check): Velto prices them at pickup. */
  unpricedLines: number;
  /** ৳499+ (on the priced lines): free pickup & delivery. */
  free: boolean;
  /** Below ৳499: the charge from the admin setting, or null when it isn't set (Velto confirms it). */
  chargeMinor: number | null;
  /** Subtotal plus the charge when it is known. */
  totalMinor: number;
};

/**
 * The website's estimate: prices from Velto Ops times quantities, plus the pickup & delivery
 * charge below ৳499. Shared by the booking form and /api/bookings. Velto confirms the final
 * amount after counting the items at pickup.
 */
export function estimateBooking(lines: EstimateLine[], chargeMinor: number | null): BookingEstimate {
  let subtotalMinor = 0;
  let unpricedLines = 0;
  for (const l of lines) {
    if (l.unitMinor === null) unpricedLines += 1;
    else subtotalMinor += l.unitMinor * l.quantity;
  }
  const free = subtotalMinor >= FREE_DELIVERY_MIN_MINOR;
  const charge = free ? 0 : chargeMinor;
  return { subtotalMinor, unpricedLines, free, chargeMinor: charge, totalMinor: subtotalMinor + (charge ?? 0) };
}

export type BookingItem = {
  item: string;
  /** Omitted when the customer isn't sure which service it needs. */
  service?: ItemService;
  quantity: number;
};

export const MAX_BOOKING_ITEMS = 10;
export const MAX_ITEM_NAME = 40;
export const MAX_ITEM_QUANTITY = 99;
/** The line added by "A mix, or not sure". */
export const MIXED_ITEM = "Mixed items";
/** The Ops notes field holds 1,000 characters; items and the customer's note share it. */
export const MAX_BOOKING_NOTES = 1_000;

export const isItemService = (value: unknown): value is ItemService =>
  typeof value === "string" && Object.prototype.hasOwnProperty.call(ITEM_SERVICES, value);

/** Item names are shown to staff as plain text: one line, no control or markup characters. */
export function cleanItemName(value: unknown): string | null {
  if (typeof value !== "string" || /[\u0000-\u001f\u007f<>{}[\]|;\\]/.test(value)) return null;
  const name = value.replace(/ +/g, " ").trim();
  if (!name || name.length > MAX_ITEM_NAME) return null;
  return name;
}

/** Validate a submitted items array. `null` means the whole value is unusable. */
export function cleanBookingItems(value: unknown): BookingItem[] | null {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > MAX_BOOKING_ITEMS) return null;
  const items: BookingItem[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
    const line = raw as Record<string, unknown>;
    const item = cleanItemName(line.item);
    const quantity = line.quantity;
    if (!item || typeof quantity !== "number" || !Number.isInteger(quantity) || quantity < 1 || quantity > MAX_ITEM_QUANTITY) {
      return null;
    }
    if (line.service !== undefined && !isItemService(line.service)) return null;
    items.push({ item, quantity, ...(line.service ? { service: line.service as ItemService } : {}) });
  }
  return items;
}

/**
 * "10 × Pant – Dry Cleaning; 5 × Sari (Cotton) – Ironing; 1 × Mixed items – service not sure".
 * A dash, not brackets, because many price-list names already end in brackets.
 */
export function bookingItemsText(items: BookingItem[]): string {
  return items
    .map((i) => `${i.quantity} × ${i.item} – ${i.service ? ITEM_SERVICES[i.service] : "service not sure"}`)
    .join("; ");
}

/** The one service every line shares, if there is exactly one; used for the Ops "Service" field. */
export function sharedItemService(items: BookingItem[]): ItemService | undefined {
  const services = new Set(items.map((i) => i.service));
  const [only] = services;
  return services.size === 1 && only ? only : undefined;
}

/** Booking facts that ride in the notes next to the items (the Ops intake has no columns for them). */
export type BookingNoteExtras = {
  /** Services chosen without item lines, when there is more than one (one goes in the Service field). */
  services?: ItemService[];
  /** The website estimate, already worded ("৳610 for 7 items; pickup & delivery free"). */
  estimate?: string;
  /** When the customer wants the order back ("Fri 3 Oct"). */
  backBy?: string;
};

/**
 * Items (or chosen services) first, then the website estimate and the wanted-back date, then the
 * customer's own note: a single line, as the Ops intake expects.
 */
export function composeBookingNotes(items: BookingItem[], note?: string, extras: BookingNoteExtras = {}): string | undefined {
  const parts = [
    items.length
      ? `Items: ${bookingItemsText(items)}.`
      : extras.services?.length
        ? `Services: ${extras.services.map((s) => ITEM_SERVICES[s]).join(", ")}.`
        : "",
    extras.estimate ? `Website estimate: ${extras.estimate}.` : "",
    extras.backBy ? `Wanted back by: ${extras.backBy}.` : "",
  ].filter(Boolean);
  const text = note?.trim();
  if (!parts.length) return text || undefined;
  return [...parts, text ? `Note: ${text}` : ""].filter(Boolean).join(" ");
}

/** The longest estimate and wanted-back wording the notes need room for. */
export const NOTE_EXTRAS_RESERVE = 160;
