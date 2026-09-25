import Link from "@/components/i18n/Link";
import { FAQ, FAQS, FAQS_BN, FAQ_KEYS, type FAQItem } from "@/components/home/FAQ";
import { FinalBookingCTA } from "@/components/home/FinalBookingCTA";
import { GoogleProof } from "@/components/home/ProofLine";
import { Eyebrow } from "@/components/home/SectionIntro";
import { ReviewCarousel } from "@/components/reviews/ReviewCarousel";
import { getServiceReviews } from "@/lib/reviews";
import { MobileConversionBar } from "@/components/layout/MobileConversionBar";
import { PageHero } from "@/components/pages/PageHero";
import { ButtonLink, WhatsAppButton } from "@/components/ui/Button";
import type { FAQRef, ServiceContent } from "@/content/services";
import { FREE_DELIVERY_THRESHOLD, WHATSAPP_URL, bookHref, quoteHref } from "@/content/site";
import { ServiceBlockView } from "./ServiceBlocks";
import { ServiceSchema } from "./ServiceSchema";
import { dictionary } from "@/content/i18n";
import { pageText } from "@/content/i18n/pages";
import { fill, localizeHref, type Locale } from "@/lib/i18n/config";
import { getLocale, serviceArea } from "@/lib/i18n/server";

const FINAL_ID = "book";
const TONES = ["warm", "white"] as const;

const toFAQ = (ref: FAQRef, shared: FAQItem[]): FAQItem =>
  typeof ref === "string"
    ? shared[FAQ_KEYS[ref]]
    : {
        q: ref.q,
        a: (
          <>
            {ref.a.map((p) => (
              <p key={p}>{p}</p>
            ))}
          </>
        ),
      };

const noStop = (v: string) => v.replace(/[.।]$/, "");

