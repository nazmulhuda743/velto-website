import { dictionary } from "@/content/i18n";
import { localDigits, localizeHref } from "@/lib/i18n/config";
import { getLocale } from "@/lib/i18n/server";
import { formatAmount } from "@/lib/format-price";
import { getServicePrices } from "@/lib/service-prices";

/** The everyday items most people ask about first, by their price-list names. */
const ITEMS = ["Shirt", "Pant", "Panjabi", "Sari (Cotton)"];
/** Column order: the services most items have, cheapest finish first. */
const COLUMNS = ["wash-and-iron", "ironing", "dry-cleaning"];

/**
 * Four everyday prices, visible without typing (the search below covers the rest). Every amount
 * comes from the live Velto Ops price list; when it can't be read, nothing is shown and the
 * search stands alone. Each price books that service.
 */
export async function PopularPrices() {
  const prices = await getServicePrices(ITEMS);
  if (prices.state !== "live") return null;
  const locale = await getLocale();
  const d = dictionary(locale);
  const t = d.home.findPrice;
  const rows = ITEMS.map((name) => prices.items.find((i) => i.name === name)).filter((i) => i !== undefined);
  if (rows.length < 2) return null;
  const cell = "px-2 py-1.5 first:pl-0 last:pr-0 md:px-3 md:py-3";
  return (
    <div data-popular-prices>
      <p className="t-label uppercase text-navy">{t.popularTitle}</p>
      <table className="mt-3 w-full border-t border-navy text-left">
        <thead>
          <tr className="border-b border-line">
            <th scope="col" className={`${cell} t-caption font-semibold text-secondary`}>
              {t.popularItem}
            </th>
            {COLUMNS.map((slug) => (
              <th key={slug} scope="col" className={`${cell} t-caption font-semibold text-secondary md:text-right`}>
                {d.serviceNames[slug] ?? slug}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((item) => (
            <tr key={item.slug} className="border-b border-line">
              {/* Item names come from the Ops price list and stay as they are. */}
              <th scope="row" className={`${cell} font-semibold text-navy`}>
                {item.name}
              </th>
              {COLUMNS.map((slug) => {
                const s = item.services.find((x) => x.slug === slug);
                if (!s || s.amountMinor === null) {
                  return (
                    <td key={slug} className={`${cell} text-secondary md:text-right`}>
                      <span aria-hidden="true">–</span>
                      <span className="sr-only">{s ? d.priceFinder.afterAssessment : t.popularNotOffered}</span>
                    </td>
                  );
                }
                const serviceName = d.serviceNames[slug] ?? s.name;
                return (
                  <td key={slug} className={`${cell} md:text-right`}>
                    <a
                      href={localizeHref(`/book?${new URLSearchParams({ service: slug, source: "home_popular" }).toString()}`, locale)}
                      data-analytics="book_pickup_click"
                      data-placement="home_popular_price"
                      data-service={slug}
                      className="inline-flex min-h-11 items-center rounded-sm text-[17px] font-semibold tabular-nums text-navy underline decoration-blue/50 underline-offset-4 hover:decoration-blue md:text-[18px]"
                    >
                      {localDigits(formatAmount(s.amountMinor), locale)}
                      <span className="sr-only">
                        {" "}
                        · {serviceName} · {item.name}
                      </span>
                    </a>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-3 t-small text-secondary">{t.popularNote}</p>
    </div>
  );
}
