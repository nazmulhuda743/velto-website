import { FREE_DELIVERY_THRESHOLD, LOCATIONS, SERVICE_SECTORS, USUAL_TURNAROUND_HOURS } from "@/content/site";
import { getGoogleProof } from "@/lib/site-content";
import { RatingValue, type Figure } from "./ProofFigures";

/** Shared proof figures. Values come from site config only; nothing here is a new claim. */

/** Sector 11 profile only, never blended across outlets (§21). */
export async function googleFigure(placement: string): Promise<Figure> {
  const g = await getGoogleProof();
  return {
    value: g.live ? <RatingValue rating={g.rating} /> : "100+",
    spoken: g.live ? `${g.rating} out of 5` : "100+",
    label: g.live ? `Google rating, ${g.reviews} reviews` : "Google reviews",
    href: g.location.reviewsUrl,
    analytics: { event: "google_reviews_click", placement, branch: g.location.id },
  };
}

export const sectorsFigure: Figure = { value: SERVICE_SECTORS, spoken: "Sectors 1 to 18", label: "Uttara sectors we collect from" };

export const freeDeliveryFigure: Figure = {
  value: `${FREE_DELIVERY_THRESHOLD}+`,
  spoken: `Orders of ${FREE_DELIVERY_THRESHOLD} or more`,
  label: "Free pickup & delivery",
};

export const turnaroundFigure: Figure = {
  value: `~${USUAL_TURNAROUND_HOURS}h`,
  spoken: `Usually around ${USUAL_TURNAROUND_HOURS} hours`,
  label: "Usual time for Dry Cleaning and Wash & Iron",
};

export const outletsFigure: Figure = {
  value: String(LOCATIONS.length),
  spoken: `${LOCATIONS.length} outlets`,
  label: `Outlets, in ${LOCATIONS.map((l) => l.name).join(" and ")}`,
};
