import { Stars } from "@/components/ui/icons";
import type { Review } from "@/content/mock";
import { LOCATIONS } from "@/content/site";
import { MarqueeControl } from "./MarqueeControl";

/** Long reviews are clamped on the card and read in full on Google; the words are never cut mid-edit. */
const CLAMP_OVER = 280;

const outletName = (r: Review) => LOCATIONS.find((l) => l.id === r.branch)?.name;
const reviewHref = (r: Review) => r.sourceUrl ?? LOCATIONS.find((l) => l.id === r.branch)?.reviewsUrl ?? null;

/** Source first (platform · outlet, rating), then the customer's own words, then who said it. */
export function ReviewCard({ review }: { review: Review }) {
  if (!review.text || !review.name) return null;
  const highlight = review.highlight && review.text.includes(review.highlight) ? review.highlight : null;
  const quote = highlight ?? review.text;
  const clamped = !highlight && review.text.length > CLAMP_OVER;
  const href = reviewHref(review);
  const outlet = outletName(review);
  return (
    <figure className="flex w-[288px] shrink-0 snap-start flex-col rounded-md border border-line bg-white p-6 min-[400px]:w-[320px] md:w-[380px] md:p-7">
      <div className="flex items-center justify-between gap-3">
        <span className="t-label uppercase text-navy">
          {review.platform}
          {outlet ? <span className="font-medium text-secondary"> · {outlet}</span> : null}
        </span>
        {typeof review.rating === "number" ? (
          <span className="inline-flex shrink-0 items-center">
            <Stars />
            <span className="sr-only">{review.rating} out of 5</span>
          </span>
        ) : null}
      </div>
      <blockquote className="mb-6 mt-5 font-serif text-[18px] leading-[1.5] text-navy md:text-[19px]">
        <p className={`whitespace-pre-line ${clamped ? "line-clamp-7" : ""}`}>&ldquo;{quote}&rdquo;</p>
      </blockquote>
      <figcaption className="mt-auto flex items-end justify-between gap-3 border-t border-line pt-4">
        <span className="min-w-0">
          <span className="block font-semibold leading-snug text-navy">{review.name}</span>
          {review.relativeTime ? <span className="block t-caption text-secondary">{review.relativeTime}</span> : null}
        </span>
        {href ? (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 py-1 t-small text-secondary underline decoration-blue/50 underline-offset-4 hover:text-navy"
            data-analytics={review.platform === "Google" ? "google_reviews_click" : undefined}
            data-placement="review_card"
            data-branch={review.branch}
          >
            {highlight || clamped ? "Read in full" : `On ${review.platform}`}
            <span className="sr-only"> (opens {review.platform} in a new tab)</span>
          </a>
        ) : null}
      </figcaption>
    </figure>
  );
}

/**
 * Moving review strip. Two identical groups scroll continuously; the second is
 * hidden from assistive tech and not focusable. Stops on hover or focus, and
 * has a pause button. Reduced motion shows one static, swipeable row.
 */
export function ReviewCarousel({ reviews, label = "Customer reviews" }: { reviews: Review[]; label?: string }) {
  const shown = reviews.filter((r) => r.text && r.name);
  if (!shown.length) return null;
  // Short lists repeat so the strip is always wider than the screen.
  const group = Array.from({ length: Math.max(1, Math.ceil(4 / shown.length)) }, () => shown).flat();
  const seconds = group.length * 11;
  return (
    <MarqueeControl label={label}>
      <div className="review-marquee-viewport overflow-hidden px-4 min-[360px]:px-5 md:px-6">
        <div className="review-marquee-track" style={{ ["--marquee-duration" as string]: `${seconds}s` }}>
          <ul className="flex gap-4 pr-4 md:gap-6 md:pr-6">
            {group.map((r, i) => (
              <li key={i} className="flex">
                <ReviewCard review={r} />
              </li>
            ))}
          </ul>
          <ul className="review-marquee-copy flex gap-4 pr-4 md:gap-6 md:pr-6" aria-hidden="true" inert>
            {group.map((r, i) => (
              <li key={i} className="flex">
                <ReviewCard review={r} />
              </li>
            ))}
          </ul>
        </div>
      </div>
    </MarqueeControl>
  );
}
