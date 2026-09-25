import { Stars } from "@/components/ui/icons";
import { LOCATIONS } from "@/content/site";
import { GoogleProof } from "./ProofLine";
import { Eyebrow } from "./SectionIntro";
import type { Review } from "@/content/mock";
import { ReviewCarousel } from "@/components/reviews/ReviewCarousel";
import { getHomeReviews } from "@/lib/reviews";

const Paragraph = ({ text }: { text: string }) => (
  <p>
    {text.split("\n").map((line, i) => (
      <span key={i}>
        {i > 0 ? <br /> : null}
        {line}
      </span>
    ))}
  </p>
);

/** Long reviews show their opening; the rest stays one tap away, never edited. */
const COLLAPSE_OVER_CHARS = 600;
const PREVIEW_CHARS = 300;

function ReviewText({ text, plain = false }: { text: string; plain?: boolean }) {
  const paragraphs = text.split("\n\n");
  if (plain) return paragraphs.map((p, i) => <Paragraph key={i} text={p} />);
  const limit = text.length > COLLAPSE_OVER_CHARS ? PREVIEW_CHARS : Infinity;
  let shown = 0;
  let used = 0;
  while (shown < paragraphs.length && (shown === 0 || used + paragraphs[shown].length <= limit)) {
    used += paragraphs[shown].length;
    shown++;
  }
  const rest = paragraphs.slice(shown);
  return (
    <>
      <div className="space-y-4">
        {paragraphs.slice(0, shown).map((p, i) => (
          <Paragraph key={i} text={p} />
        ))}
      </div>
      {rest.length ? (
        <details className="group/review mt-4">
          <summary className="inline-flex min-h-11 cursor-pointer items-center font-sans text-base font-semibold text-navy underline decoration-blue/60 underline-offset-[6px] group-open/review:hidden">
            Read the full review
          </summary>
          <div className="space-y-4">
            {rest.map((p, i) => (
              <Paragraph key={i} text={p} />
            ))}
          </div>
        </details>
      ) : null}
    </>
  );
}

/** Where the review came from, stated before the words: platform · outlet, then rating. */
function ReviewSource({ review }: { review: Review }) {
  const outlet = LOCATIONS.find((l) => l.id === review.branch)?.name;
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
      <span className="t-label uppercase text-navy">
        {review.platform}
        {outlet ? <span className="font-medium text-secondary"> · {outlet}</span> : null}
      </span>
      {typeof review.rating === "number" ? (
        <span className="inline-flex items-center">
          <Stars />
          <span className="sr-only">{review.rating} out of 5</span>
        </span>
      ) : review.rating === "recommends" ? (
        <span className="t-small text-secondary">Recommends Velto</span>
      ) : null}
    </div>
  );
}

/**
 * Editorial review: source first, then the customer's own words. With a
 * verified pull line, that line leads and the full text is one tap away.
 */
export function ReviewBlock({ review, size = "default" }: { review: Review; size?: "default" | "compact" }) {
  const pending = review.text === null;
  const highlight = review.text && review.highlight && review.text.includes(review.highlight) ? review.highlight : null;
  const platformLabel = review.platform === "Google" ? "See it on Google" : "See it on Facebook";
  return (
    <figure className="flex h-full flex-col border-t border-navy pt-5" data-mock={pending ? "review" : undefined}>
      <ReviewSource review={review} />
      <blockquote className={`mt-5 ${pending ? "t-quote text-secondary" : "text-navy"}`}>
        {review.text === null ? (
          <p>Verified review will appear here</p>
        ) : highlight ? (
          <>
            <p className={size === "compact" ? "t-quote" : "font-serif text-[22px] leading-[1.35] md:text-[26px]"}>
              &ldquo;{highlight}&rdquo;
            </p>
            <details className="group/review mt-4">
              <summary className="inline-flex min-h-11 cursor-pointer items-center t-small font-semibold text-navy underline decoration-blue/60 underline-offset-[6px] group-open/review:hidden">
                Read the full review
              </summary>
              <div className="space-y-3 t-body text-body">
                <ReviewText text={review.text} plain />
              </div>
            </details>
          </>
        ) : review.text.length <= COLLAPSE_OVER_CHARS && !review.text.includes("\n") ? (
          // Short single-paragraph review: quoted whole, like a pull line.
          <p className="t-quote">&ldquo;{review.text}&rdquo;</p>
        ) : (
          <div className="t-quote">
            <ReviewText text={review.text} />
          </div>
        )}
      </blockquote>
      <figcaption className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 pt-6 t-small">
        {review.name ? <span className="font-semibold text-navy">{review.name}</span> : null}
        <ReviewSourceLink review={review} label={platformLabel} className="inline-block py-1 text-secondary underline decoration-blue/50 underline-offset-4 hover:text-navy" />
      </figcaption>
    </figure>
  );
}

/** Direct review link if known, otherwise the Google reviews of the outlet it was left on. */
const reviewHref = (review: Review) =>
  review.sourceUrl ?? LOCATIONS.find((l) => l.id === review.branch)?.reviewsUrl ?? null;

function ReviewSourceLink({ review, label, className }: { review: Review; label: string; className: string }) {
  const href = reviewHref(review);
  if (!href) return <span className="text-secondary">{review.platform}</span>;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
      data-analytics={review.platform === "Google" ? "google_reviews_click" : undefined}
      data-placement="reviews"
      data-branch={review.branch}
    >
      {label}
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  );
}

/**
 * "What customers noticed": a moving strip of every review Velto can show
 * (owner-verified, plus live Google reviews when configured). Pauses on hover.
 */
export async function ReviewsSection() {
  const reviews = await getHomeReviews();
  if (!reviews.length) return null;
  return (
    <section id="reviews" aria-labelledby="reviews-title" className="bg-warm py-(--space-section)">
      <div className="container-page flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <Eyebrow>Customer proof</Eyebrow>
          <h2 id="reviews-title" className="t-h2 text-navy">
            What customers noticed
          </h2>
        </div>
        <GoogleProof placement="reviews" />
      </div>
      <div className="mt-(--space-intro-content)">
        <ReviewCarousel reviews={reviews} label="Customer reviews" />
      </div>
    </section>
  );
}
