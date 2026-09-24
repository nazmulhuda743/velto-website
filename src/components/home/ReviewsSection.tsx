import { Stars } from "@/components/ui/icons";
import { Marquee } from "@/components/ui/Marquee";
import { LOCATIONS } from "@/content/site";
import { GoogleProof } from "./ProofLine";
import type { Review } from "@/content/mock";
import { getSiteContent } from "@/lib/site-content";

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

function ReviewText({ text }: { text: string }) {
  const paragraphs = text.split("\n\n");
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

export function ReviewBlock({ review }: { review: Review }) {
  const pending = review.text === null;
  const platformLabel = review.platform === "Google" ? "Google review" : "Facebook recommendation";
  return (
    <figure className="flex h-full flex-col border-t border-line pt-6" data-mock={pending ? "review" : undefined}>
      <span aria-hidden="true" className="font-serif text-[44px] leading-[0.6] text-purple">
        &ldquo;
      </span>
      <blockquote className={`mt-4 t-quote ${pending ? "text-secondary" : "text-navy"}`}>
        {review.text === null ? <p>Verified review will appear here</p> : <ReviewText text={review.text} />}
      </blockquote>
      <figcaption className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 pt-6 t-small">
        {review.name ? <span className="font-semibold text-navy">{review.name}</span> : null}
        {typeof review.rating === "number" ? (
          <span className="inline-flex items-center gap-1.5">
            <Stars />
            <span className="sr-only">{review.rating} out of 5</span>
          </span>
        ) : null}
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
  if (!href) return <span className="text-secondary">{label}</span>;
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

/** Reviews longer than this are clamped in the carousel and read in full on Google. */
const CARD_FULL_CHARS = 320;

function ReviewCard({ review }: { review: Review }) {
  if (!review.text || !review.name) return null;
  const long = review.text.length > CARD_FULL_CHARS;
  return (
    <figure className="flex w-[300px] shrink-0 flex-col rounded-lg border border-line bg-white p-6 md:w-[380px] md:p-7">
      <div className="flex items-center justify-between">
        {typeof review.rating === "number" ? (
          <span className="inline-flex items-center">
            <Stars />
            <span className="sr-only">{review.rating} out of 5</span>
          </span>
        ) : (
          <span />
        )}
        <span className="t-caption font-medium text-secondary">{review.platform}</span>
      </div>
      <blockquote className="mt-5 font-serif text-[18px] leading-[1.5] text-navy md:text-[19px]">
        <p className={`whitespace-pre-line ${long ? "line-clamp-7" : ""}`}>{review.text}</p>
      </blockquote>
      <figcaption className="mt-auto flex items-center gap-3 border-t border-line pt-5">
        <span
          aria-hidden="true"
          className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-navy text-[15px] font-semibold text-white"
        >
          {review.name.charAt(0)}
        </span>
        <span className="min-w-0">
          <span className="block font-semibold leading-snug text-navy">{review.name}</span>
          <ReviewSourceLink
            review={review}
            label={long ? "Read the full review" : "Google review"}
            className="inline-block py-1 t-small text-secondary underline decoration-blue/50 underline-offset-4 hover:text-navy"
          />
        </span>
      </figcaption>
    </figure>
  );
}

export async function ReviewsSection() {
  const reviews = (await getSiteContent()).reviews.filter((r) => r.showOnHome && r.text && r.name);
  if (!reviews.length) return null;
  return (
    <section id="reviews" aria-labelledby="reviews-title" className="bg-warm py-(--space-section)">
      <div className="container-page flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <h2 id="reviews-title" className="t-h2 text-navy">
          What customers noticed
        </h2>
        <GoogleProof placement="reviews" />
      </div>
      <div className="mt-(--space-intro-content)">
        <Marquee
          label="customer reviews"
          seconds={reviews.length * 14}
          repeat={Math.max(1, Math.ceil(4 / Math.max(reviews.length, 1)))}
          gapClass="gap-4 md:gap-6"
          seamClass="pr-4 md:pr-6"
          className="container-page"
        >
          {reviews.map((review) => (
            <ReviewCard key={review.id} review={review} />
          ))}
        </Marquee>
      </div>
    </section>
  );
}
