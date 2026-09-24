import type { Metadata, Viewport } from "next";
import { Instrument_Sans, Source_Serif_4 } from "next/font/google";
import { SITE_URL } from "@/lib/site-url";
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

const title = "Velto Premium Laundry — Laundry & dry cleaning in Uttara";
const description =
  "Laundry and dry cleaning in Uttara, with pickup from your door. We collect across Uttara Sectors 1–18.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  applicationName: "Velto Premium Laundry",
  title,
  description,
  openGraph: {
    type: "website",
    locale: "en_BD",
    url: SITE_URL,
    siteName: "Velto Premium Laundry",
    title,
    description,
  },
  twitter: {
    card: "summary",
    title,
    description,
  },
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${instrumentSans.variable} ${sourceSerif.variable}`}>
      <body>{children}</body>
    </html>
  );
}
