import Image from "next/image";
import { IMAGE_SLOTS, type ImageSlot } from "@/content/mock";
import { dictionary } from "@/content/i18n";
import { getLocale } from "@/lib/i18n/server";
import { getSiteContent, resolveImage } from "@/lib/site-content";
import { Logo } from "./Logo";

/**
 * Shot briefs ("Photo · to be supplied") are for review builds. Production
 * shows a quiet branded panel instead, so customers never see an unfinished slot.
 */
const SHOW_PHOTO_BRIEFS =
  process.env.NODE_ENV !== "production" || process.env.NEXT_PUBLIC_SHOW_PHOTO_BRIEFS === "1";

type ResponsiveImageProps = {
  image: ImageSlot;
  /** Responsive sizes hint — never ship desktop widths to mobile (§25). */
  sizes: string;
  /** Aspect ratio class that reserves space, e.g. "aspect-[5/6]". */
  aspect: string;
  priority?: boolean;
  className?: string;
  tone?: "light" | "navy";
  /** Decorative images get empty alt (§24). */
  decorative?: boolean;
};

/**
 * Alt text in the page language. Bangla: the admin's Bangla alt text; otherwise the built-in
 * Bangla for the built-in description; an English description written in the admin is shown
 * as entered (it describes the uploaded photo, which the built-in Bangla may not).
 */
async function localAlt(id: string | undefined, alt: string) {
  const locale = await getLocale();
  if (!id || locale === "en") return alt;
  const altBn = (await getSiteContent()).images[id]?.altBn;
  if (altBn) return altBn;
  const builtIn = IMAGE_SLOTS.find((s) => s.id === id)?.slot.alt;
  return alt === builtIn ? (dictionary(locale).imageAlts[id] ?? alt) : alt;
}

/**
 * Photography slot. Renders the production photo when one is supplied;
 * otherwise a clearly-marked MOCK frame that carries the shot brief so the
 * layout, crop and space reservation can be reviewed without stock imagery.
 */
export async function ResponsiveImage({
  image: slot,
  sizes,
  aspect,
  priority = false,
  className = "",
  tone = "light",
  decorative = false,
}: ResponsiveImageProps) {
  // Photos replaced from the admin dashboard override the built-in slot.
  const resolved = await resolveImage(slot);
  const image = { ...resolved, alt: await localAlt(slot.id, resolved.alt) };
  if (image.src) {
    return (
      <div className={`relative overflow-hidden rounded-md bg-soft ${aspect} ${className}`}>
        <Image
          src={image.src}
          alt={decorative ? "" : image.alt}
          fill
          sizes={sizes}
          priority={priority}
          className="object-cover"
          style={image.position ? { objectPosition: image.position } : undefined}
        />
      </div>
    );
  }

  const navy = tone === "navy";
  if (!SHOW_PHOTO_BRIEFS) {
    return (
      <div
        aria-hidden="true"
        data-mock="photo"
        className={`relative flex items-center justify-center overflow-hidden rounded-md ${aspect} ${
          navy ? "bg-[#0a3a62]" : "bg-soft"
        } ${className}`}
      >
        <Logo inverse={navy} className="!h-auto !w-[42%] max-w-[140px]" />
      </div>
    );
  }

  return (
    <div
      role={decorative ? undefined : "img"}
      aria-label={decorative ? undefined : `Photo placeholder: ${image.alt}`}
      aria-hidden={decorative ? true : undefined}
      data-mock="photo"
      className={`relative overflow-hidden rounded-md ${aspect} ${
        navy ? "bg-[#0a3a62] text-white/75" : "bg-[#eef2f4] text-secondary"
      } ${className}`}
    >
      {/* Crop marks */}
      <span aria-hidden="true" className="absolute inset-3 md:inset-4">
        {[
          "left-0 top-0 border-l border-t",
          "right-0 top-0 border-r border-t",
          "bottom-0 left-0 border-b border-l",
          "bottom-0 right-0 border-b border-r",
        ].map((pos) => (
          <span
            key={pos}
            className={`absolute size-4 ${pos} ${navy ? "border-white/35" : "border-line-strong"}`}
          />
        ))}
      </span>
      {decorative ? null : (
        <>
          <span
            aria-hidden="true"
            className="absolute left-6 top-6 t-label uppercase md:left-8 md:top-8"
          >
            Photo · to be supplied
          </span>
          <span
            aria-hidden="true"
            className="absolute inset-x-6 bottom-6 max-w-[34ch] t-caption md:inset-x-8 md:bottom-8"
          >
            {image.alt}
          </span>
        </>
      )}
    </div>
  );
}
