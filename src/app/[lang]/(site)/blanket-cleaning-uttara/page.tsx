import { ServiceViewTracker } from "@/components/analytics/ServiceViewTracker";
import { B999Form } from "@/components/b999/B999Form";
import { dayLabel } from "@/components/b999/day-label";
import { waHref } from "@/components/b999/wa";
import { B999Sticky } from "@/components/b999/B999Sticky";
import { FAQ } from "@/components/home/FAQ";
import { GoogleProof } from "@/components/home/ProofLine";
import { ResponsiveImage } from "@/components/ui/ResponsiveImage";
import { b999Text, type B999Text } from "@/content/i18n/b999";
import { IMAGES } from "@/content/mock";
import { B999, b999WhatsApp, dhakaToday, offeredDays } from "@/lib/campaigns/b999";
import { b999OpenDays, b999PricesOk, b999WritesEnabled } from "@/lib/campaigns/b999-server";
import { localDigits, type Locale } from "@/lib/i18n/config";
import { getLocale } from "@/lib/i18n/server";
import { pageMetadata } from "@/lib/seo/page-metadata";
import { getLocations, resolveImage } from "@/lib/site-content";
import { isSupabaseConfigured } from "@/lib/supabase-server";

/**
 * The B999 blanket landing page: 3 Regular/Medium blankets for ৳999 with pickup and delivery
 * (docs/technical/B999.md). One conversion page with a locked booking; the site-wide offer bar
 * and popup are hidden here (lib/promo.ts), and the 10% / coupons never apply (api/b999).
 */
export const dynamic = "force-dynamic";
export const generateMetadata = () => pageMetadata("/blanket-cleaning-uttara");

const BOOK = "book";

function fillFor(locale: Locale) {
  const n = (v: number) => localDigits(v, locale);
  return (s: string) =>
    s
      .replaceAll("{package}", n(B999.packagePrice))
      .replaceAll("{heavy}", n(B999.heavyPrice))
      .replaceAll("{regular}", n(B999.regularPrice))
      .replaceAll("{addon}", n(B999.heavyAddOn))
      .replaceAll("{min}", n(B999.turnaroundDays.min))
      .replaceAll("{max}", n(B999.turnaroundDays.max));
}

function WhatsAppCta({ text, placement, label, className = "" }: { text: string; placement: string; label: string; className?: string }) {
  return (
    <a
      href={waHref(text)}
      target="_blank"
      rel="noopener noreferrer"
      data-analytics="whatsapp_click"
      data-placement={placement}
      data-service="blanket-comforter-cleaning"
      className={`inline-flex min-h-[52px] items-center justify-center rounded-md border border-line-strong bg-white px-6 font-semibold text-navy hover:border-navy ${className}`}
    >
      {label}
    </a>
  );
}

/** Line drawings, not photos: a real Velto photo can replace either later (no stock or generated bedding). */
function BlanketDrawing({ heavy }: { heavy?: boolean }) {
  const layers = heavy ? 5 : 3;
  const gap = heavy ? 11 : 8;
  return (
    <svg viewBox="0 0 160 96" aria-hidden="true" className="h-24 w-40 text-navy">
      {Array.from({ length: layers }, (_, i) => (
        <rect key={i} x={18 + i * 1.5} y={70 - i * gap} width={124 - i * 3} height={heavy ? 12 : 9} rx="4" fill={i % 2 ? "var(--color-soft)" : "white"} stroke="currentColor" strokeWidth="1.5" />
      ))}
    </svg>
  );
}

function Section({ id, title, children, className = "" }: { id: string; title: string; children: React.ReactNode; className?: string }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className={`py-10 md:py-14 ${className}`}>
      <div className="container-page">
        <h2 id={`${id}-title`} className="t-h2 text-navy">
          {title}
        </h2>
        <div className="mt-6">{children}</div>
      </div>
    </section>
  );
}

function Summary({ t, fill }: { t: B999Text; fill: (s: string) => string }) {
  return (
    <aside aria-labelledby="b999-summary-title" className="rounded-lg border-2 border-navy bg-white p-5 md:p-6" data-b999-summary>
      <p id="b999-summary-title" className="t-label uppercase text-secondary">
        {t.summaryTitle}
      </p>
      <p className="mt-3 text-[18px] font-semibold text-navy">{t.summaryItems}</p>
      <div className="mt-3 flex items-baseline justify-between gap-4 border-t border-line pt-3">
        <span className="text-body">{t.summaryTotal}</span>
        <span className="text-[30px] font-semibold leading-none text-navy">৳{fill("{package}")}</span>
      </div>
      <ul className="mt-3 space-y-1 t-small text-navy">
        <li>{t.pickupIncluded}</li>
        <li>{t.summaryPay}</li>
      </ul>
      <p className="mt-3 border-t border-line pt-3 t-caption text-secondary">{fill(t.summarySmall)}</p>
      <div className="mt-3">
        <GoogleProof placement="b999_summary" />
      </div>
    </aside>
  );
}

