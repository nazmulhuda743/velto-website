import "server-only";

import { PricingConfigurationError } from "./errors";
import { createSupabasePricingSource } from "./supabase-rest";
import type { PricingSource } from "./types";

let source: PricingSource | undefined;

export const isPricingConfigured = () =>
  Boolean(process.env.VELTO_SUPABASE_URL && process.env.VELTO_SUPABASE_SECRET_KEY);

export function getPricingSource(): PricingSource {
  if (source) return source;

  const url = process.env.VELTO_SUPABASE_URL;
  const secretKey = process.env.VELTO_SUPABASE_SECRET_KEY;
  if (!url || !secretKey) {
    throw new PricingConfigurationError(
      "Server pricing integration is not configured",
    );
  }

  source = createSupabasePricingSource({
    url,
    secretKey,
    view: process.env.VELTO_PRICING_VIEW,
  });
  return source;
}
