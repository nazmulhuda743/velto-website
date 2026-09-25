import "server-only";

import { cache } from "react";
import { REVIEWS, type Review } from "@/content/mock";
import { getGoogleReviews } from "@/lib/integrations/google/places-reviews";
import { getSiteContent } from "@/lib/site-content";

/**
 * Every review the website may show: owner-verified reviews (from the admin
 * dashboard, or the built-in verified set) plus live Google reviews when the
 * Places API is configured. Text is never edited; duplicates (the same person
 * on the same outlet) keep the verified copy.
 */

/** Words that tie a review to a service page. Matched on whole words, case-insensitive. */
const SERVICE_KEYWORDS: Record<string, string[]> = {
  "dry-cleaning": ["dry clean", "dry cleaning", "dry-clean", "suit", "suits", "blazer", "saree", "sari", "sherwani", "silk", "coat", "lehenga", "panjabi", "punjabi", "jamdani", "katan", "banarasi"],
  "wash-and-iron": ["wash", "washed", "washing", "laundry", "smell", "smells", "fresh", "clothes"],
  ironing: ["iron", "ironed", "ironing", "press", "pressed", "pressing", "crease", "wrinkle"],
  "curtain-cleaning": ["curtain", "curtains"],
  "carpet-cleaning": ["carpet", "carpets", "rug", "rugs", "doormat", "prayer mat"],
  "blanket-comforter-cleaning": ["blanket", "blankets", "comforter", "comforters", "quilt", "quilts", "bedding", "beddings", "duvet", "katha"],
  express: ["express", "urgent", "same day", "same-day", "next day"],
  "regular-laundry": ["every week", "weekly", "regular", "regularly", "since then", "always use", "for months", "for years"],
};

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const MATCHERS = Object.entries(SERVICE_KEYWORDS).map(
  ([slug, words]) => [slug, new RegExp(`\\b(${words.map(escape).join("|")})\\b`, "i")] as const,
);

/** Explicit tags win; otherwise the review's own words decide. */
export function servicesFor(review: Review): string[] {
  if (review.services?.length) return review.services;
  const text = review.text ?? "";
  return MATCHERS.filter(([, re]) => re.test(text)).map(([slug]) => slug);
}

const key = (r: Review) => `${(r.name ?? "").trim().toLowerCase()}|${r.branch ?? ""}`;

export const getAllReviews = cache(async (): Promise<Review[]> => {
  const [content, live] = await Promise.all([getSiteContent(), getGoogleReviews()]);
  // Admin-stored copies of the built-in verified reviews keep their pull line and tags if the text is unchanged.
  const builtIn = new Map(REVIEWS.map((r) => [key(r), r]));
  const verified: Review[] = content.reviews
    .filter((r) => r.text && r.name)
    .map((r) => {
      const original = builtIn.get(key(r));
      return original && original.text === r.text
        ? { ...r, highlight: original.highlight, services: original.services, origin: "verified" as const }
        : { ...r, origin: "verified" as const };
    });
  const seen = new Set(verified.map(key));
  return [...verified, ...live.filter((r) => !seen.has(key(r)))];
});

/** Reviews shown on the homepage: admin "show on home" choices, then any live Google reviews. */
export async function getHomeReviews(): Promise<Review[]> {
  const [content, all] = await Promise.all([getSiteContent(), getAllReviews()]);
  const hidden = new Set(content.reviews.filter((r) => !r.showOnHome).map(key));
  return all.filter((r) => !hidden.has(key(r)));
}

/**
 * Reviews for one service page. `specific` is true when at least one review
 * talks about this service; otherwise the page shows general Velto reviews and
 * says so, rather than implying they are about this service.
 */
export async function getServiceReviews(slug: string, exclude: Review[] = []): Promise<{ reviews: Review[]; specific: boolean }> {
  const skip = new Set(exclude.map(key));
  const all = (await getAllReviews()).filter((r) => !skip.has(key(r)));
  const matching = all.filter((r) => servicesFor(r).includes(slug));
  return matching.length ? { reviews: matching, specific: true } : { reviews: all, specific: false };
}
