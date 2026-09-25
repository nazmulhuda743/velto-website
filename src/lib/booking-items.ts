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

/** Items sentence first, then the customer's own note: a single line, as the Ops intake expects. */
export function composeBookingNotes(items: BookingItem[], note?: string): string | undefined {
  const parts = [items.length ? `Items: ${bookingItemsText(items)}.` : "", note?.trim() ? `Note: ${note.trim()}` : ""];
  if (!items.length) return note?.trim() || undefined;
  return parts.filter(Boolean).join(" ");
}
