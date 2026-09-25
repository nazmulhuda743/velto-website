import type { Metadata } from "next";
import Link from "next/link";
import { LegalContact, LegalDocument, type LegalSection } from "@/components/legal/LegalDocument";
import { LEGAL } from "@/content/legal";
import { FREE_DELIVERY_THRESHOLD, REGULAR_FREE_DELIVERY_THRESHOLD, SERVICE_AREA } from "@/content/site";

export const metadata: Metadata = {
  title: "Terms of Service | Velto Premium Laundry",
  description:
    "The terms that apply when you book a pickup, request a quote or use the Velto website: pricing, turnaround, garment care, liability and how to raise a problem.",
  alternates: { canonical: "/terms" },
  robots: { index: false, follow: true },
};

/*
 * Drafted for owner and legal review before launch. Clauses that set an
 * operating policy not yet confirmed in docs/PROJECT-BUILD-SPEC.md are listed
 * in docs/legal/LEGAL-REVIEW.md. No amounts, periods or caps are invented here.
 */
const SECTIONS: LegalSection[] = [
  {
    id: "about",
    title: "About these terms",
    body: (
      <>
        <p>
          These Terms of Service (&ldquo;Terms&rdquo;) apply when you use the Velto website, book a pickup, request a quote,
          track an order or hand items to {LEGAL.tradingName} (&ldquo;Velto&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;) at
          one of our outlets. By doing any of these, you agree to these Terms.
        </p>
        <p>
          If something we confirm with you for a specific order (for example a quoted price or an agreed delivery time)
          differs from these Terms or from general information on the website, what we confirmed for that order applies.
        </p>
        <p>
          Nothing in these Terms takes away rights you have as a consumer under the laws of Bangladesh, including the
          Consumer Rights Protection Act, 2009.
        </p>
      </>
    ),
  },
  {
    id: "definitions",
    title: "Words we use",
    body: (
      <ul>
        <li>
          <strong>Items</strong>: the garments, curtains, carpets, bedding and anything else you give us to clean, iron or
          finish.
        </li>
        <li>
          <strong>Order</strong>: the items collected or received from you at one time, under one order number.
        </li>
        <li>
          <strong>Service area</strong>: {SERVICE_AREA}, where pickup and delivery are normally available.
        </li>
        <li>
          <strong>Request</strong>: a booking or quote you send through the website or WhatsApp. A request is not yet a
          confirmed order.
        </li>
      </ul>
    ),
  },
  {
    id: "requests",
    title: "Booking requests and confirmation",
    body: (
      <>
        <p>
          Sending a booking or quote request tells us what you need. <strong>It is not a confirmed pickup.</strong> A
          pickup is confirmed only when we call or message you to agree it. If the website shows an error, or you
          don&apos;t hear from us, please treat the request as not received and contact us on WhatsApp.
        </p>
        <p>
          Please give us accurate details: your name, a phone number we can reach you on, your pickup address and what you
          are sending. We may decline or reschedule a request, for example if the address is outside the service area,
          we cannot reach you, or we cannot safely take on the items requested.
        </p>
        <p>
          Any reference number shown after you send a request identifies the request only. Your order number is the one
          on your Velto receipt.
        </p>
      </>
    ),
  },
  {
    id: "area",
    title: "Service area, pickup and delivery",
    body: (
      <>
        <p>
          We collect from and deliver to addresses in {SERVICE_AREA}. Requests from outside that area are considered
          case by case and are never automatically accepted.
        </p>
        <p>
          Pickup and delivery are free for orders of {FREE_DELIVERY_THRESHOLD} or more. On a fixed weekly or fortnightly
          Regular Laundry pickup, regular orders qualify from {REGULAR_FREE_DELIVERY_THRESHOLD}. Smaller orders have a
          pickup and delivery charge, which we tell you when we confirm the pickup.
        </p>
        <p>
          Pickup and delivery times are agreed with you. Please make sure someone is available at the agreed time. If
          nobody is available, we will contact you to arrange another time.
        </p>
        <p>
          You can also drop items off and collect them at our outlets in Sector 11 and Sector 18 during their opening
          hours.
        </p>
      </>
    ),
  },
  {
    id: "prices",
    title: "Prices, quotes and charges",
    body: (
      <>
        <p>
          Prices come from Velto&apos;s current price list and depend on the item and the service. Clothing is priced per
          item; curtains and carpets are priced per square foot; blankets, comforters and quilts are priced per piece by
          type and size. Some items are priced <strong>after assessment</strong>: the price is confirmed once we have
          seen the item.
        </p>
        <p>
          For curtains, carpets and other items where size, material or condition matters, a quote or website price is a
          guide. We confirm the final amount before we start the work, and before pickup where the details allow.
        </p>
        <p>
          Express service, where available, carries an extra charge that we confirm with you first. If you ask for
          additional work (for example extra stain treatment or repairs), we will tell you the cost and ask before doing
          it.
        </p>
        <p>
          We work hard to keep website prices correct. If a price shown on the website is clearly wrong, we will tell you
          the correct price before processing your items, and you can choose not to go ahead.
        </p>
      </>
    ),
  },
  {
    id: "payment",
    title: "Payment",
    body: (
      <>
        <p>
          Nothing is paid when you send a request. Payment for an order is due on delivery or collection, or as otherwise
          agreed when we confirm the order, using the payment methods Velto accepts at the time. Your receipt shows the
          items, services and amount for the order.
        </p>
        <p>
          We may hold finished items until an order has been paid for. If you believe a charge is wrong, tell us before or
          at delivery and we will check it with you.
        </p>
      </>
    ),
  },
  {
    id: "intake",
    title: "Intake: counting, tagging and assessment",
    body: (
      <>
        <p>
          When your order reaches Velto, we check it in, count the items and tag them to your order. We look over each
          garment&apos;s condition and visible stains before cleaning starts, and route each item to the service it needs.
        </p>
        <p>
          The item count and details recorded at intake are the record for your order. If our count differs from what you
          expected, or we notice existing damage, weakness, missing parts or a stain that needs a decision, we will contact
          you before going ahead.
        </p>
        <p>
          If we believe an item cannot be cleaned safely with the service booked, we will explain the options, which may
          include a different service or returning it uncleaned.
        </p>
      </>
    ),
  },
  {
    id: "your-part",
    title: "What we ask of you",
    body: (
      <>
        <p>To help us look after your items, please:</p>
        <ul>
          <li>empty all pockets and remove anything that isn&apos;t part of the garment;</li>
          <li>
            tell us about stains (and what caused them, if you know), existing damage, loose trims or beads, and anything
            fragile or unusual;
          </li>
          <li>keep care labels attached, and tell us if an item has no label or you have special instructions;</li>
          <li>
            tell us before handing over an item of exceptional value or sentimental importance, so we can discuss how it
            will be handled;
          </li>
          <li>not send items that are wet with chemicals, contaminated, hazardous or unlawful.</li>
        </ul>
        <p>
          Information you give us helps us choose the right treatment. If an item is damaged because important
          information was not shared with us, we may not be responsible (see section 13).
        </p>
      </>
    ),
  },
  {
    id: "turnaround",
    title: "Turnaround and Express",
    body: (
      <>
        <p>
          General orders usually take around 48 hours. Wash &amp; Iron and Dry Cleaning usually take around 72 hours.
          Blankets and comforters usually need roughly 3–4 days. Special garments, household items, unusual conditions,
          and busy periods can take longer.
        </p>
        <p>
          These are usual times, not guarantees. If an order will take longer than we told you, we will let you know.
        </p>
        <p>
          Express is available only for some items and services, depending on current workload. It is never guaranteed
          until we confirm it for your order.
        </p>
      </>
    ),
  },
  {
    id: "care",
    title: "Garment care, stains and results",
    body: (
      <>
        <p>We will clean, finish and handle your items with reasonable care and skill, following our written procedures.</p>
        <p>
          <strong>Not every stain can be removed.</strong> We check visible stains and treat them according to the item
          and service, but we cannot promise that a stain will come out. Old, set or unknown stains, and some materials,
          limit what is possible. If a stain needs extra treatment that carries a risk, we will explain the options first.
        </p>
        <p>
          Some changes can happen even with correct care, because of how an item was made. These include slight
          shrinkage, colour loss or bleeding from dyes that are not colourfast, reaction of glued parts, coatings or prints,
          and wear on fabric that was already weakened. Where we can see such a risk at intake, we will tell you.
        </p>
      </>
    ),
  },
  {
    id: "pockets",
    title: "Items left in garments",
    body: (
      <p>
        We check pockets at intake as a courtesy, but we are not responsible for money, jewellery, documents or other
        items left in garments, or for damage they cause (for example pens or tissues). Anything we find will be kept
        aside and returned with your order.
      </p>
    ),
  },
  {
    id: "issues",
    title: "If something isn't right",
    body: (
      <>
        <p>
          Please check your order when it arrives. If an item is missing, damaged or not cleaned as agreed, tell us{" "}
          <strong>as soon as possible</strong>, and before the item is worn, washed, altered or cleaned elsewhere, so we
          can see it as it came back from us.
        </p>
        <p>
          Contact us on WhatsApp with your order number and photos, or bring the item to an outlet. We will look into it
          and reply with what we found. Where we fell short, we will put it right: usually by re-cleaning or re-finishing
          the item at no charge, and otherwise as set out in section 13.
        </p>
      </>
    ),
  },
  {
    id: "liability",
    title: "Our responsibility for loss or damage",
    body: (
      <>
        <p>
          If an item is lost or damaged while in our care because we did not use reasonable care and skill, we will
          compensate you fairly. Compensation reflects the item&apos;s value at the time it was handed over, taking into
          account its age, condition and wear, and is not the price of a new replacement unless we agree otherwise. We may
          ask for reasonable evidence of the item&apos;s value.
        </p>
        <p>We are not responsible for:</p>
        <ul>
          <li>stains that cannot be removed, or results limited by the item&apos;s material or condition (section 10);</li>
          <li>
            damage caused by defects in how the item was made, by incorrect or missing care labels, or by weaknesses or
            damage that existed before we received it;
          </li>
          <li>damage resulting from information about the item that was not shared with us (section 8);</li>
          <li>items left in pockets (section 11);</li>
          <li>indirect losses, such as missed events or travel costs;</li>
          <li>delays or failures caused by events outside our reasonable control.</li>
        </ul>
        <p>
          Nothing in these Terms limits our responsibility where the law does not allow it to be limited, or removes your
          statutory rights.
        </p>
      </>
    ),
  },
  {
    id: "changes-cancellations",
    title: "Changes and cancellations",
    body: (
      <>
        <p>
          You can change or cancel a pickup at no charge before we collect, by messaging us on WhatsApp. Once work on your
          items has started, you may be charged for the work already done.
        </p>
        <p>
          If we need to change an agreed pickup or delivery time, we will contact you as early as we can to agree a new
          one.
        </p>
      </>
    ),
  },
  {
    id: "uncollected",
    title: "Orders we cannot deliver or that are not collected",
    body: (
      <p>
        If we cannot deliver an order, or an order left for collection is not collected, we will keep it safely at our
        outlet and try to contact you by phone and WhatsApp. Please keep your contact details up to date so we can reach
        you. If an order remains uncollected for a long time despite our attempts to contact you, we will write to you
        before taking any further step.
      </p>
    ),
  },
  {
    id: "regular",
    title: "Regular Laundry pickups",
    body: (
      <>
        <p>
          A Regular Laundry pickup is a fixed weekly or fortnightly schedule that we agree with you. Each pickup is a
          separate order under these Terms. On that schedule, regular orders of {REGULAR_FREE_DELIVERY_THRESHOLD} or more
          qualify for free pickup and delivery.
        </p>
        <p>You can change, pause or stop a regular pickup at any time by telling us before the next pickup.</p>
      </>
    ),
  },
  {
    id: "tracking",
    title: "Order tracking",
    body: (
      <p>
        You can check an order&apos;s status on the website using its order number and the phone number used for the
        order. Please keep these to yourself. Status information is provided for convenience and may be updated with a
        short delay. If it looks wrong, contact us.
      </p>
    ),
  },
  {
    id: "website",
    title: "Using the website",
    body: (
      <>
        <p>
          We aim to keep the website accurate and available, but information such as prices, availability and usual
          turnaround can change, and the website may occasionally be unavailable. What we confirm for your order applies.
        </p>
        <p>
          Please use the website lawfully and only for its intended purpose. Do not send false requests, try to access
          systems or information that are not meant for you, disrupt the website, or collect its content automatically.
        </p>
        <p>
          The Velto name, logo, photographs and website content belong to Velto or are used with permission. You may not
          copy them for commercial use without our written consent. Links to other websites (such as Google Maps or
          WhatsApp) are provided for convenience, and those services have their own terms.
        </p>
      </>
    ),
  },
  {
    id: "privacy",
    title: "Privacy and cookies",
    body: (
      <p>
        How we handle your personal information is explained in our <Link href="/privacy">Privacy Policy</Link>. How the
        website uses cookies, and how to change your choice, is explained in our <Link href="/cookies">Cookie Policy</Link>.
      </p>
    ),
  },
  {
    id: "changes",
    title: "Changes to these Terms",
    body: (
      <p>
        We may update these Terms when our services, prices or the law change. The version that applies to an order is
        the one on the website when the order was confirmed. The &ldquo;Last updated&rdquo; date at the top shows when
        these Terms last changed.
      </p>
    ),
  },
  {
    id: "law",
    title: "Governing law and disputes",
    body: (
      <>
        <p>These Terms are governed by the laws of Bangladesh.</p>
        <p>
          If you have a complaint, please contact us first so we can try to resolve it quickly and fairly. If we cannot
          resolve it together, you may use the remedies available to you under Bangladeshi law, including a complaint to
          the Directorate of National Consumer Rights Protection, and the courts of Dhaka will have jurisdiction.
        </p>
      </>
    ),
  },
  {
    id: "contact",
    title: "Contact us",
    body: <LegalContact />,
  },
];

export default function TermsPage() {
  return (
    <LegalDocument
      label="Legal"
      title="Terms of Service"
      intro={
        <p>
          These terms explain how booking, pricing, pickup, garment care and delivery work at Velto, what we are
          responsible for, and what to do if something isn&apos;t right.
        </p>
      }
      summary={[
        <>A booking request is confirmed only when we call or WhatsApp you to agree the pickup.</>,
        <>
          Pickup and delivery cover {SERVICE_AREA}, free on orders of {FREE_DELIVERY_THRESHOLD}+ ({REGULAR_FREE_DELIVERY_THRESHOLD}+
          on a fixed Regular Laundry schedule).
        </>,
        <>Some items are priced after assessment. We confirm the amount before doing the work.</>,
        <>Turnaround times are usual times, not guarantees. Express is available only when we confirm it.</>,
        <>We check stains before cleaning, but no laundry can promise every stain will come out.</>,
        <>Please empty pockets and tell us about stains, damage and valuable items before handing them over.</>,
        <>If something isn&apos;t right, tell us as soon as possible and before the item is worn or cleaned elsewhere.</>,
      ]}
      sections={SECTIONS}
    />
  );
}
