import Link from "@/components/i18n/Link";
import { pageMetadata } from "@/lib/seo/page-metadata";
import { getCustomerSession, getPreferences } from "@/lib/customer/portal";
import { careNote, joinNotes } from "@/lib/customer/extras";
import { parseRoutine } from "@/lib/customer/rhythm";
import { validOrderNumber } from "@/lib/customer/validation";
import { BookingForm } from "@/components/forms/BookingForm";
import { Breadcrumbs } from "@/components/pages/Breadcrumbs";
import { WhatsAppButton } from "@/components/ui/Button";
import { WHATSAPP_URL } from "@/content/site";
import { dictionary } from "@/content/i18n";
import { formText } from "@/content/i18n/forms";
import { format, localDigits } from "@/lib/i18n/config";
import { getLocale, loginRedirectPath } from "@/lib/i18n/server";
import { getPickupChargeMinor } from "@/lib/booking-estimate";
import { getServicePrices } from "@/lib/service-prices";
import { getSiteContent } from "@/lib/site-content";
import { getGoal } from "@/lib/customer/portal";
import { usableCoupon } from "@/lib/customer/goal";
import { keepBanglaSuffixes } from "@/lib/i18n/config";
import { repeatItemsFor } from "@/lib/booking-repeat";
import { getItemPairs, getUsualItems } from "@/lib/upsell-data";

/** Quick picks on /book: the everyday items customers send most, exactly as the Ops price list names them. */
const POPULAR_ITEMS = ["Shirt", "Pant", "T-Shirt", "Panjabi", "Kamiz", "Salwar", "Sari (Cotton)", "Jeans", "Blazer", "Bed Sheet (Medium)"];

export const generateMetadata = () => pageMetadata("/book");

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** Primary booking route (spec §22). The mobile conversion bar is intentionally absent here. */
export default async function BookPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
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
  // 10% for any booking made signed in (with a goal coupon, whichever saves more); guests are asked
  // to sign in. Staff, unfinished profiles and unavailable accounts see neither line.
  const guest = session.kind === "anonymous";
  const accountOffer = account ? ("yours" as const) : guest ? ("guest" as const) : undefined;
  const returnTo = `/book${service ? `?service=${encodeURIComponent(service)}` : ""}`;
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
    <section aria-labelledby="page-title" className="group/book pb-(--space-section) pt-7 md:pt-10 xl:pt-12">
      <div className="container-page">
        <div className="hidden md:block">
          <Breadcrumbs items={[{ label: dictionary(locale).common.home, href: "/" }, { label: t.crumb }]} />
        </div>
        <div className="grid-page gap-y-10 md:mt-8">
          <div className="col-span-4 md:col-span-8 xl:col-span-7">
            <div className="max-w-[640px]">
              <BookingForm
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
                accountOffer={accountOffer}
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
            </div>
          </div>

          <aside aria-label={t.asideLabel} className="group-has-[[data-booking-success]]/book:hidden col-span-4 md:col-span-8 xl:col-span-4 xl:col-start-9">
            <div className="xl:sticky xl:top-[calc(100px+var(--promo-h,0px))]">
              <div className="hidden xl:block">
                <h2 className="t-label uppercase text-navy">{t.howTitle}</h2>
                <ol className="mt-4 border-t border-navy">
                  {f.booking.nextSteps.map((step, i) => (
                    <li key={step} className="flex gap-3 border-b border-line py-3.5 t-small text-body">
                      <span className="t-label pt-[2px] text-action">{localDigits(String(i + 1).padStart(2, "0"), locale)}</span>
                      {step}
                    </li>
                  ))}
                </ol>
                <p className="mt-4 t-small text-secondary">{t.pickupNote}</p>
              </div>
              <div className="border-t border-line pt-6 xl:mt-8">
                <p className="font-semibold text-navy">{t.ratherTitle}</p>
                <p className="mt-1 t-small text-secondary">{t.ratherBody}</p>
                <WhatsAppButton href={WHATSAPP_URL} placement="booking_aside" className="mt-4" />
              </div>
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}
