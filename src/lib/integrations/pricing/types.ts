export type PublicPriceService = {
  slug: string;
  name: string;
  /** Integer minor units; null means the price requires confirmation. */
  amountMinor: number | null;
  currency: "BDT";
  unitLabel: string | null;
};

/** The complete and intentionally narrow pricing shape available to the UI. */
export type PublicPriceItem = {
  slug: string;
  name: string;
  services: PublicPriceService[];
};

export type PriceSearch = {
  query: string;
  limit?: number;
};

/** Exact item-name lookup, returned in the order requested; unknown names are skipped. */
export type PriceLookup = {
  names: string[];
  /** Cache the upstream response for this many seconds instead of fetching per request. */
  revalidateSeconds?: number;
};

export interface PricingSource {
  search(input: PriceSearch): Promise<PublicPriceItem[]>;
  getItems(input: PriceLookup): Promise<PublicPriceItem[]>;
}
