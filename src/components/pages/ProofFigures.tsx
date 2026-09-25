import type { ReactNode } from "react";
import { Star } from "@/components/ui/icons";
import { T } from "@/components/i18n/T";

export type Figure = {
  /** The large figure, e.g. "1–18" or "~72h". */
  value: ReactNode;
  /** What a screen reader says instead of the figure, e.g. "Usually around 72 hours". */
  spoken: string;
  /** Small label under the figure. */
  label: string;
  /** Optional external link (e.g. Google reviews). */
  href?: string;
  analytics?: { event: string; placement: string; branch?: string };
};

/** "5.0★" as a figure value. */
export const RatingValue = ({ rating }: { rating: string | number }) => (
  <span className="inline-flex items-center gap-1.5">
    {rating}
    <Star className="size-[0.6em] text-blue" />
  </span>
);

/**
 * The site-wide proof row: a few operational facts as large figures with
 * small labels, on thin rules. Plain figures, never badges or KPI cards.
 * Four figures: two columns, one row from 1200px. Three figures: always one row.
 */
export function ProofFigures({ figures, wide = 4 }: { figures: Figure[]; wide?: 3 | 4 }) {
  const cols = wide === 4 ? "grid-cols-2 xl:grid-cols-4" : "grid-cols-3";
  return (
    <dl className={`grid border-t border-line ${cols}`}>
      {figures.map((f, i) => {
        const value = (
          <>
            <span aria-hidden="true">{f.value}</span>
            <span className="sr-only">{f.spoken}</span>
          </>
        );
        // A divider before every figure except the first in each visual row.
        const border =
          wide === 4
            ? `border-b ${i % 2 === 0 ? "pr-4" : "border-l pl-4 xl:pr-4"} ${i === 2 ? "xl:border-l xl:pl-4" : ""} xl:border-b-0 xl:py-5`
            : `pr-3 md:py-5 ${i > 0 ? "border-l pl-3 md:pl-4" : ""}`;
        return (
          <div key={f.label} className={`flex flex-col-reverse justify-end border-line py-4 ${border}`}>
            <dt className="mt-1.5 max-w-[20ch] t-caption text-secondary">{f.label}</dt>
            <dd className="text-[28px] font-semibold leading-none tracking-[-0.03em] text-navy tabular-nums md:text-[32px]">
              {f.href ? (
                <a
                  href={f.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="relative rounded-sm after:absolute after:-inset-2 after:content-[''] hover:text-blue"
                  data-analytics={f.analytics?.event}
                  data-placement={f.analytics?.placement}
                  data-branch={f.analytics?.branch}
                >
                  {value}
                  <span className="sr-only">
          {" "}
          <T k="common.opensNewTab" />
        </span>
                </a>
              ) : (
                value
              )}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}
