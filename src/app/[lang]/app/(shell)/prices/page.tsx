import Link from "next/link";
import { AppScreen } from "@/components/app/AppScreen";
import { PricesPanel } from "@/components/app/prices/PricesPanel";
import { popularPrices, pricesText } from "@/components/app/prices/data";
import { buttonClass } from "@/components/app/ui";
import { formText } from "@/content/i18n/forms";
import { getLocale } from "@/lib/i18n/server";

/** Prices as a page, for links into the app (/app/prices); in the app itself it opens as a sheet. */
export default async function AppPrices() {
  const locale = await getLocale();
  const f = formText(locale).common;
  return (
    <AppScreen>
      <h1 className="a-title">{f.appBar.prices}</h1>
      <div className="mt-2">
        <PricesPanel popular={await popularPrices()} t={pricesText(locale)} locale={locale} />
      </div>
      <Link href="/app/book?source=app_prices" className={buttonClass("primary", "mt-5")}>
        {f.app.bookPickup}
      </Link>
    </AppScreen>
  );
}
