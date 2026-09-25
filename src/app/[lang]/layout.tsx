import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { LocaleProvider } from "@/components/i18n/LocaleProvider";
import { dictionary } from "@/content/i18n";
import { isLocale, LOCALES } from "@/lib/i18n/config";
import { SITE_URL } from "@/lib/seo/site";
import { fontVariables } from "../fonts";
import "../globals.css";

type Props = { children: React.ReactNode; params: Promise<{ lang: string }> };

/**
 * Both languages are prerendered. No dynamicParams = false here: it would also apply to
 * every nested segment and turn unknown pages into bare router 404s. The proxy only ever
 * produces /en or /bn, and anything else is refused below.
 */
export const generateStaticParams = () => LOCALES.map((lang) => ({ lang }));

export async function generateMetadata({ params }: Omit<Props, "children">): Promise<Metadata> {
  const { lang } = await params;
  const t = dictionary(isLocale(lang) ? lang : "en").meta;
  return {
    metadataBase: new URL(SITE_URL),
    applicationName: t.siteName,
    title: t.title,
    description: t.description,
    openGraph: {
      type: "website",
      locale: t.ogLocale,
      url: SITE_URL,
      siteName: t.siteName,
      title: t.title,
      description: t.description,
    },
    twitter: { card: "summary_large_image", title: t.title, description: t.description },
  };
}

export const viewport: Viewport = {
  themeColor: "#ffffff",
  viewportFit: "cover",
};

/** Root layout for the public website, in English (/...) or Bangla (/bn/...). */
export default async function LangRootLayout({ children, params }: Props) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  return (
    <html lang={lang} className={fontVariables}>
      <body>
        <LocaleProvider locale={lang}>{children}</LocaleProvider>
      </body>
    </html>
  );
}
