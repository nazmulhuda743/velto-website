import type { ReactNode } from "react";
import { WhatsAppButton } from "@/components/ui/Button";
import { TextLink } from "@/components/ui/TextLink";
import type { PriceColumn } from "@/content/services";
import { WHATSAPP_URL } from "@/content/site";
import { formatAmount } from "@/lib/format-price";
import type { PublicPriceService } from "@/lib/integrations/pricing/types";
import { getServicePrices } from "@/lib/service-prices";

export const COLUMN_LABEL: Record<PriceColumn, string> = {
  "dry-cleaning": "Dry Cleaning",
  "wash-and-iron": "Wash & Iron",
  ironing: "Ironing",
};

/** "Curtain Heavy (per sqft)" → "Curtain Heavy"; the unit is shown with the price. */
const displayName = (name: string) => name.replace(/\s*\(per sq ?ft\)$/i, "");

function Price({ service }: { service: PublicPriceService | undefined }) {
  if (!service) {
    return (
      <span className="text-muted">
        <span aria-hidden="true">—</span>
        <span className="sr-only">Not offered</span>
      </span>
    );
  }
  if (service.amountMinor === null) {
    return <span className="t-small font-medium text-secondary">After assessment</span>;
  }
  return (
    <span className="whitespace-nowrap font-semibold tabular-nums text-navy">
      {formatAmount(service.amountMinor)}
      {service.unitLabel ? <span className="ml-1 t-small font-normal text-secondary">{service.unitLabel}</span> : null}
    </span>
  );
}

/**
 * Featured live prices for a service page (one request to the public pricing
 * view, cached briefly). Single-service tables stay two-column at every
 * width; multi-service tables become labelled stacks on mobile.
 */
export async function ServicePriceTable({
  caption,
  columns,
  groups,
  footer,
}: {
  caption: string;
  columns: PriceColumn[];
  groups: { label: string; names: string[] }[];
  /** Shown under the table only when prices loaded. */
  footer?: ReactNode;
}) {
  const prices = await getServicePrices(groups.flatMap((g) => g.names));

  if (prices.state === "unavailable") {
    return (
      <div role="status" className="border-t border-navy pt-6">
        <p className="t-h4 text-navy">Prices couldn&apos;t load right now.</p>
        <p className="mt-2 max-w-[46ch] text-secondary">
          Search the full price list or ask Velto on WhatsApp. You can also book a pickup: we go
          through prices when we call to confirm.
        </p>
        <div className="mt-5 flex flex-col items-start gap-3 md:flex-row md:items-center md:gap-6">
          <TextLink href="/pricing" placement="service_prices_error">
            Search the price list
          </TextLink>
          <WhatsAppButton href={WHATSAPP_URL} placement="service_prices_error" />
        </div>
      </div>
    );
  }

  const byName = new Map(prices.items.map((item) => [item.name, item]));
  const multi = columns.length > 1;
  const showGroupLabels = groups.length > 1;
  const rowGrid = multi ? "md:table-row" : "table-row";
  const cellCls = multi
    ? "flex items-baseline justify-between gap-4 py-1.5 md:table-cell md:py-3.5 md:pl-4 md:text-right md:align-baseline max-md:before:content-[attr(data-label)] max-md:before:text-body"
    : "py-3.5 pl-4 text-right align-baseline";

  return (
    <>
      <table className="w-full border-collapse text-left">
        <caption className="sr-only">{caption}</caption>
        <thead className={multi ? "hidden md:table-header-group" : undefined}>
          <tr className="border-b border-navy">
            <th scope="col" className="pb-3 t-label uppercase text-navy">
              Item
            </th>
            {columns.map((c) => (
              <th key={c} scope="col" className="pb-3 pl-4 text-right t-label uppercase text-navy">
                {COLUMN_LABEL[c]}
              </th>
            ))}
          </tr>
        </thead>
        {groups.map((group) => {
          const items = group.names.flatMap((n) => byName.get(n) ?? []);
          if (!items.length) return null;
          return (
            <tbody key={group.label} className={multi ? "max-md:block" : undefined}>
              {showGroupLabels ? (
                <tr className={multi ? "max-md:block md:table-row" : undefined}>
                  <th
                    scope="colgroup"
                    colSpan={columns.length + 1}
                    className={`${multi ? "max-md:block max-md:border-t max-md:border-navy" : ""} pb-2 pt-7 text-left t-caption font-semibold uppercase tracking-[0.04em] text-secondary`}
                  >
                    {group.label}
                  </th>
                </tr>
              ) : null}
              {items.map((item) => {
                const bySlug = new Map(item.services.map((s) => [s.slug, s]));
                return (
                  <tr key={item.slug} className={`border-t border-line ${multi ? "max-md:block max-md:py-3" : ""} ${rowGrid}`}>
                    <th
                      scope="row"
                      className={`text-left font-normal text-body ${multi ? "max-md:block max-md:pb-1 max-md:font-semibold max-md:text-navy md:table-cell md:py-3.5" : "py-3.5"}`}
                    >
                      {displayName(item.name)}
                    </th>
                    {columns.map((c) => (
                      <td key={c} data-label={COLUMN_LABEL[c]} className={cellCls}>
                        <Price service={bySlug.get(c)} />
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          );
        })}
      </table>
      {prices.items.some((item) => item.services.some((sv) => columns.includes(sv.slug as PriceColumn) && sv.amountMinor === null)) ? (
        <p className="mt-4 t-small text-secondary">
          &ldquo;After assessment&rdquo; means the price is confirmed once Velto has seen the item.
        </p>
      ) : null}
      {footer}
    </>
  );
}

export function ServicePriceTableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div role="status" aria-label="Loading prices" className="border-t border-navy">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center justify-between border-b border-line py-[18px]">
          <span className="skeleton h-4 w-40" />
          <span className="skeleton h-4 w-16" />
        </div>
      ))}
    </div>
  );
}
