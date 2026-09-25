import { dictionary } from "@/content/i18n";
import { pageText } from "@/content/i18n/pages";
import { FREE_DELIVERY_THRESHOLD, LOCATIONS, SERVICE_SECTORS, USUAL_TURNAROUND_HOURS } from "@/content/site";
import { fill, localDigits } from "@/lib/i18n/config";
import { getLocale } from "@/lib/i18n/server";
import { getGoogleProof } from "@/lib/site-content";
import { RatingValue, type Figure } from "./ProofFigures";

/**
 * Shared proof figures in the page's language. Values come from site config only;
 * nothing here is a new claim. Wording is shared with the homepage hero.
 */
export async function pageFigures() {
  const locale = await getLocale();
  const t = dictionary(locale).home.hero;
  const p = pageText(locale).figures;
  const f = (template: string, vars: Record<string, string | number>) => fill(template, vars, locale);

  const sectors: Figure = { value: localDigits(SERVICE_SECTORS, locale), spoken: t.sectorsSpoken, label: t.sectorsLabel };
  const freeDelivery: Figure = {
    value: localDigits(`${FREE_DELIVERY_THRESHOLD}+`, locale),
    spoken: f(t.freeSpoken, { amount: FREE_DELIVERY_THRESHOLD }),
    label: t.freeLabel,
  };
  const turnaround: Figure = {
    value: f(t.turnaroundValue, { hours: USUAL_TURNAROUND_HOURS }),
    spoken: f(t.turnaroundSpoken, { hours: USUAL_TURNAROUND_HOURS }),
    label: t.turnaroundLabel,
  };
  const names = LOCATIONS.map((l) => dictionary(locale).locationNames[l.id] ?? l.name);
  const outlets: Figure = {
    value: localDigits(LOCATIONS.length, locale),
    spoken: f(p.outletsSpoken, { count: LOCATIONS.length }),
    label: f(p.outletsLabel, { names: names.join(p.and) }),
  };

  /** Sector 11 profile only, never blended across outlets (§21). */
  async function google(placement: string): Promise<Figure> {
    const g = await getGoogleProof();
    return {
      value: g.live ? <RatingValue rating={localDigits(g.rating, locale)} /> : localDigits("100+", locale),
      spoken: g.live ? f(t.ratingSpoken, { rating: g.rating }) : localDigits("100+", locale),
      label: g.live ? f(t.ratingLabel, { reviews: g.reviews }) : t.reviewsLabel,
      href: g.location.reviewsUrl,
      analytics: { event: "google_reviews_click", placement, branch: g.location.id },
    };
  }

  return { sectors, freeDelivery, turnaround, outlets, google };
}
