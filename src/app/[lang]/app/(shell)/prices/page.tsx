import { PopularPrices } from "@/components/home/PopularPrices";
import { PriceFinder } from "@/components/home/PriceFinder";
import { formText } from "@/content/i18n/forms";
import { getLocale } from "@/lib/i18n/server";

/** Prices in the app: the same price search and popular prices as the website, booking into the app. */
export default async function AppPrices() {
  const t = formText(await getLocale()).common.appBar;
  return (
    <div className="space-y-5">
      <header>
        <h1 className="t-h1 text-navy">{t.pricesTitle}</h1>
        <p className="mt-1.5 text-body">{t.pricesIntro}</p>
      </header>
      <PriceFinder bookFromResult={{ source: "app-prices", bookPath: "/app/book" }} popular={<PopularPrices source="app_popular" placement="app_popular_price" bookPath="/app/book" />} />
    </div>
  );
}
