import "server-only";

import {
  PricingConfigurationError,
  PricingUpstreamError,
} from "./errors";
import type {
  PriceSearch,
  PricingSource,
} from "./types";
import { parsePublicPricingRows } from "./validation";

const DEFAULT_LIMIT = 5;
const MAX_LIMIT = 10;
const REQUEST_TIMEOUT_MS = 4_000;
const SAFE_IDENTIFIER = /^[a-z_][a-z0-9_]*$/;

export type SupabasePricingConfig = {
  url: string;
  secretKey: string;
  view?: string;
  fetch?: typeof globalThis.fetch;
};

function normalizeProjectUrl(value: string) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new PricingConfigurationError("VELTO_SUPABASE_URL must be a valid URL");
  }

  if (url.protocol !== "https:" && url.hostname !== "localhost") {
    throw new PricingConfigurationError("VELTO_SUPABASE_URL must use HTTPS");
  }

  return url.origin;
}

export function createSupabasePricingSource(
  config: SupabasePricingConfig,
): PricingSource {
  const view = config.view ?? "website_pricing_public";
  if (!SAFE_IDENTIFIER.test(view)) {
    throw new PricingConfigurationError("VELTO_PRICING_VIEW is not a safe identifier");
  }
  if (!config.secretKey.startsWith("sb_secret_")) {
    throw new PricingConfigurationError(
      "VELTO_SUPABASE_SECRET_KEY must use a current Supabase secret key",
    );
  }

  const origin = normalizeProjectUrl(config.url);
  const request = config.fetch ?? globalThis.fetch;

  return {
    async search({ query, limit = DEFAULT_LIMIT }: PriceSearch) {
      const normalized = query.trim().slice(0, 64);
      if (normalized.length < 2) return [];

      const resultLimit = Math.min(Math.max(Math.trunc(limit), 1), MAX_LIMIT);
      const url = new URL(`/rest/v1/${view}`, origin);
      url.searchParams.set(
        "select",
        "item_slug,item_name,service_slug,service_name,price_amount_minor,currency,unit_label",
      );
      url.searchParams.set("item_name", `ilike.*${normalized}*`);
      url.searchParams.set("order", "item_name.asc,service_name.asc");
      // The view has multiple service rows per item; leave enough room while
      // still bounding the response returned by the operational source.
      url.searchParams.set("limit", String(resultLimit * 8));

      let response: Response;
      try {
        response = await request(url, {
          headers: {
            apikey: config.secretKey,
            Authorization: `Bearer ${config.secretKey}`,
            Accept: "application/json",
          },
          cache: "no-store",
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        });
      } catch (error) {
        throw new PricingUpstreamError("Pricing source request failed", {
          cause: error,
        });
      }

      if (!response.ok) {
        throw new PricingUpstreamError(
          `Pricing source returned HTTP ${response.status}`,
        );
      }

      let payload: unknown;
      try {
        payload = await response.json();
      } catch (error) {
        throw new PricingUpstreamError("Pricing source returned invalid JSON", {
          cause: error,
        });
      }

      return parsePublicPricingRows(payload).slice(0, resultLimit);
    },
  };
}
