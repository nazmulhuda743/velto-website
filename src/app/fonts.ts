import localFont from "next/font/local";

/*
 * The site's fonts, served from the repository (src/assets/fonts, SIL Open Font License; the
 * Google Fonts subsets via Fontsource 5.3). Builds never download fonts, so a build can't fail
 * on a Google Fonts hiccup. Same families, weights, subsets and CSS variables as before.
 */

/** Google's "latin" subset: Instrument Sans and Source Serif carry no other glyphs. */
const LATIN =
  "U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD";

/** Google's "bengali" subset (includes the ৳ sign). */
const BENGALI =
  "U+0951-0952, U+0964-0965, U+0980-09FE, U+1CD0, U+1CD2, U+1CD5-1CD6, U+1CD8, U+1CE1, U+1CEA, U+1CED, U+1CF2, U+1CF5-1CF7, U+200C-200D, U+20B9, U+25CC, U+A8F1";

export const instrumentSans = localFont({
  src: [
    { path: "../assets/fonts/instrument-sans-latin-400.woff2", weight: "400", style: "normal" },
    { path: "../assets/fonts/instrument-sans-latin-500.woff2", weight: "500", style: "normal" },
    { path: "../assets/fonts/instrument-sans-latin-600.woff2", weight: "600", style: "normal" },
  ],
  variable: "--font-instrument-sans",
  display: "swap",
  declarations: [{ prop: "unicode-range", value: LATIN }],
});

export const sourceSerif = localFont({
  src: [{ path: "../assets/fonts/source-serif-4-latin-400.woff2", weight: "400", style: "normal" }],
  variable: "--font-source-serif",
  display: "swap",
  adjustFontFallback: "Times New Roman",
  declarations: [{ prop: "unicode-range", value: LATIN }],
});

/**
 * Bangla glyphs (Instrument Sans has none). The browser only downloads it for text
 * that needs it (unicode-range), so English pages don't pay for it; not preloaded.
 */
export const notoBengali = localFont({
  src: [
    { path: "../assets/fonts/noto-sans-bengali-400.woff2", weight: "400", style: "normal" },
    { path: "../assets/fonts/noto-sans-bengali-500.woff2", weight: "500", style: "normal" },
    { path: "../assets/fonts/noto-sans-bengali-600.woff2", weight: "600", style: "normal" },
  ],
  variable: "--font-bengali",
  display: "swap",
  preload: false,
  declarations: [{ prop: "unicode-range", value: BENGALI }],
});

export const fontVariables = `${instrumentSans.variable} ${sourceSerif.variable} ${notoBengali.variable}`;
