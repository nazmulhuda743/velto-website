import { dictionary } from "@/content/i18n";
import { localDigits, localizeHref } from "@/lib/i18n/config";
import { getLocale } from "@/lib/i18n/server";
import { formatAmount } from "@/lib/format-price";
import { getServicePrices } from "@/lib/service-prices";
import { POPULAR_PRICE_ITEMS, pickPopularItems } from "@/lib/popular-prices";

/** Column order: the services most items have, cheapest finish first. */
const COLUMNS = ["wash-and-iron", "ironing", "dry-cleaning"];

/**
 * Popular everyday prices, shown by the price finder while its search is empty (home and
 * /pricing); typing replaces them with the search results. Every amount comes from the live
 * Velto Ops price list; when it can't be read, nothing is shown and the search stands alone.
 * Each price books that service.
 */
export async function PopularPrices({ source, placement }: { source: string; placement: string }) {
  const prices = await getServicePrices(POPULAR_PRICE_ITEMS);
  if (prices.state !== "live") return null;
  const locale = await getLocale();
  const d = dictionary(locale);
  const t = d.home.findPrice;
  const rows = pickPopularItems(prices.items);
  if (!rows.length) return null;
  const cell = "px-2 py-1.5 first:pl-0 last:pr-0 md:px-3 md:py-3";
  return (
    <div data-popular-prices>
      <p id={`${placement}-title`} className="t-label uppercase text-navy">
        {t.popularTitle}
      </p>
      <table aria-labelledby={`${placement}-title`} className="mt-3 w-full border-t border-navy text-left">
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
                      href={localizeHref(`/book?${new URLSearchParams({ service: slug, source }).toString()}`, locale)}
                      data-analytics="book_pickup_click"
                      data-placement={placement}
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
