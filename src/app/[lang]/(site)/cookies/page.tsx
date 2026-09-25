import type { Metadata } from "next";
import Link from "@/components/i18n/Link";
import { CookieSettingsButton } from "@/components/consent/CookieSettingsButton";
import { LegalContact, LegalDocument, type LegalSection } from "@/components/legal/LegalDocument";
import { alternatesFor } from "@/lib/seo/page-metadata";

const baseMetadata: Metadata = {
  title: "Cookie Policy | Velto Premium Laundry",
  description: "Which cookies and browser storage the Velto website uses, what each one does, how long it lasts and how to change your choice.",
  robots: { index: false, follow: true },
};

export async function generateMetadata(): Promise<Metadata> {
  return { ...baseMetadata, alternates: await alternatesFor("/cookies") };
}

type Row = { name: string; purpose: string; duration: string; setBy: string };

/* Keep in step with src/lib/consent.ts, src/lib/analytics/client.ts, src/lib/attribution-client.ts and src/lib/admin. */
const ESSENTIAL: Row[] = [
  {
    name: "velto_consent_v1",
    purpose:
      "Remembers your cookie choice (Analytics on or off, Marketing on or off, and when you chose) so the banner doesn't appear on every page. Holds no identifier and no personal information.",
    duration: "6 months",
    setBy: "Velto",
  },
  {
    name: "velto_attribution (tab storage)",
    purpose:
      "Keeps the campaign details of the link you arrived from (for example utm_campaign) and the name of the website that sent you, for this browser tab, so a booking or quote can say which campaign led to it. Advertising click identifiers are only sent onward if you allow Marketing.",
    duration: "Until the tab is closed",
    setBy: "Velto",
  },
  {
    name: "velto_admin, velto_admin_seen",
    purpose: "Sign Velto staff into the website dashboard and remember which dashboard notifications they have seen. Never set for customers.",
    duration: "12 hours / 90 days",
    setBy: "Velto",
  },
];

const ANALYTICS: Row[] = [
  {
    name: "velto_vid",
    purpose:
      "A random identifier that lets Velto count returning visitors in its own anonymous website measurement. If you later book or request a quote, the visit is connected to that request so Velto can see which campaigns bring customers.",
    duration: "13 months",
    setBy: "Velto",
  },
  {
    name: "velto_session (tab storage)",
    purpose: "Groups the pages viewed in one visit. A visit ends after 30 minutes without activity.",
    duration: "Until the tab is closed",
    setBy: "Velto",
  },
  {
    name: "_ga, _ga_*",
    purpose: "Google Analytics, when Velto has it switched on, to measure website use.",
    duration: "Up to 2 years, set by Google",
    setBy: "Google",
  },
];

const MARKETING: Row[] = [
  {
    name: "_fbp, _fbc",
    purpose: "Meta Pixel, when Velto has it switched on, to measure which Facebook and Instagram ads lead to bookings.",
    duration: "Up to 3 months, set by Meta",
    setBy: "Meta",
  },
];

