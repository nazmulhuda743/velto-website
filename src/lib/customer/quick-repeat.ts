import "server-only";

import type { BookingFormData } from "@/components/forms/submit";
import { formText } from "@/content/i18n/forms";
import { repeatItemsFor } from "../booking-repeat";
import { format, type Locale } from "../i18n/config";
import type { DateWords, SlotId } from "../pickup-when";
import { careNote, joinNotes } from "./extras";
import { getPreferences, type PortalAccount } from "./portal";
import { areaLabel } from "./validation";

type Ready = Extract<PortalAccount, { state: "ready" }>;

export type QuickRepeatProps = {
  orderNumber: string;
  lines: string[];
  data: Omit<BookingFormData, "preferredPickup">;
  words: DateWords;
  slotLabels: Record<SlotId, string>;
};

/**
 * Everything one-tap repeat sends, from the customer's own account and their own order: the saved
 * name, phone and address, that order's lines, and the same Ops note as "Book the same again" on
 * /book (in English, like everything Velto Ops receives). Null when the address isn't saved yet:
 * the card then links to the prefilled booking form instead.
 */
export async function quickRepeatFor(account: Ready, orderNumber: string, repeatService: string | null, locale: Locale): Promise<QuickRepeatProps | null> {
  const area = areaLabel(account.area);
  const address = account.address?.trim();
  if (!area || !address || address.length < 5) return null;
  const [items, prefs] = await Promise.all([repeatItemsFor(orderNumber), getPreferences()]);
  const ops = formText("en").bookPage;
  const f = formText(locale);
  return {
    orderNumber,
    lines: items.map((l) => `${l.quantity} × ${l.item}`),
    data: {
      name: account.fullName,
      phone: account.link.verifiedPhone ?? account.phone,
      area,
      address,
      ...(items.length
        ? { items: items.map((l) => ({ item: l.item, ...(l.service ? { service: l.service } : {}), quantity: l.quantity })) }
        : repeatService
          ? { service: repeatService }
          : {}),
      notes: joinNotes(format(ops.repeatNote, { n: orderNumber }), careNote(prefs.care, ops.care)) || undefined,
    },
    words: {
      today: f.booking.today,
      tomorrow: f.booking.tomorrow,
      weekdays: f.common.weekdays,
      months: f.common.months,
      dayMonth: f.common.dayMonth,
      locale,
    },
    slotLabels: f.booking.slots as Record<SlotId, string>,
  };
}
