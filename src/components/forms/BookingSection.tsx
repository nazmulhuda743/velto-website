import Link from "@/components/i18n/Link";
import { getAppInstalled, getCustomerSession, getPreferences } from "@/lib/customer/portal";
import { careNote, joinNotes } from "@/lib/customer/extras";
import { parseRoutine } from "@/lib/customer/rhythm";
import { validOrderNumber } from "@/lib/customer/validation";
import { BookingForm } from "@/components/forms/BookingForm";
import { formText } from "@/content/i18n/forms";
import { format } from "@/lib/i18n/config";
import { getLocale, loginRedirectPath } from "@/lib/i18n/server";
import { getPickupChargeMinor } from "@/lib/booking-estimate";
import { getServicePrices } from "@/lib/service-prices";
import { getSiteContent } from "@/lib/site-content";
import { getGoal } from "@/lib/customer/portal";
import { usableCoupon } from "@/lib/customer/goal";
import { keepBanglaSuffixes } from "@/lib/i18n/config";
import { repeatItemsFor } from "@/lib/booking-repeat";
import { firstWebsiteBooking } from "@/lib/first-order-lookup";
import { getItemPairs, getUsualItems } from "@/lib/upsell-data";
import { notifyText } from "@/content/i18n/notify";
import type { AppBase } from "@/lib/app-routes";

/** Quick picks on /book: the everyday items customers send most, exactly as the Ops price list names them. */
const POPULAR_ITEMS = ["Shirt", "Pant", "T-Shirt", "Panjabi", "Kamiz", "Salwar", "Sari (Cotton)", "Jeans", "Blazer", "Bed Sheet (Medium)"];

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/**
 * The booking form with everything it needs (prefill, prices, add-ons, offers, repeat/routine notes),
 * shared by the website's /book and the installed app's /app/book. `base` decides where its links
 * lead; inside the app the customer is signed in and already has the app.
 */
export async function BookingSection({ params, base = "/account" }: { params: Record<string, string | string[] | undefined>; base?: AppBase }) {
  const service = one(params.service);
  // Development-only QA hook: simulate the adapter result without any backend.
  const preview = process.env.NODE_ENV !== "production" ? one(params.preview) : undefined;
  const previewOutcome = preview === "success" || preview === "error" ? preview : undefined;
  const [session, pairs, pickupChargeMinor, { settings }] = await Promise.all([
    getCustomerSession(),
    getItemPairs(),
    getPickupChargeMinor(),
    getSiteContent(),
  ]);
  const account = session.kind === "customer" && session.account.state === "ready" ? session.account : null;
  // Smart add-ons: this customer's regular items and what customers send together, priced from the list.
  const usual = account?.link.status === "linked" ? await getUsualItems() : [];
  const hintNames = [...usual.map((u) => u.item), ...pairs.map((p) => p.alsoItem)].filter((n) => /^[A-Za-z0-9 ().,/&+'-]{1,64}$/.test(n));
  // The price lookup takes at most 40 names (more would fail the whole lookup).
  const popular = await getServicePrices([...new Set([...POPULAR_ITEMS, ...hintNames])].slice(0, 40));
  // A monthly-goal reward the customer holds today: shown in the summary, applied by Velto at confirmation.
  const goal = account && settings ? await (async () => {
    const { loyalty } = await getSiteContent();
    return loyalty.goal.enabled ? getGoal(loyalty.goal.doubleFirst) : null;
  })() : null;
  const coupon = goal ? usableCoupon(goal.coupons, goal.today) : null;
  // 10% off a number's first website order (lib/first-order-offer.ts): guests are asked to sign in
  // first; a signed-in customer sees it only while their number has no website booking yet. Staff,
  // unfinished profiles and unavailable accounts see neither line. Ops gets the note either way.
  const guest = session.kind === "anonymous";
  const firstOrder = account
    ? account.phone && (await firstWebsiteBooking(account.phone)) === "first" ? ("yours" as const) : undefined
    : guest ? ("guest" as const) : undefined;
  const returnTo = `${base === "/app" ? "/app/book" : "/book"}${service ? `?service=${encodeURIComponent(service)}` : ""}`;
  const signInHref = guest ? await loginRedirectPath(returnTo) : undefined;
  const locale = await getLocale();
  const f = formText(locale);
  const t = f.bookPage;
  // The top bar's offer, repeated in the order summary (Promo & popup in the admin).
  const bar = settings.announcement;
  const offer = bar.enabled ? (locale === "bn" && bar.bookingNoteBn.trim() ? keepBanglaSuffixes(bar.bookingNoteBn) : bar.bookingNote.trim()) : "";
  // "Book the same again" from the account: only a well-formed order number, only for a signed-in
  // customer, and only as a note the customer can edit (Ops staff see which order it repeats).
  let repeat: string | null = null;
  try {
    repeat = account ? validOrderNumber(one(params.repeat) ?? "") : null;
  } catch {
    // A malformed escape in the query: ignore it, it's only a note.
  }
  // One tap to repeat: the earlier order's items are filled in (the customer still reviews them).
  const repeatItems = repeat ? await repeatItemsFor(repeat) : [];
  // "Make it a routine" from the account: a request note Ops confirms by phone, never a contract.
  const routine = parseRoutine(one(params.routine), one(params.day));
  // Signed-in customers' saved care and addresses (Profile): a note line and one-tap addresses.
  const prefs = account ? await getPreferences() : null;
  const routineNote = routine
    ? format(t.routineNote, { every: t.routineEvery[routine.every], day: t.routineDays[routine.day] })
    : null;

  return (
    <BookingForm
      notify={notifyText(locale)}
      appInstalled={base === "/app" ? true : account ? await getAppInstalled() : false}
    base={base}
      t={f.booking}
      common={f.common}
      intro={
        <>
          {t.intro}
          {routine ? (
            <span className="mt-3 block t-small font-semibold text-navy" data-routine>
              {t.routineIntro}
            </span>
          ) : repeat ? (
            <span className="mt-3 block t-small font-semibold text-navy" data-repeat>
              {format(repeatItems.length ? t.repeatIntro : t.repeatIntroNote, { n: repeat })}
            </span>
          ) : account ? (
            <span className="mt-3 block t-small text-secondary" data-prefilled>
              {format(t.signedIn, { name: account.fullName })}
            </span>
          ) : session.kind === "anonymous" ? (
            <span className="mt-3 block t-small text-secondary">
              {t.haveAccount}
              <Link href={`/login?next=${encodeURIComponent(returnTo)}`} className="font-semibold text-navy underline decoration-blue/50 underline-offset-4">
                {t.signInLink}
              </Link>
              {t.signInAfter}
            </span>
          ) : null}
        </>
      }
      initialService={service}
      popularItems={popular.state === "live" ? popular.items : []}
      upsellHints={{ usual, pairs }}
      repeatItems={repeatItems}
      pickupChargeMinor={pickupChargeMinor}
      offer={offer || undefined}
      coupon={coupon ? { code: coupon.code, kind: coupon.kind, amount: coupon.amount } : undefined}
      firstOrder={firstOrder}
      signInHref={signInHref}
      presetNote={joinNotes(routineNote ?? (repeat ? format(t.repeatNote, { n: repeat }) : t.presetNotes[service ?? ""]), prefs ? careNote(prefs.care, t.care) : "")}
      savedAddresses={prefs?.addresses ?? []}
      previewOutcome={previewOutcome}
      initialContact={
        account
          ? { name: account.fullName, phone: account.phone, address: account.address ?? "", sector: account.area ?? "" }
          : undefined
      }
    />
  );
}