function CookieTable({ rows, caption }: { rows: Row[]; caption: string }) {
  return (
    <table className="mt-5 w-full border-collapse text-left">
      <caption className="sr-only">{caption}</caption>
      <thead className="hidden md:table-header-group">
        <tr className="border-b border-navy">
          <th scope="col" className="w-[220px] pb-3 pr-6 t-label uppercase text-navy">
            Name
          </th>
          <th scope="col" className="pb-3 t-label uppercase text-navy">
            Purpose, duration and provider
          </th>
        </tr>
      </thead>
      <tbody className="border-t border-line md:border-t-0">
        {rows.map((r) => (
          <tr key={r.name} className="block border-b border-line py-4 md:table-row md:py-0">
            <th scope="row" className="block pb-1 text-left font-semibold text-navy [overflow-wrap:anywhere] md:table-cell md:py-4 md:pr-6 md:align-top">
              {r.name}
            </th>
            <td className="block md:table-cell md:py-4 md:align-top">
              <p>{r.purpose}</p>
              <p className="mt-1 t-small text-secondary">
                {r.duration} · {r.setBy}
              </p>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

const SECTIONS: LegalSection[] = [
  {
    id: "what",
    title: "What cookies are",
    body: (
      <>
        <p>
          Cookies are small text files that a website stores in your browser. &ldquo;Tab storage&rdquo; (session storage)
          is similar, but is kept only for the browser tab you are using and is removed when you close it. In this policy,
          &ldquo;cookies&rdquo; covers both.
        </p>
        <p>
          Cookies set by Velto are <strong>first-party</strong> cookies. Cookies set by Google or Meta are{" "}
          <strong>third-party</strong> cookies. They are used only in the categories you allow.
        </p>
      </>
    ),
  },
  {
    id: "choice",
    title: "Your choice comes first",
    body: (
      <>
        <p>
          On your first visit the website asks before it uses anything that isn&apos;t essential. Until you choose, only
          essential cookies are used. Google Tag Manager, Google Analytics and Meta Pixel are not loaded, and Velto&apos;s
          own website measurement records nothing about your visit.
        </p>
        <p>
          You can accept all, reject everything that isn&apos;t essential, or choose Analytics and Marketing separately in
          Manage preferences. Rejecting is as easy as accepting, and rejecting doesn&apos;t stop you using any part of the
          website.
        </p>
        <p>
          Your choice is kept for six months, or until we change what the categories cover. After that, you are asked
          again.
        </p>
      </>
    ),
  },
  {
    id: "essential",
    title: "Essential cookies",
    body: (
      <>
        <p>
          Always on. The website needs these for security, for its forms and to remember your choice. They are not used to
          track you.
        </p>
        <CookieTable rows={ESSENTIAL} caption="Essential cookies" />
      </>
    ),
  },
  {
    id: "analytics",
    title: "Analytics cookies",
    body: (
      <>
        <p>
          Only with your permission. Velto measures which pages and services are viewed, price searches, where visits
          start and end, and whether a booking or quote was completed. This measurement uses random identifiers. It does
          not record your name, phone number, address, what you type into forms, or your IP address. Raw measurement
          events are deleted after 90 days.
        </p>
        <CookieTable rows={ANALYTICS} caption="Analytics cookies" />
      </>
    ),
  },
  {
    id: "marketing",
    title: "Marketing cookies",
    body: (
      <>
        <p>
          Only with your permission. Advertising measurement shows Velto which Facebook and Instagram ads lead to real
          enquiries, and may be used to show you relevant Velto ads. With Marketing allowed, an advertising click
          identifier from the ad you clicked can also travel with your booking or quote. Meta handles this information under
          its own terms.
        </p>
        <CookieTable rows={MARKETING} caption="Marketing cookies" />
      </>
    ),
  },
  {
    id: "consent-mode",
    title: "How Google and Meta tools respect your choice",
    body: (
      <>
        <p>
          Velto uses Google Tag Manager to manage Google Analytics and Meta Pixel. Tag Manager itself is loaded only after
          you allow Analytics or Marketing.
        </p>
        <p>
          The website also sends Google Consent Mode signals: before you choose, analytics and advertising storage are set
          to &ldquo;denied&rdquo;, and they change to &ldquo;granted&rdquo; only for the categories you allow. For example,
          if you allow Analytics but not Marketing, advertising storage stays denied.
        </p>
        <p>
          How Google and Meta use information is set out in their own policies:{" "}
          <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">
            Google Privacy Policy
          </a>{" "}
          and{" "}
          <a href="https://www.facebook.com/privacy/policy" target="_blank" rel="noopener noreferrer">
            Meta Privacy Policy
          </a>
          .
        </p>
      </>
    ),
  },
  {
    id: "change",
    title: "Changing your mind",
    body: (
      <>
        <p>
          Use <strong>Cookie settings</strong> in the website footer, or the button at the top of this page, at any time.
          If you switch Analytics or Marketing off, the website stops using them straight away and removes the cookies it
          can remove from this site.
        </p>
        <p>
          You can also block or delete cookies in your browser settings. Blocking essential cookies may stop the forms
          from working properly, and the website will ask for your choice again.
        </p>
      </>
    ),
  },
  {
    id: "records",
    title: "Records of your choice",
    body: (
      <p>
        To show that the banner works fairly, Velto counts how many visitors accept, reject or save custom choices. These
        counts are anonymous, with no visitor identifier attached, and are kept for 13 months.
      </p>
    ),
  },
  {
    id: "updates",
    title: "Changes to this policy",
    body: (
      <p>
        We update this policy when the website starts or stops using a cookie. If we change what a category covers, we ask
        for your choice again. The &ldquo;Last updated&rdquo; date at the top shows the latest version. For how booking and
        quote details are handled, see our <Link href="/privacy">Privacy Policy</Link>.
      </p>
    ),
  },
  {
    id: "contact",
    title: "Contact us",
    body: <LegalContact />,
  },
];

export default function CookiesPage() {
  return (
    <LegalDocument
      label="Legal"
      title="Cookie Policy"
      intro={
        <p>
          This policy lists every cookie and similar storage the Velto website uses, what each one does and how long it
          lasts, and how to change your choice at any time.
        </p>
      }
      summary={[
        <>Only essential cookies run until you make a choice.</>,
        <>Analytics and Marketing are separate choices, and rejecting them never limits what you can do on the site.</>,
        <>Velto&apos;s own measurement never records your name, phone number, form answers or IP address.</>,
        <>You can change your choice at any time from Cookie settings in the footer.</>,
      ]}
      sections={SECTIONS}
    >
      <CookieSettingsButton className="inline-flex h-12 items-center justify-center rounded-md border border-navy bg-white px-6 font-semibold text-navy hover:bg-soft">
        Change cookie settings
      </CookieSettingsButton>
    </LegalDocument>
  );
}
