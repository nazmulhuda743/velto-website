import type { Metadata } from "next";
import Link from "@/components/i18n/Link";
import { LegalContact, LegalDocument, type LegalSection } from "@/components/legal/LegalDocument";
import { LEGAL } from "@/content/legal";
import { alternatesFor } from "@/lib/seo/page-metadata";

const baseMetadata: Metadata = {
  title: "Privacy Policy | Velto Premium Laundry",
  description:
    "What personal information Velto collects through its website, booking and quote forms, why, who it is shared with, how long it is kept and your choices.",
  robots: { index: false, follow: true },
};

export async function generateMetadata(): Promise<Metadata> {
  return { ...baseMetadata, alternates: await alternatesFor("/privacy") };
}

/*
 * Describes the website's real data flows (src/components/forms, src/app/api,
 * src/lib/analytics, docs/technical/COMMAND-CENTER.md). If a flow changes,
 * update this page in the same change. Open items: docs/legal/LEGAL-REVIEW.md.
 */
const SECTIONS: LegalSection[] = [
  {
    id: "scope",
    title: "Who we are and what this policy covers",
    body: (
      <>
        <p>
          {LEGAL.tradingName} (&ldquo;Velto&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;) is a laundry and dry-cleaning
          business in Uttara, Dhaka. We decide how the personal information described here is used, and we are
          responsible for it.
        </p>
        <p>
          This policy covers information we collect through this website (including the booking, quote and order-tracking
          forms), when you contact us on WhatsApp from the website, and when we provide our services to you. It does not
          cover other companies&apos; websites or apps, such as WhatsApp, Google Maps or Facebook, which have their own
          policies.
        </p>
      </>
    ),
  },
  {
    id: "collect",
    title: "Information we collect",
    body: (
      <>
        <p>
          <strong>When you book a pickup:</strong> your name, phone or WhatsApp number, sector, house and road, the
          service you choose, your preferred pickup day and time, and any note you add.
        </p>
        <p>
          <strong>When you request a quote:</strong> your name, phone or WhatsApp number, area, the service, approximate
          quantities or dimensions, and any notes about condition. The quote form lets you pick photos, but{" "}
          <strong>photos are not uploaded through the website</strong>: they stay on your device. If you choose to send
          photos, you send them to us on WhatsApp.
        </p>
        <p>
          <strong>When you track an order:</strong> the order number and phone number you enter, which are checked against
          our order records to show you the status. The website does not store them. To prevent misuse, it keeps only
          one-way scrambled (hashed) versions for a short time, to limit repeated attempts.
        </p>
        <p>
          <strong>When we provide the service:</strong> your order details, such as the items received, their condition,
          services, prices, payment status and pickup and delivery dates, along with records of our calls and messages
          with you about the order.
        </p>
        <p>
          <strong>How you found us:</strong> when you send a booking or quote, the website includes the page you started
          on, the website that referred you, and campaign labels from the link you followed (for example
          &ldquo;utm_campaign&rdquo;). Advertising click identifiers (such as Facebook&apos;s &ldquo;fbclid&rdquo;) are
          included <strong>only if you allowed Marketing cookies</strong>.
        </p>
        <p>
          <strong>Connecting campaigns to orders:</strong> to understand which campaigns bring customers, we connect a
          website booking or quote to our own customer and order records using the phone number you give in the form,
          the same number we already use to serve you. If you allowed Analytics, the anonymous record of that website
          visit is connected to the booking too. This is used only for aggregate marketing reporting, such as how many
          customers a campaign brought and what their orders were worth. It is not sold or shared with advertisers, and
          it does not use your name, IP address or device to identify you.
        </p>
        <p>
          <strong>Website use, only with your permission:</strong> if you allow Analytics, we measure which pages and
          services are viewed, price searches, clicks on buttons such as Book a Pickup, and whether a booking or quote was
          completed. This uses random identifiers and the type of device (mobile, tablet or desktop). It does{" "}
          <strong>not</strong> record your name, phone number, address, what you type into forms, or your IP address. If
          you allow Marketing, Meta and Google advertising tools may also collect information about your visit. See our{" "}
          <Link href="/cookies">Cookie Policy</Link>.
        </p>
        <p>
          <strong>Technical information:</strong> like any website, our hosting and security providers process your IP
          address and basic browser information to deliver pages, keep the site secure and prevent abuse.
        </p>
      </>
    ),
  },
  {
    id: "use",
    title: "How we use it, and why we're allowed to",
    body: (
      <>
        <p>We use personal information only for these purposes:</p>
        <ul>
          <li>
            <strong>To provide the service you ask for</strong>: to confirm and arrange pickup, identify and process your
            items, contact you about your order, deliver it, take payment and handle any issue. We need this information
            to do what you asked.
          </li>
          <li>
            <strong>To keep records we are required to keep</strong>, such as accounting and tax records.
          </li>
          <li>
            <strong>To run and protect the business</strong>: to prevent duplicate, false or abusive submissions, keep the
            website secure, fix problems, and understand which of our own campaigns lead to real enquiries. These are our
            legitimate interests, and we keep them proportionate.
          </li>
          <li>
            <strong>With your consent</strong>: website analytics and advertising measurement (see the Cookie Policy),
            and any marketing messages. You can withdraw consent at any time.
          </li>
        </ul>
        <p>
          We do not use your information for automated decisions that have legal or similarly significant effects on you.
        </p>
      </>
    ),
  },
  {
    id: "never",
    title: "What we don't do",
    body: (
      <ul>
        <li>We do not sell your personal information.</li>
        <li>We do not put your name, phone number, address or form answers into our website analytics.</li>
        <li>We do not store IP addresses in our own website analytics.</li>
        <li>We do not load analytics or advertising tools before you have made a cookie choice that allows them.</li>
        <li>
          We do not give the website direct access to our customer and order records. Forms go through our own server,
          which checks every submission before passing it on.
        </li>
      </ul>
    ),
  },
  {
    id: "sharing",
    title: "Who we share it with",
    body: (
      <>
        <p>
          We share personal information only with organisations that help us run the website and the service, and only
          what they need:
        </p>
        <ul>
          <li>
            <strong>Vercel</strong>: website hosting.
          </li>
          <li>
            <strong>Cloudflare</strong>: domain, network and security services.
          </li>
          <li>
            <strong>Supabase</strong>: the database that holds our operating records, including bookings, quotes, orders
            and website measurement.
          </li>
          <li>
            <strong>Meta (WhatsApp)</strong>: when you message us on WhatsApp, your messages are handled under
            WhatsApp&apos;s terms and privacy policy.
          </li>
          <li>
            <strong>Google and Meta advertising and analytics tools</strong>: only if you allowed Analytics or Marketing
            cookies. See the Cookie Policy.
          </li>
          <li>
            <strong>Our staff and riders</strong>: the details needed to collect, process and deliver your order.
          </li>
        </ul>
        <p>
          We may also share information if the law requires it, to protect our rights or the safety of others, or as part
          of a sale or reorganisation of the business, in which case this policy would continue to apply.
        </p>
        <p>
          Some of these providers process information on servers outside Bangladesh. Where they do, we use established
          providers that protect data with appropriate security and contractual safeguards.
        </p>
      </>
    ),
  },
  {
    id: "retention",
    title: "How long we keep it",
    body: (
      <>
        <ul>
          <li>
            <strong>Bookings, quotes, orders and related messages</strong>: for as long as we need them to provide the
            service, deal with questions or claims about an order, and meet our accounting and legal obligations. After
            that they are deleted or anonymised.
          </li>
          <li>
            <strong>Website analytics events</strong> (random identifiers, no names or phone numbers): 90 days, after
            which only daily totals remain, kept for 25 months.
          </li>
          <li>
            <strong>Cookie choices</strong>: the choice cookie in your browser lasts 6 months. Our anonymous record of
            accept and reject counts is kept for 13 months.
          </li>
          <li>
            <strong>The analytics visitor cookie</strong>, if you allowed Analytics: 13 months.
          </li>
          <li>
            <strong>Campaign details for a visit</strong>: stored only in your browser tab, and removed when you close it.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: "security",
    title: "How we protect it",
    body: (
      <>
        <p>
          The website is served only over encrypted connections (HTTPS). Customer and order records are reached only
          through our own server, never directly from your browser, and access to them is limited to people who need it.
          Forms and order tracking are protected against automated abuse and repeated guessing.
        </p>
        <p>
          No system can be guaranteed completely secure. If we become aware of a breach that puts your information at
          risk, we will act promptly to contain it and tell you where appropriate.
        </p>
      </>
    ),
  },
  {
    id: "rights",
    title: "Your choices and rights",
    body: (
      <>
        <p>You can ask us to:</p>
        <ul>
          <li>tell you what personal information we hold about you and give you a copy;</li>
          <li>correct information that is wrong or incomplete;</li>
          <li>
            delete your information, where we don&apos;t need to keep it for an open order, a claim or a legal obligation;
          </li>
          <li>stop using your information for a particular purpose, such as marketing messages;</li>
          <li>withdraw a consent you gave, including your cookie choice, at any time.</li>
        </ul>
        <p>
          To make a request, contact us using the details in section 11. We may need to confirm it&apos;s you, for
          example by asking you to message us from the phone number on your orders. We will respond as soon as we can,
          and within a reasonable time. Making a request is free.
        </p>
        <p>
          You can change your cookie choice at any time from <strong>Cookie settings</strong> in the website footer or on
          the <Link href="/cookies">Cookie Policy</Link> page.
        </p>
      </>
    ),
  },
  {
    id: "children",
    title: "Children",
    body: (
      <p>
        Our services are arranged with adults. The website is not intended for children, and we do not knowingly collect
        personal information from anyone under 18. If you believe a child has sent us their details, please contact us
        and we will delete them.
      </p>
    ),
  },
  {
    id: "changes",
    title: "Changes to this policy",
    body: (
      <p>
        We will update this policy when the way we handle information changes, for example if we add a new service
        provider or a customer account area. The &ldquo;Last updated&rdquo; date at the top shows the latest version.
        If a change significantly affects how we use information you have already given us, we will tell you.
      </p>
    ),
  },
  {
    id: "contact",
    title: "Contact us about privacy",
    body: <LegalContact />,
  },
];

export default function PrivacyPage() {
  return (
    <LegalDocument
      label="Legal"
      title="Privacy Policy"
      intro={
        <p>
          To collect, clean and return your clothes we need a few personal details, such as your name, phone number and
          address. This policy explains exactly what we collect, why, who sees it, how long we keep it and the choices you
          have.
        </p>
      }
      summary={[
        <>We collect what we need to arrange and deliver your order: name, phone, address, items and preferences.</>,
        <>We never sell your information, and we never put your name or phone number into website analytics.</>,
        <>Analytics and advertising tools run only if you allow them in the cookie banner.</>,
        <>Photos for quotes are not uploaded through the website. You choose whether to send them on WhatsApp.</>,
        <>You can ask to see, correct or delete your information at any time.</>,
      ]}
      sections={SECTIONS}
    />
  );
}
