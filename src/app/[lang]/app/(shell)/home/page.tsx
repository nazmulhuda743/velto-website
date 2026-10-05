import { AccountHomeView } from "@/components/account/views/AccountHomeView";
import { AppScreen } from "@/components/app/AppScreen";
import { AppHeader, HeaderPill, HeaderWhatsApp } from "@/components/pwa/AppHeader";
import { formText } from "@/content/i18n/forms";
import { WHATSAPP_URL } from "@/content/site";
import { getLocale } from "@/lib/i18n/server";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** The app's Home: Prices and WhatsApp in the header, then the account home. */
export default async function AppHome({ searchParams }: { searchParams: SearchParams }) {
  const t = formText(await getLocale()).common.appBar;
  return (
    <AppScreen
      header={
        <AppHeader
          actions={
            <>
              <HeaderPill href="/app/prices">{t.prices}</HeaderPill>
              <HeaderWhatsApp href={WHATSAPP_URL} label={t.whatsapp} />
            </>
          }
        />
      }
    >
      <AccountHomeView params={await searchParams} base="/app" />
    </AppScreen>
  );
}
