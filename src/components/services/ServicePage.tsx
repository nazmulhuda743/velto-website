import { FAQ, FAQS, FAQ_KEYS, type FAQItem } from "@/components/home/FAQ";
import { FinalBookingCTA } from "@/components/home/FinalBookingCTA";
import { GoogleProof, ProofList } from "@/components/home/ProofLine";
import { MobileConversionBar } from "@/components/layout/MobileConversionBar";
import { PageHero } from "@/components/pages/PageHero";
import { ButtonLink, WhatsAppButton } from "@/components/ui/Button";
import type { FAQRef, ServiceContent } from "@/content/services";
import { WHATSAPP_URL, bookHref, quoteHref } from "@/content/site";
import { ServiceBlockView } from "./ServiceBlocks";
import { ServiceSchema } from "./ServiceSchema";

const FINAL_ID = "book";
const TONES = ["warm", "white"] as const;

const toFAQ = (ref: FAQRef): FAQItem =>
  typeof ref === "string"
    ? FAQS[FAQ_KEYS[ref]]
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

/**
 * Service page: shared hero, typed content blocks in the order each service
 * needs, FAQ, and the conversion that fits how the service is priced.
 */
export function ServicePage({ service }: { service: ServiceContent }) {
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
      Book a Pickup
    </ButtonLink>
  );
  const quote = (placement: string, variant: "primary" | "secondary", src: string) => (
    <ButtonLink href={quoteHref(quoteService, src)} placement={placement} variant={variant} className={buttonCls(variant)}>
      Request a Quote
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
              WhatsApp
            </WhatsAppButton>
          );

  const primaryOverride = isQuote
    ? { href: quoteHref(quoteService, `${source}-final`), label: "Request a Quote" }
    : undefined;

  return (
    <>
      <ServiceSchema
        name={service.name}
        description={service.meta.description}
        path={path}
        crumbs={[
          { label: "Home", path: "/" },
          { label: "Services", path: "/services" },
          { label: service.name, path },
        ]}
      />
      <PageHero
        crumbs={[{ label: "Home", href: "/" }, { label: "Services", href: "/services" }, { label: service.name }]}
        title={service.h1}
        image={service.image}
        stackActionsOnMobile={stacked}
        actions={
          <>
            {primary}
            {secondary}
          </>
        }
        aside={
          <>
            {service.heroGoogleProof ? (
              <div className="mb-3">
                <GoogleProof placement="service_hero" />
              </div>
            ) : null}
            <ProofList items={service.heroFacts} />
          </>
        }
      >
        {service.intro.map((p) => (
          <p key={p}>{p}</p>
        ))}
      </PageHero>

      {service.blocks.map((block, i) => (
        <ServiceBlockView
          key={`${block.type}-${i}`}
          block={block}
          id={`${block.type}-${i}-title`}
          tone={TONES[i % 2]}
          serviceName={service.name}
        />
      ))}

      <FAQ
        title={service.faq.title}
        items={service.faq.items.map(toFAQ)}
        className={TONES[(service.blocks.length - 1) % 2] === "warm" ? "" : "bg-warm"}
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
        primary={isQuote ? { href: quoteHref(quoteService, `${source}-sticky`), label: "Request a Quote" } : undefined}
      />
    </>
  );
}
