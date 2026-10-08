import { headers } from "next/headers";
import { B999Footer, B999Header } from "@/components/b999/B999Chrome";
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
import { LOCATIONS } from "@/content/site";
import { ORGANIZATION_SCHEMA, WEBSITE_SCHEMA, buildLaundryLocationSchema } from "@/lib/seo/schema";
import { dictionary } from "@/content/i18n";
import { getLocale } from "@/lib/i18n/server";
import { PATH_HEADER } from "@/lib/app-routes";
import { campaignPage } from "@/lib/promo";

/** Public website chrome. The admin panel has its own layout. */
export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const t = dictionary(locale).common;
  // A campaign landing page keeps the visitor on its one offer: slim header and footer, no menu.
  const campaign = campaignPage((await headers()).get(PATH_HEADER) ?? "");
  return (
    <>
      <TrackingScripts />
      <JsonLd data={[WEBSITE_SCHEMA, ORGANIZATION_SCHEMA, ...LOCATIONS.map(buildLaundryLocationSchema)]} />
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-md focus:bg-navy focus:px-4 focus:py-3 focus:text-white"
      >
        {t.skipToContent}
      </a>
      {campaign ? (
        <B999Header />
      ) : (
        <StickyTop>
          <AnnouncementBar />
          <Header logo={<Logo className="h-9 lg:h-11" priority />} accounts={customerAccountsEnabled()} />
        </StickyTop>
      )}
      <main id="main">{children}</main>
      {campaign ? <B999Footer /> : <Footer />}
      <Analytics />
      <ConsentManager />
      <CampaignPopup />
      {/* The installed app only: its own tab bar, and website pages sent to the account. */}
      <AppMode />
    </>
  );
}
