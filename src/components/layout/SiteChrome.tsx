import { ConsentManager } from "@/components/consent/ConsentManager";
import { Analytics } from "@/components/layout/Analytics";
import { AnnouncementBar } from "@/components/layout/AnnouncementBar";
import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/Header";
import { StickyTop } from "@/components/layout/StickyTop";
import { TrackingScripts } from "@/components/layout/TrackingScripts";
import { CampaignPopup } from "@/components/promo/CampaignPopup";
import { JsonLd } from "@/components/seo/JsonLd";
import { Logo } from "@/components/ui/Logo";
import { AppMode } from "@/components/pwa/AppMode";
import { customerAccountsEnabled } from "@/lib/customer/config";
import { LanguageSwitchToHome } from "@/components/i18n/LanguageSwitcher";
import { LOCATIONS } from "@/content/site";
import { ORGANIZATION_SCHEMA, WEBSITE_SCHEMA, buildLaundryLocationSchema } from "@/lib/seo/schema";
import { dictionary } from "@/content/i18n";
import { getLocale } from "@/lib/i18n/server";

/** Public website chrome (header, footer, consent, analytics). The chrome itself. On the 404 page (`notFound`) the language switch goes to the other language's homepage. */
export async function SiteChrome({ children, notFound = false }: { children: React.ReactNode; notFound?: boolean }) {
  const locale = await getLocale();
  const t = dictionary(locale).common;
  const chrome = (
    <>
      <TrackingScripts />
      <JsonLd data={[WEBSITE_SCHEMA, ORGANIZATION_SCHEMA, ...LOCATIONS.map(buildLaundryLocationSchema)]} />
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-md focus:bg-navy focus:px-4 focus:py-3 focus:text-white"
      >
        {t.skipToContent}
      </a>
      <StickyTop>
        <AnnouncementBar />
        <Header logo={<Logo className="h-9 lg:h-11" priority />} accounts={customerAccountsEnabled()} />
      </StickyTop>
      <main id="main">{children}</main>
      <Footer />
      <Analytics />
      <ConsentManager />
      <CampaignPopup />
      {/* The installed app only: its own tab bar, and website pages sent to the account. */}
      <AppMode />
    </>
  );
  return notFound ? <LanguageSwitchToHome>{chrome}</LanguageSwitchToHome> : chrome;
}
