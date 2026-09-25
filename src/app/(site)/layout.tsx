import { ConsentManager } from "@/components/consent/ConsentManager";
import { Analytics } from "@/components/layout/Analytics";
import { AnnouncementBar } from "@/components/layout/AnnouncementBar";
import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/Header";
import { TrackingScripts } from "@/components/layout/TrackingScripts";
import { JsonLd } from "@/components/seo/JsonLd";
import { Logo } from "@/components/ui/Logo";
import { customerAccountsEnabled } from "@/lib/customer/config";
import { ORGANIZATION_SCHEMA, WEBSITE_SCHEMA } from "@/lib/seo/schema";

/** Public website chrome. The admin panel has its own layout. */
export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <TrackingScripts />
      <JsonLd data={[WEBSITE_SCHEMA, ORGANIZATION_SCHEMA]} />
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-md focus:bg-navy focus:px-4 focus:py-3 focus:text-white"
      >
        Skip to content
      </a>
      <AnnouncementBar />
      <Header logo={<Logo className="h-9 lg:h-11" priority />} accounts={customerAccountsEnabled()} />
      <main id="main">{children}</main>
      <Footer />
      <Analytics />
      <ConsentManager />
    </>
  );
}
