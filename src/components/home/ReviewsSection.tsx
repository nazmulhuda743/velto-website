import { Stars } from "@/components/ui/icons";
import { REVIEWS, type Review } from "@/content/mock";

export function ReviewBlock({ review }: { review: Review }) {
  const pending = review.text === null;
  const platformLabel = review.platform === "Google" ? "Google review" : "Facebook recommendation";
  return (
    <figure className="flex h-full flex-col border-t border-line pt-6" data-mock={pending ? "review" : undefined}>
      <span aria-hidden="true" className="font-serif text-[44px] leading-[0.6] text-purple">
        &ldquo;
      </span>
      <blockquote className={`mt-4 t-quote ${pending ? "text-secondary" : "text-navy"}`}>
        <p>{pending ? "Verified review will appear here" : review.text}</p>
      </blockquote>
      <figcaption className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 pt-6 t-small">
        {review.name ? <span className="font-semibold text-navy">{review.name}</span> : null}
        {typeof review.rating === "number" ? (
          <span className="inline-flex items-center gap-1.5">
            <Stars />
            <span className="sr-only">{review.rating} out of 5</span>
          </span>
        ) : null}
        {review.sourceUrl ? (
          <a
            href={review.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-secondary underline decoration-blue/50 underline-offset-4 hover:text-navy"
            data-analytics={review.platform === "Google" ? "google_reviews_click" : undefined}
            data-placement="reviews"
          >
            {platformLabel}
          </a>
        ) : (
          <span className="text-secondary">{platformLabel}</span>
        )}
      </figcaption>
    </figure>
  );
}

export function ReviewsSection() {
  return (
    <section id="reviews" aria-labelledby="reviews-title" className="bg-warm py-(--space-section)">
      <div className="container-page">
        <h2 id="reviews-title" className="t-h2 text-navy">
          What customers noticed
        </h2>
        <ul className="mt-(--space-intro-content) grid-page gap-y-12">
          {REVIEWS.map((review, i) => (
            <li key={i} className="col-span-4 md:col-span-4 xl:col-span-6">
              <ReviewBlock review={review} />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
