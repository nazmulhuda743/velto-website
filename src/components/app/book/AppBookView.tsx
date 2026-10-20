import { redirect } from "next/navigation";
import { formText } from "@/content/i18n/forms";
import { accountText } from "@/content/i18n/account";
import { customerRoutes } from "@/lib/app-routes";
import { signInFor } from "@/lib/app-routes-server";
import { repeatItemsFor } from "@/lib/booking-repeat";
import { GARMENT_SERVICES, isGarmentService, type GarmentService } from "@/lib/booking-items";
import { lastOrder, showFirstOrderLine } from "@/lib/customer/app-logic";
import { careNote, joinNotes } from "@/lib/customer/extras";
import { getCustomerSession, getPickups, getPortalOrders, getPreferences } from "@/lib/customer/portal";
import { appBookSource } from "@/lib/customer/app-sources";
import { bookingServicesFor } from "@/lib/customer/rhythm";
import { displayBdPhone, validOrderNumber } from "@/lib/customer/validation";
import { FIRST_ORDER_OFFER } from "@/lib/first-order-offer";
import { firstWebsiteBooking } from "@/lib/first-order-lookup";
import { fill, format } from "@/lib/i18n/config";
import { getLocale } from "@/lib/i18n/server";
import { getServicePrices } from "@/lib/service-prices";
import { AppBookingFlow, type BookAddress, type BookItem, type PriceRow } from "./AppBookingFlow";

const routes = customerRoutes("/app");

/** The everyday items in the picker's "Popular" list, exactly as the Ops price list names them. */
const POPULAR = ["Shirt", "Pant", "T-Shirt", "Panjabi", "Kamiz", "Salwar", "Sari (Cotton)", "Jeans", "Blazer", "Bed Sheet (Medium)"];

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/**
 * Book in the app (design "Book"): not a form but a summary of the last order, each row opening a
 * sheet. Everything Ops needs is filled in from the account (name, verified number, address),
 * the order being repeated and the saved care preferences; the customer only changes what differs.
 */
export async function AppBookView({ params }: { params: Record<string, string | string[] | undefined> }) {
  const session = await getCustomerSession();
  if (session.kind !== "customer" || session.account.state !== "ready") redirect(await signInFor("/app", routes.book()));
  const account = session.account;
  const locale = await getLocale();
  const fm = formText(locale);
  const t = fm.common.app;
  const linked = account.link.status === "linked";
  const [orders, prefs, pickups] = await Promise.all([linked ? getPortalOrders() : Promise.resolve([]), getPreferences(), getPickups()]);
  const list = orders ?? [];
  const last = lastOrder(list);

  // The order to repeat: ?repeat=VEL-… (Book this again, Change on Home), else the last one.
  let asked: string | null = null;
  try {
    asked = validOrderNumber(one(params.repeat) ?? "");
  } catch {}
  const repeat = asked ?? last?.orderNumber ?? null;
  const repeated = repeat ? await repeatItemsFor(repeat) : [];
  const items: BookItem[] = repeated
    .filter((l) => isGarmentService(l.service))
    .map((l) => ({ item: l.item, service: l.service as GarmentService, quantity: l.quantity }));
  // Rebook repeats the whole set: the repeated order's services win; ?service= only fills in when
  // there is no order to repeat (design: "rebook repeats the whole set").
  const asService = one(params.service);
  const repeatedOrder = repeat ? (list.find((o) => o.orderNumber === repeat) ?? null) : null;
  const base = repeatedOrder ?? last;
  const orderServices = base ? bookingServicesFor(base.services).filter(isGarmentService) : [];
  const services: GarmentService[] = items.length
    ? [...new Set(items.map((i) => i.service))]
    : repeat && orderServices.length
      ? orderServices
      : isGarmentService(asService)
        ? [asService]
        : orderServices;

  // Prices for the picker and the estimate: the popular items and anything being repeated.
  const priced = await getServicePrices([...new Set([...POPULAR, ...items.map((i) => i.item)])].slice(0, 40));
  const prices: PriceRow[] =
    priced.state === "live"
      ? priced.items.map((p) => ({
          name: p.name,
          prices: Object.fromEntries(p.services.filter((s) => isGarmentService(s.slug) && s.amountMinor !== null).map((s) => [s.slug, s.amountMinor as number])),
        }))
      : [];

  // Pickup addresses: the account's own first, then the saved ones (Profile).
  const addresses: BookAddress[] = [
    ...(account.address && account.area ? [{ label: null, address: account.address, area: account.area }] : []),
    ...prefs.addresses.filter((x) => x.address && x.area && !(x.address === account.address && x.area === account.area)).map((x) => ({ label: x.label || null, address: x.address, area: x.area })),
  ];

  // The same Ops note as "Book the same again" on /book, in English like everything Ops receives.
  const ops = formText("en").bookPage;
  const baseNote = joinNotes(repeat ? format(ops.repeatNote, { n: repeat }) : null, careNote(prefs.care, ops.care)) || "";

  const first = showFirstOrderLine(list.length) && account.phone ? (await firstWebsiteBooking(account.phone)) === "first" : false;
  const hasPending = Boolean(pickups?.verified && pickups.pickups.length);

  return (
    <AppBookingFlow
      locale={locale}
      name={account.fullName}
      phone={account.link.verifiedPhone ?? account.phone}
      phoneText={displayBdPhone(account.phone) ?? account.phone}
      services={services}
      items={items}
      sameAsLast={Boolean(repeat && (items.length || services.length))}
      addresses={addresses}
      prices={prices}
      popular={POPULAR}
      baseNote={baseNote}
      offer={first ? fill(accountText(locale).home.offerTitle, { percent: FIRST_ORDER_OFFER.percent }, locale) : null}
      // The notifications prompt follows only the first booking.
      notifyAfter={list.length === 0 && !hasPending}
      homeHref={routes.home}
      source={appBookSource(one(params.source))}
      t={{
        ...t,
        serviceNames: Object.fromEntries(GARMENT_SERVICES.map((s) => [s, fm.booking.services[s]])) as Record<GarmentService, string>,
        slotNames: fm.booking.slots,
        sectorLabel: fm.booking.sectorLabel,
        sectorPlaceholder: fm.booking.sectorPlaceholder,
        sectorOption: fm.booking.sectorOption,
        outsideOption: fm.booking.outsideOption,
        addressLabel: fm.booking.addressLabel,
        addressPlaceholder: fm.booking.addressPlaceholder,
        errService: fm.booking.errors.what,
        errSector: fm.booking.errors.sector,
        errAddress: fm.booking.errors.address,
        errSlot: fm.booking.errors.slot,
        slotTaken: fm.booking.slotTaken,
        duplicate: accountText(locale).quick.duplicate,
        sending: accountText(locale).quick.sending,
        whatsapp: fm.booking.whatsapp,
        weekdays: fm.common.weekdays,
        months: fm.common.months,
        dayMonth: fm.common.dayMonth,
      }}
    />
  );
}
