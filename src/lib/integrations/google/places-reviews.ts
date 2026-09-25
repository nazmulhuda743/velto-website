import "server-only";

import type { Review } from "@/content/mock";

/**
 * Live Google reviews through the official Places API (New), server-side only.
 *
 * Off until all three are set (Vercel → Environment Variables):
 *   GOOGLE_PLACES_API_KEY          a key restricted to the Places API (New)
 *   GOOGLE_PLACE_ID_SECTOR_11      the Place ID of the Sector 11 Business Profile
 *   GOOGLE_PLACE_ID_SECTOR_18      the Place ID of the Sector 18 Business Profile
 *
 * Google returns at most five reviews per place. Showing every review needs the
 * Business Profile API (owner OAuth); until then, reviews can also be added in
 * the admin dashboard. Results are cached for a day. Any failure returns [] so a
 * page never breaks because Google is unreachable.
 *
 * Google's policy: show the author's name, link to their profile or the review,
 * and attribute Google. ReviewBlock / ReviewCard do all three.
 */

type PlacesReview = {
  rating?: number;
  text?: { text?: string };
  originalText?: { text?: string };
  relativePublishTimeDescription?: string;
  googleMapsUri?: string;
  authorAttribution?: { displayName?: string; uri?: string };
};

const BRANCHES = [
  { branch: "sector-11", env: "GOOGLE_PLACE_ID_SECTOR_11" },
  { branch: "sector-18", env: "GOOGLE_PLACE_ID_SECTOR_18" },
] as const;

const PLACE_ID = /^[A-Za-z0-9_-]{10,200}$/;

export const isGoogleReviewsConfigured = () =>
  Boolean(process.env.GOOGLE_PLACES_API_KEY?.trim()) && BRANCHES.some((b) => PLACE_ID.test(process.env[b.env]?.trim() ?? ""));

async function fetchPlaceReviews(placeId: string, branch: Review["branch"], key: string): Promise<Review[]> {
  const res = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}?languageCode=en`, {
    headers: { "X-Goog-Api-Key": key, "X-Goog-FieldMask": "reviews" },
    next: { revalidate: 86_400 },
    signal: AbortSignal.timeout(4_000),
  });
  if (!res.ok) throw new Error(`Places API ${res.status}`);
  const body = (await res.json()) as { reviews?: PlacesReview[] };
  return (body.reviews ?? []).flatMap((r) => {
    // Prefer the customer's own words over Google's translation.
    const text = (r.originalText?.text ?? r.text?.text ?? "").trim();
    const name = r.authorAttribution?.displayName?.trim();
    if (!text || !name) return [];
    return [
      {
        name,
        platform: "Google" as const,
        branch,
        rating: typeof r.rating === "number" ? r.rating : null,
        text,
        sourceUrl: r.googleMapsUri ?? r.authorAttribution?.uri ?? null,
        relativeTime: r.relativePublishTimeDescription,
        origin: "google_live" as const,
      },
    ];
  });
}

/** Up to five recent reviews per configured outlet, newest Google selection first. */
export async function getGoogleReviews(): Promise<Review[]> {
  const key = process.env.GOOGLE_PLACES_API_KEY?.trim();
  if (!key) return [];
  const results = await Promise.all(
    BRANCHES.map(async (b) => {
      const placeId = process.env[b.env]?.trim() ?? "";
      if (!PLACE_ID.test(placeId)) return [];
      try {
        return await fetchPlaceReviews(placeId, b.branch, key);
      } catch (error) {
        console.error("[google-reviews] fetch failed", { branch: b.branch, message: (error as Error).message });
        return [];
      }
    }),
  );
  return results.flat();
}
