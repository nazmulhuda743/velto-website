import type { Metadata, Viewport } from "next";
import { Instrument_Sans, Source_Serif_4 } from "next/font/google";
import { Analytics } from "@/components/layout/Analytics";
import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/Header";
import { TrackingScripts } from "@/components/layout/TrackingScripts";
import { JsonLd } from "@/components/seo/JsonLd";
import { Logo } from "@/components/ui/Logo";
import {
  DEFAULT_DESCRIPTION,
  DEFAULT_TITLE,
  SITE_NAME,
  SITE_URL,
} from "@/lib/seo/site";
import { ORGANIZATION_SCHEMA, WEBSITE_SCHEMA } from "@/lib/seo/schema";
import "./globals.css";

const instrumentSans = Instrument_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-instrument-sans",
  display: "swap",
});

const sourceSerif = Source_Serif_4({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-source-serif",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  applicationName: SITE_NAME,
  title: {
    default: DEFAULT_TITLE,
    template: `%s | ${SITE_NAME}`,
  },
  description: DEFAULT_DESCRIPTION,
  openGraph: {
    type: "website",
    locale: "en_BD",
    url: SITE_URL,
    siteName: SITE_NAME,
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
  },
  twitter: {
    card: "summary",
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
  },
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${instrumentSans.variable} ${sourceSerif.variable}`}>
      <body>
        <TrackingScripts />
        <JsonLd data={[WEBSITE_SCHEMA, ORGANIZATION_SCHEMA]} />
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-md focus:bg-navy focus:px-4 focus:py-3 focus:text-white"
        >
          Skip to content
        </a>
        <Header logo={<Logo className="h-9 lg:h-11" priority />} />
        <main id="main">{children}</main>
        <Footer />
        <Analytics />
      </body>
    </html>
  );
}
