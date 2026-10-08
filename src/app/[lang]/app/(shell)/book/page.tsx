import { AppScreen } from "@/components/app/AppScreen";
import { AppBookView } from "@/components/app/book/AppBookView";
import { AppHeader } from "@/components/pwa/AppHeader";
import { PricesButton } from "@/components/app/prices/PricesButton";
import { popularPrices, pricesText } from "@/components/app/prices/data";
import { formText } from "@/content/i18n/forms";
import { getLocale } from "@/lib/i18n/server";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** Book from the app: the last order as a summary, each row opening a sheet (design "Book"). */
export default async function AppBook({ searchParams }: { searchParams: SearchParams }) {
  const locale = await getLocale();
  const f = formText(locale).common;
  const t = f.appBar;
  return (
    <AppScreen header={<AppHeader actions={<PricesButton label={t.prices} close={f.app.close} book={f.app.bookPickup} popular={await popularPrices()} t={pricesText(locale)} locale={locale} />} />}>
      <AppBookView params={await searchParams} />
    </AppScreen>
  );
}