export default async function BlanketB999Page() {
  const locale = await getLocale();
  const t = b999Text(locale);
  const fill = fillFor(locale);
  const today = dhakaToday();
  // Local design review (no database): every offered day, nothing is sent.
  const preview = process.env.NODE_ENV !== "production" && !isSupabaseConfigured();
  let open = preview;
  let days: string[] = preview ? offeredDays(today) : [];
  if (!preview && b999WritesEnabled()) {
    try {
      // Offered only while the live price list still says ৳400 / ৳450 (else: WhatsApp).
      open = await b999PricesOk();
      if (open) days = await b999OpenDays();
    } catch {
      open = false;
    }
  }
  const [primary] = await getLocations();
  const tomorrow = offeredDays(today)[0] ?? null;
  // Admin → Images can replace any of these with a real Velto photo. The category slots start empty
  // (a line drawing shows), and the outlet photo is the real Sector 11 frontage.
  const [regularPhoto, heavyPhoto, outletPhoto] = await Promise.all([
    resolveImage(IMAGES.b999.regular),
    resolveImage(IMAGES.b999.heavy),
    resolveImage(IMAGES.locations["sector-11"]),
  ]);
  // The next open pickup day from the live cap data: an honest reason to book now, never a countdown.
  const nextDay = open && days[0] ? dayLabel(days[0], t, locale, tomorrow) : null;

  return (
    <>
      <ServiceViewTracker service="blanket-comforter-cleaning" />

      {/* 1. Hero: what, how many, price, where. Photo on the right from md up. */}
      <section id="hero" aria-labelledby="page-title" className="bg-warm pb-10 pt-8 md:pb-16 md:pt-14">
        <div className="container-page grid gap-8 md:grid-cols-12 md:items-center">
          <div className="md:col-span-7">
            <p className="t-label uppercase text-action">{t.heroEyebrow}</p>
            <h1 id="page-title" className="mt-3 text-navy">
              <span className="block t-h1">{t.heroTitle}</span>
              <span className="mt-1 block text-[56px] font-semibold leading-none tracking-[-0.02em] md:text-[80px]">৳{fill("{package}")}</span>
            </h1>
            <p className="mt-3 text-[18px] font-semibold text-navy">{t.pickupIncluded}</p>
            <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 t-small text-secondary">
              {t.heroFacts.map((f) => (
                <li key={f}>{f}</li>
              ))}
              {nextDay ? (
                <li className="font-semibold text-navy" data-b999-next-pickup>
                  {t.nextPickup}: {nextDay}
                </li>
              ) : null}
            </ul>
            <p className="mt-4 max-w-[52ch] text-body md:t-body-lg">{t.heroSupport}</p>
            <p className="mt-2 max-w-[52ch] t-small text-secondary">{fill(t.heroQualifier)}</p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <a
                href={`#${BOOK}`}
                data-b999-hero-cta
                data-analytics="book_pickup_click"
                data-placement="b999_hero"
                data-service="blanket-comforter-cleaning"
                className="inline-flex min-h-[52px] items-center justify-center rounded-md bg-action px-7 text-[17px] font-semibold text-white hover:bg-action-hover"
              >
                {t.bookPickup}
              </a>
              <WhatsAppCta text={b999WhatsApp.check} placement="b999_hero" label={t.whatsappUs} />
            </div>
            <div className="mt-5">
              <GoogleProof placement="b999_hero" />
            </div>
          </div>
          <div className="md:col-span-5">
            <ResponsiveImage image={IMAGES.b999.hero} sizes="(min-width: 768px) 40vw, 100vw" aspect="aspect-[4/3] md:aspect-[4/5]" priority />
          </div>
        </div>
      </section>

      {/* 2. How it works. */}
      <Section id="how" title={t.howTitle}>
        <ol className="grid grid-cols-1 gap-2 sm:grid-cols-5">
          {t.howSteps.map((s, i) => (
            <li key={s} className="flex items-center gap-3 rounded-md border border-line bg-white px-4 py-3 sm:flex-col sm:items-start">
              <span className="t-label text-action">{localDigits(String(i + 1).padStart(2, "0"), locale)}</span>
              <span className="font-semibold text-navy">{s}</span>
            </li>
          ))}
        </ol>
      </Section>

      {/* 3. Does your blanket qualify? */}
      <Section id="qualify" title={t.qualifyTitle} className="bg-soft">
        <div className="grid gap-4 md:grid-cols-2">
          {[
            { title: t.regularTitle, price: fill(t.regularPrice), points: t.regularPoints, heavy: false, photo: regularPhoto },
            { title: t.heavyTitle, price: fill(t.heavyPrice), points: t.heavyPoints, heavy: true, photo: heavyPhoto },
          ].map((c) => (
            <div key={c.title} className="rounded-lg border border-line bg-white p-5 md:p-6" data-b999-category={c.heavy ? "heavy" : "regular"}>
              {c.photo.src ? <ResponsiveImage image={c.photo} sizes="(min-width: 768px) 45vw, 100vw" aspect="aspect-[16/10]" /> : <BlanketDrawing heavy={c.heavy} />}
              <div className="mt-3 flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="t-h4 text-navy">{c.title}</h3>
                <p className="text-[20px] font-semibold text-navy">{c.price}</p>
              </div>
              <ul className="mt-3 space-y-1.5 text-body">
                {c.points.map((p) => (
                  <li key={p} className="flex gap-2">
                    <span aria-hidden="true" className="text-action">
                      ·
                    </span>
                    {p}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-4 rounded-lg border border-line bg-white p-5 md:p-6">
          <h3 className="font-semibold text-navy">{t.notPartTitle}</h3>
          <p className="mt-1 text-body">{t.notPartPoints.join(", ")}.</p>
          <p className="mt-1 t-small text-secondary">{t.notPartNote}</p>
        </div>
        <WhatsAppCta text={b999WhatsApp.check} placement="b999_qualify" label={t.notSure} className="mt-4" />
      </Section>

      {/* 4. Clear pricing + 5. Price promise + 6. Practical details. */}
      <Section id="pricing" title={t.pricingTitle}>
        <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
          <dl className="divide-y divide-line border-y border-navy">
            {t.pricingRows.map(([k, v]) => (
              <div key={k} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-3.5">
                <dt className="text-body">{k}</dt>
                <dd className="font-semibold text-navy">{fill(v)}</dd>
              </div>
            ))}
          </dl>
          <div className="space-y-6">
            <div className="rounded-lg bg-soft p-5 md:p-6" data-b999-promise>
              <h3 className="t-h4 text-navy">{t.promiseTitle}</h3>
              <p className="mt-2 text-body">{t.promise}</p>
            </div>
            <div>
              <h3 className="t-h4 text-navy">{t.detailsTitle}</h3>
              <dl className="mt-2 divide-y divide-line border-y border-line">
                {t.details.map(([k, v]) => (
                  <div key={k} className="flex flex-wrap justify-between gap-x-4 py-3">
                    <dt className="text-secondary">{k}</dt>
                    <dd className="font-semibold text-navy">{fill(v)}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </div>
        <p className="mt-4 t-small text-secondary">{t.fewerNote}</p>
      </Section>

      {/* 7. Trust proof: real data only (rating and count from Site settings). */}
      <Section id="trust" title={t.trustTitle} className="bg-soft">
        <div className={`grid gap-6 ${outletPhoto.src ? "md:grid-cols-12" : ""}`}>
          {outletPhoto.src ? (
            <div className="md:col-span-4">
              <ResponsiveImage image={outletPhoto} sizes="(min-width: 768px) 30vw, 100vw" aspect="aspect-[4/3]" />
            </div>
          ) : null}
          <div className={outletPhoto.src ? "md:col-span-8" : ""}>
            <GoogleProof placement="b999_trust" />
            <ul className="mt-4 grid gap-2 sm:grid-cols-2">
              {t.trustPoints.map((p, i) => (
                <li key={p} className="rounded-md border border-line bg-white px-4 py-3 text-navy">
                  {p}
                  {i === 0 ? <span className="mt-1 block t-small text-secondary">{primary.address}</span> : null}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Section>

      {/* 8. Booking summary + 9. Booking form. */}
      <section id={BOOK} aria-label={t.formTitle} className="scroll-mt-24 py-10 md:py-14">
        <div className="container-page grid gap-6 xl:grid-cols-12 xl:gap-10">
          <div className="xl:order-2 xl:col-span-4">
            <div className="xl:sticky xl:top-[calc(100px+var(--promo-h,0px))]">
              <Summary t={t} fill={fill} />
            </div>
          </div>
          <div className="xl:order-1 xl:col-span-7">
            {open ? (
              <B999Form t={t} locale={locale} initialDays={days} tomorrow={tomorrow} preview={preview} />
            ) : (
              <div className="rounded-lg border border-line-strong bg-soft p-5 md:p-6" data-b999-closed>
                <h2 className="t-h3 text-navy">{t.unavailableTitle}</h2>
                <p className="mt-2 text-body">{t.unavailableBody}</p>
                <WhatsAppCta text={b999WhatsApp.check} placement="b999_closed" label={t.whatsappUs} className="mt-4" />
              </div>
            )}
          </div>
        </div>
      </section>

      {/* 10. FAQ (4 short items). */}
      <FAQ title={t.faqTitle} eyebrow={null} items={t.faq.map(([q, a]) => ({ q: fill(q), a: fill(a), text: fill(a) }))} className="bg-soft" />

      <div className="h-20 md:hidden" aria-hidden="true" />
      <B999Sticky label={fill(t.sticky)} target={BOOK} />
    </>
  );
}
