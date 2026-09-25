import { Instrument_Sans, Noto_Sans_Bengali, Source_Serif_4 } from "next/font/google";

export const instrumentSans = Instrument_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-instrument-sans",
  display: "swap",
});

export const sourceSerif = Source_Serif_4({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-source-serif",
  display: "swap",
});

/**
 * Bangla glyphs (Instrument Sans has none). The browser only downloads it for text
 * that needs it (unicode-range), so English pages don't pay for it; not preloaded.
 */
export const notoBengali = Noto_Sans_Bengali({
  subsets: ["bengali"],
  weight: ["400", "500", "600"],
  variable: "--font-bengali",
  display: "swap",
  preload: false,
});

export const fontVariables = `${instrumentSans.variable} ${sourceSerif.variable} ${notoBengali.variable}`;
