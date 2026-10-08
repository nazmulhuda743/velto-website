import type { Metadata } from "next";
import { buttonClass, WhatsAppIcon } from "@/components/app/ui";
import { AppTabBar } from "@/components/pwa/AppTabBar";
import { Logo } from "@/components/ui/Logo";
import { formText } from "@/content/i18n/forms";
import { banglaEnabled, type Locale } from "@/lib/i18n/config";
import { getSiteContent } from "@/lib/site-content";

export const metadata: Metadata = { title: "Velto", robots: { index: false, follow: false } };

/** Before anything paints: the language the customer chose (velto_lang), as the app's pages use it. */
const PICK_LANGUAGE = `if(/(?:^|; )velto_lang=bn(?:;|$)/.test(document.cookie))document.documentElement.lang="bn";`;

/**
 * The app's offline screen. The service worker stores it when it installs and shows it in place of
 * any /app page the network can't reach (the pages themselves are never stored: orders, addresses
 * and prices are personal and live). Stored once for both languages, so it carries both and shows
 * the one the customer chose. The WhatsApp link goes straight to wa.me (/go/whatsapp needs the server).
 */
export default async function AppOffline() {
  const { settings } = await getSiteContent();
  const whatsapp = `https://wa.me/${settings.whatsappNumber}`;
  const langs: Locale[] = banglaEnabled() ? ["en", "bn"] : ["en"];
  return (
    <div className="min-h-dvh bg-warm pb-[calc(64px+env(safe-area-inset-bottom))]" data-app-entry data-app-offline>
      <script dangerouslySetInnerHTML={{ __html: PICK_LANGUAGE }} />
      <header className="pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex min-h-[60px] max-w-[720px] items-center px-5 pb-2 pt-4">
          <Logo className="h-[22px] w-auto" />
        </div>
      </header>
      {langs.map((lang) => {
        const c = formText(lang).common;
        const t = c.app;
        return (
          <div key={lang} lang={lang} data-offline-copy={lang}>
            <main className="mx-auto w-full max-w-[720px] px-5 pb-8 pt-2">
              <div className="rounded-xl bg-navy px-4 py-3 text-white">
                <p className="a-body font-semibold">{t.offlineTitle}</p>
                <p className="mt-1 a-sec text-white/85">{t.offlineBody}</p>
              </div>
              <div className="mt-5 rounded-2xl border border-dashed border-line-strong p-5">
                <p className="a-body font-semibold text-navy">{t.offlineCardTitle}</p>
                <p className="mt-1.5 a-sec text-muted">{t.offlineCardBody}</p>
              </div>
              {/* An empty href reloads the address the customer asked for. */}
              <a href="" className={buttonClass("secondary", "mt-4")}>
                {t.retry}
              </a>
              <a href={whatsapp} target="_blank" rel="noopener noreferrer" className={buttonClass("text", "mt-2 w-full gap-2")}>
                <WhatsAppIcon className="size-[18px] text-whatsapp" />
                {c.appBar.whatsapp}
              </a>
            </main>
            <AppTabBar t={c.appBar} />
          </div>
        );
      })}
    </div>
  );
}
