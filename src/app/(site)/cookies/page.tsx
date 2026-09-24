import type { Metadata } from "next";
import Link from "next/link";
import { CookieSettingsButton } from "@/components/consent/CookieSettingsButton";

export const metadata: Metadata = {
  title: "Cookies | Velto Premium Laundry",
  description: "Which cookies and browser storage the Velto website uses, and how to change your choice.",
  alternates: { canonical: "/cookies" },
  robots: { index: false, follow: true },
};

type Row = { name: string; purpose: string; duration: string; setBy: string };

const ESSENTIAL: Row[] = [
  {
    name: "velto_consent_v1",
    purpose: "Remembers your cookie choice so the banner does not appear on every page.",
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
    name: "velto_admin",
    purpose: "Signs Velto staff into the website dashboard. Not set for customers.",
    duration: "12 hours",
    setBy: "Velto",
  },
];

const ANALYTICS: Row[] = [
  {
    name: "velto_vid",
    purpose: "A random identifier that lets Velto count returning visitors in its own anonymous website measurement.",
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
    duration: "Set by Google",
    setBy: "Google",
  },
];

const MARKETING: Row[] = [
  {
    name: "_fbp, _fbc",
    purpose: "Meta Pixel, when Velto has it switched on, to measure which Facebook and Instagram ads lead to bookings.",
    duration: "Set by Meta",
    setBy: "Meta",
  },
];

function CookieTable({ rows }: { rows: Row[] }) {
  return (
    <div className="mt-4 border-t border-line">
      {rows.map((r) => (
        <div key={r.name} className="grid gap-1 border-b border-line py-4 md:grid-cols-[220px_1fr] md:gap-6">
          <p className="font-semibold text-navy [overflow-wrap:anywhere]">{r.name}</p>
          <div>
            <p>{r.purpose}</p>
            <p className="mt-1 t-small text-secondary">
              {r.duration} · {r.setBy}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function CookiesPage() {
  return (
    <article className="container-page py-16 md:py-24">
      <div className="max-w-3xl">
        <p className="t-label uppercase text-blue">Cookies</p>
        <h1 className="mt-3 t-h1 text-navy">Cookies on the Velto website</h1>
        <p className="mt-4 t-body-lg text-body">Last updated: 24 September 2026</p>

        <div className="mt-10 space-y-12 text-body">
          <section>
            <h2 className="t-h3 text-navy">Your choice</h2>
            <p className="mt-3">
              When you first visit, the website asks before it uses anything that isn&apos;t essential. Until you choose,
              only essential cookies are used: Google Tag Manager, Google Analytics and Meta Pixel are not loaded, and
              Velto&apos;s own website measurement records nothing about your visit.
            </p>
            <p className="mt-3">
              You can accept all, reject everything that isn&apos;t essential, or choose category by category. Your
              choice is kept for six months, or until Velto changes what the categories cover, and then you are asked
              again.
            </p>
            <CookieSettingsButton className="mt-5 inline-flex h-12 items-center justify-center rounded-md border border-navy bg-white px-6 font-semibold text-navy hover:bg-soft">
              Change cookie settings
            </CookieSettingsButton>
          </section>

          <section>
            <h2 className="t-h3 text-navy">Essential</h2>
            <p className="mt-3">Always on. The website needs these for security, its forms and remembering your choice.</p>
            <CookieTable rows={ESSENTIAL} />
          </section>

          <section>
            <h2 className="t-h3 text-navy">Analytics</h2>
            <p className="mt-3">
              Only with your permission. Velto measures which pages and services are viewed, price searches, where
              visits start and end, and whether a booking or quote was completed. This measurement uses random
              identifiers. It does not record your name, phone number, address, what you type into forms, or your IP
              address.
            </p>
            <CookieTable rows={ANALYTICS} />
          </section>

          <section>
            <h2 className="t-h3 text-navy">Marketing</h2>
            <p className="mt-3">
              Only with your permission. Advertising measurement shows Velto which Facebook and Instagram ads lead to
              real enquiries, and may be used to show you relevant Velto ads. Meta handles this information under its
              own terms.
            </p>
            <CookieTable rows={MARKETING} />
          </section>

          <section>
            <h2 className="t-h3 text-navy">Changing your mind</h2>
            <p className="mt-3">
              Use Cookie settings in the website footer at any time. If you switch Analytics or Marketing off, the
              website stops using them straight away and removes the cookies it can remove from this site. You can also
              clear cookies in your browser settings.
            </p>
            <p className="mt-3">
              For how booking and quote details are handled, see the{" "}
              <Link href="/privacy" className="font-medium text-navy underline underline-offset-4">
                privacy page
              </Link>
              .
            </p>
          </section>
        </div>
      </div>
    </article>
  );
}