/** S1: the four answers a customer scans for, straight under the hero. Facts only from the service content. */
function AtAGlance({ service, locale }: { service: ServiceContent; locale: Locale }) {
  const t = pageText(locale).service;
  const rows = [
    { label: t.glancePricing, value: service.glance.pricing },
    { label: t.glanceTurnaround, value: service.glance.turnaround },
    {
      label: t.glancePickup,
      value: fill(t.glancePickupValue, { area: serviceArea(locale), amount: FREE_DELIVERY_THRESHOLD }, locale),
      dropOff: true,
    },
    { label: t.glanceBestFor, value: service.glance.bestFor },
  ];
  return (
    <section aria-labelledby="glance-title" className="pb-14 md:pb-20 xl:pb-24">
      <div className="container-page">
        <h2 id="glance-title" className="t-label uppercase text-action">
          {t.glance}
        </h2>
        <dl className="mt-3 grid border-t border-navy md:grid-cols-2 xl:grid-cols-4">
          {rows.map((r, i) => (
            <div
              key={r.label}
              className={`grid grid-cols-[6.5rem_1fr] gap-4 border-b border-line py-4 md:block md:py-5 md:pr-6 xl:border-b-0 ${
                i % 2 === 1 ? "md:border-l md:pl-6" : ""
              } ${i === 2 ? "xl:border-l xl:pl-6" : ""}`}
            >
              <dt className="t-label uppercase text-secondary">{r.label}</dt>
              <dd className="text-[16px] font-semibold leading-snug text-navy md:mt-2 md:text-[17px]">
                {noStop(r.value)}
                {"dropOff" in r ? (
                  // Pickup stays the default; the outlets are an option, not a requirement.
                  <Link
                    href="/locations"
                    className="mt-1 block t-small font-normal text-secondary underline decoration-blue/50 underline-offset-4 hover:text-navy"
                  >
                    {t.dropOff}
                  </Link>
                ) : null}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

/**
 * Reviews for this service, moving like the homepage strip. Reviews already
 * featured on the page are not repeated. If no review mentions this service,
 * the heading says these are reviews of Velto in general.
 */
async function ServiceReviews({
  service,
  tone,
  locale,
}: {
  service: ServiceContent;
  tone: (typeof TONES)[number];
  locale: Locale;
}) {
  const t = pageText(locale).service;
  const f = (template: string) => fill(template, { service: service.name }, locale);
  const featured = service.blocks.flatMap((b) => (b.type === "review" ? [b.review] : []));
  const { reviews, specific } = await getServiceReviews(service.slug, featured);
  if (!reviews.length) return null;
  return (
    <section aria-labelledby="service-reviews-title" className={`py-(--space-section) ${tone === "warm" ? "bg-warm" : ""}`}>
      <div className="container-page flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <Eyebrow>{t.customerProof}</Eyebrow>
          <h2 id="service-reviews-title" className="t-h2 max-w-[20ch] text-navy">
            {specific ? f(t.reviewsAbout) : t.reviewsGeneral}
          </h2>
        </div>
        <GoogleProof placement="service_reviews" />
      </div>
      <div className="mt-(--space-intro-content)">
        <ReviewCarousel reviews={reviews} label={specific ? f(t.reviewsLabelOf) : t.reviewsLabel} />
      </div>
    </section>
  );
}

/**
 * Service page: shared hero, typed content blocks in the order each service
 * needs, FAQ, and the conversion that fits how the service is priced.
 */
export async function ServicePage({ service }: { service: ServiceContent }) {
  const locale = await getLocale();
  const d = dictionary(locale);
  const t = pageText(locale).service;
  const shared = locale === "bn" ? FAQS_BN : FAQS;
  const source = `${service.slug}-page`;
  const path = `/services/${service.slug}`;
  const isQuote = service.primary === "quote";
  const bookService = service.slug;
  const quoteService = isQuote || service.secondary === "quote" ? service.slug : undefined;
  // Two text buttons stack on mobile; Book + WhatsApp share one row at ~60/40.
  const stacked = service.secondary === "book" || service.secondary === "quote";
  const buttonCls = (variant: "primary" | "secondary") =>
    stacked || variant === "secondary" ? "" : "flex-[1.45] max-md:px-4 md:flex-none";

  const book = (placement: string, variant: "primary" | "secondary", src: string) => (
    <ButtonLink
      href={bookHref(src, bookService)}
      event="book_pickup_click"
      placement={placement}
      variant={variant}
      className={buttonCls(variant)}
    >
      {d.common.bookPickup}
    </ButtonLink>
  );
  const quote = (placement: string, variant: "primary" | "secondary", src: string) => (
    <ButtonLink href={quoteHref(quoteService, src)} placement={placement} variant={variant} className={buttonCls(variant)}>
      {d.nav.requestQuote}
    </ButtonLink>
  );

  const primary = isQuote ? quote("service_hero", "primary", source) : book("service_hero", "primary", source);
  const secondary =
    service.secondary === "book"
      ? book("service_hero", "secondary", `${source}-secondary`)
      : service.secondary === "quote"
        ? quote("service_hero", "secondary", `${source}-secondary`)
        : (
            <WhatsAppButton href={WHATSAPP_URL} placement="service_hero" className="flex-1 max-md:px-3 md:flex-none">
              {d.common.whatsapp}
            </WhatsAppButton>
          );

  const primaryOverride = isQuote
    ? { href: quoteHref(quoteService, `${source}-final`), label: d.nav.requestQuote, helper: t.quoteHelper }
    : undefined;

  return (
    <>
      <ServiceSchema
        name={service.name}
        description={service.meta.description}
        path={localizeHref(path, locale)}
        crumbs={[
          { label: d.common.home, path: localizeHref("/", locale) },
          { label: d.nav.services, path: localizeHref("/services", locale) },
          { label: service.name, path: localizeHref(path, locale) },
        ]}
      />
      <PageHero
        crumbs={[{ label: d.common.home, href: "/" }, { label: d.nav.services, href: "/services" }, { label: service.name }]}
        title={service.h1}
        // The local modifier lives in the label, not stuffed into the headline.
        eyebrow={fill(t.eyebrow, { service: service.name }, locale)}
        highlight={service.h1Highlight}
        image={service.image}
        stackActionsOnMobile={stacked}
        actions={
          <>
            {primary}
            {secondary}
          </>
        }
        aside={service.heroGoogleProof ? <GoogleProof placement="service_hero" /> : undefined}
      >
        {service.intro.map((p) => (
          <p key={p}>{p}</p>
        ))}
      </PageHero>

      <AtAGlance service={service} locale={locale} />

      {service.blocks.map((block, i) => (
        <ServiceBlockView
          key={`${block.type}-${i}`}
          block={block}
          id={`${block.type}-${i}-title`}
          tone={TONES[i % 2]}
          serviceName={service.name}
        />
      ))}

      <ServiceReviews service={service} tone={TONES[service.blocks.length % 2]} locale={locale} />

      <FAQ
        title={service.faq.title}
        items={service.faq.items.map((ref) => toFAQ(ref, shared))}
        className={TONES[service.blocks.length % 2] === "warm" ? "" : "bg-warm"}
      />

      <FinalBookingCTA
        id={FINAL_ID}
        title={service.final.title}
        body={<p>{service.final.body}</p>}
        source={`${source}-final`}
        service={bookService}
        primary={primaryOverride}
      />
      <MobileConversionBar
        finalSectionId={FINAL_ID}
        source={`${source}-sticky`}
        service={bookService}
        primary={isQuote ? { href: quoteHref(quoteService, `${source}-sticky`), label: d.nav.requestQuote } : undefined}
      />
    </>
  );
}
