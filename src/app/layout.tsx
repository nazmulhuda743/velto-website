import type { Metadata, Viewport } from "next";
import { Instrument_Sans, Source_Serif_4 } from "next/font/google";
import { SITE_URL } from "@/lib/seo/site";
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

const title = "Laundry & Dry Cleaning in Uttara with Pickup | Velto";
const description =
  "Laundry, dry cleaning and ironing in Uttara, Dhaka. Pickup from your door across Sectors 1–18, every item tagged and checked. Free pickup on ৳499+.";

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
    card: "summary_large_image",
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
