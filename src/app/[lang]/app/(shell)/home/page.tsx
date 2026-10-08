import { AppHomeView } from "@/components/app/home/AppHomeView";
import { AppScreen } from "@/components/app/AppScreen";
import { AppHeader, HeaderWhatsApp } from "@/components/pwa/AppHeader";
import { PricesButton } from "@/components/app/prices/PricesButton";
import { popularPrices, pricesText } from "@/components/app/prices/data";
import { formText } from "@/content/i18n/forms";
import { WHATSAPP_URL } from "@/content/site";
import { getLocale } from "@/lib/i18n/server";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** The app's Home: Prices and WhatsApp in the header, then one state card and recent orders. */
export default async function AppHome({ searchParams }: { searchParams: SearchParams }) {
  const locale = await getLocale();
  const f = formText(locale).common;
  const t = f.appBar;
  return (
    <AppScreen
      header={
        <AppHeader
          actions={
            <>
              <PricesButton label={t.prices} close={f.app.close} book={f.app.bookPickup} bookHref="/app/book" popular={await popularPrices()} t={pricesText(locale)} locale={locale} />
              <HeaderWhatsApp href={WHATSAPP_URL} label={t.whatsapp} />
            </>
          }
        />
      }
    >
      <AppHomeView params={await searchParams} />
    </AppScreen>
  );
}
