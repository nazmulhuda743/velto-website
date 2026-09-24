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

export interface PricingSource {
  search(input: PriceSearch): Promise<PublicPriceItem[]>;
}
