import "server-only";

import { cache } from "react";
import { REVIEWS, type ImageSlot, type Review } from "@/content/mock";
import { GOOGLE_PROOF, LOCATIONS, type Location } from "@/content/site";
import { isSupabaseConfigured, supabaseFetch } from "./supabase-server";

/** Cache tag invalidated by every admin save. */
export const SITE_CONTENT_TAG = "site-content";

export type LocationId = Location["id"];

export type SiteSettings = {
  /** Digits only, with country code, e.g. 8801605162788. */
  whatsappNumber: string;
  announcement: { enabled: boolean; text: string; href: string };
  outlets: Record<LocationId, { rating: string; reviewCount: number; hours: string }>;
};

export type SeoEntry = { title?: string; description?: string; ogImage?: string; noindex?: boolean };
export type ImageOverride = { src: string; alt?: string; position?: string; updatedAt?: string };
export type ReviewEntry = Review & { id: string; showOnHome: boolean };

export type SiteContent = {
  settings: SiteSettings;
  seo: Record<string, SeoEntry>;
  images: Record<string, ImageOverride>;
  reviews: ReviewEntry[];
};

export const DEFAULT_SETTINGS: SiteSettings = {
  whatsappNumber: "8801605162788",
  announcement: { enabled: false, text: "", href: "" },
  outlets: Object.fromEntries(
    LOCATIONS.map((l) => [l.id, { rating: l.rating, reviewCount: l.reviewCount, hours: l.hours }]),
  ) as SiteSettings["outlets"],
};

export const DEFAULT_REVIEWS: ReviewEntry[] = REVIEWS.map((r, i) => ({
  ...r,
  id: `default-${i + 1}`,
  showOnHome: true,
}));

const str = (v: unknown, max = 400) => (typeof v === "string" ? v.slice(0, max) : undefined);
const rec = (v: unknown) => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});

function parseSettings(v: unknown): SiteSettings {
  const s = rec(v);
  const a = rec(s.announcement);
  const outlets = rec(s.outlets);
  return {
    whatsappNumber: /^\d{8,15}$/.test(String(s.whatsappNumber ?? "")) ? String(s.whatsappNumber) : DEFAULT_SETTINGS.whatsappNumber,
    announcement: {
      enabled: a.enabled === true,
      text: str(a.text, 160) ?? "",
      href: str(a.href, 300) ?? "",
    },
    outlets: Object.fromEntries(
      LOCATIONS.map((l) => {
        const o = rec(outlets[l.id]);
        const d = DEFAULT_SETTINGS.outlets[l.id];
        const count = Number(o.reviewCount);
        return [
          l.id,
          {
            rating: str(o.rating, 8) || d.rating,
            reviewCount: Number.isInteger(count) && count >= 0 ? count : d.reviewCount,
            hours: str(o.hours, 80) || d.hours,
          },
        ];
      }),
    ) as SiteSettings["outlets"],
  };
}

function parseSeo(v: unknown): Record<string, SeoEntry> {
  const out: Record<string, SeoEntry> = {};
  for (const [path, entry] of Object.entries(rec(v))) {
    const e = rec(entry);
    if (!path.startsWith("/")) continue;
    out[path] = {
      title: str(e.title, 120) || undefined,
      description: str(e.description, 320) || undefined,
      ogImage: str(e.ogImage, 500) || undefined,
      noindex: e.noindex === true,
    };
  }
  return out;
}

function parseImages(v: unknown): Record<string, ImageOverride> {
  const out: Record<string, ImageOverride> = {};
  for (const [id, entry] of Object.entries(rec(v))) {
    const e = rec(entry);
    const src = str(e.src, 500);
    if (!src || !/^https:\/\//.test(src)) continue;
    const updatedAt = str(e.updatedAt, 40);
    out[id] = {
      src,
      alt: str(e.alt, 300) || undefined,
      position: str(e.position, 40) || undefined,
      updatedAt: updatedAt && !Number.isNaN(Date.parse(updatedAt)) ? updatedAt : undefined,
    };
  }
  return out;
}

function parseReviews(v: unknown): ReviewEntry[] | null {
  if (!Array.isArray(v)) return null;
  return v.flatMap((item, i) => {
    const r = rec(item);
    const name = str(r.name, 80);
    const text = str(r.text, 4000);
    if (!name || !text) return [];
    const rating = Number(r.rating);
    return [
      {
        id: str(r.id, 40) || `review-${i + 1}`,
        name,
        text,
        platform: r.platform === "Facebook" ? "Facebook" : "Google",
        rating: r.rating === "recommends" ? "recommends" : rating >= 1 && rating <= 5 ? rating : null,
        branch: r.branch === "sector-11" || r.branch === "sector-18" ? r.branch : undefined,
        sourceUrl: /^https:\/\//.test(String(r.sourceUrl ?? "")) ? String(r.sourceUrl) : null,
        showOnHome: r.showOnHome !== false,
      } satisfies ReviewEntry,
    ];
  });
}

async function loadRows(): Promise<Record<string, unknown>> {
  if (!isSupabaseConfigured()) return {};
  try {
    const res = await supabaseFetch("/rest/v1/website_content?select=key,value", {
      next: { tags: [SITE_CONTENT_TAG], revalidate: 3600 },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const rows = (await res.json()) as { key: string; value: unknown }[];
    return Object.fromEntries(rows.map((r) => [r.key, r.value]));
  } catch (error) {
    console.error("site_content_load_failed", error instanceof Error ? error.message : "unknown");
    return {};
  }
}

/** Admin-managed website content, merged over the built-in defaults. Never throws. */
export const getSiteContent = cache(async (): Promise<SiteContent> => {
  const rows = await loadRows();
  return {
    settings: parseSettings(rows.settings),
    seo: parseSeo(rows.seo),
    images: parseImages(rows.images),
    reviews: parseReviews(rows.reviews) ?? DEFAULT_REVIEWS,
  };
});

export async function getLocations(): Promise<Location[]> {
  const { settings } = await getSiteContent();
  return LOCATIONS.map((l) => ({ ...l, ...settings.outlets[l.id] }));
}

/**
 * Google proof for the primary (Sector 11) profile only, never blended across
 * outlets (§21). Counts of 100+ are floored to the hundred ("100+").
 */
export async function getGoogleProof() {
  const [primary] = await getLocations();
  const reviews = primary.reviewCount >= 100 ? `${Math.floor(primary.reviewCount / 100) * 100}+` : String(primary.reviewCount);
  return { live: Boolean(primary.rating && primary.reviewCount), rating: primary.rating, reviews, location: primary };
}

/** "5.0 on Google · 100+ reviews" for the primary (Sector 11) profile. */
export async function getGoogleProofLabel() {
  const proof = await getGoogleProof();
  return proof.live ? `${proof.rating} on Google · ${proof.reviews} reviews` : GOOGLE_PROOF.fallback;
}

export async function resolveImage(image: ImageSlot): Promise<ImageSlot> {
  if (!image.id) return image;
  const override = (await getSiteContent()).images[image.id];
  if (!override) return image;
  return {
    ...image,
    src: override.src,
    alt: override.alt ?? image.alt,
    position: override.position ?? image.position,
    source: undefined,
  };
}
