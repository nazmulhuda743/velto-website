export class PricingConfigurationError extends Error {
  readonly code = "PRICING_CONFIGURATION_ERROR";

  constructor(message: string) {
    super(message);
    this.name = "PricingConfigurationError";
  }
}

export class PricingUpstreamError extends Error {
  readonly code = "PRICING_UPSTREAM_ERROR";

  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "PricingUpstreamError";
  }
}
