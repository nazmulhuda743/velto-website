import { Stars } from "@/components/ui/icons";
import { dictionary } from "@/content/i18n";
import { getLocale } from "@/lib/i18n/server";
import { getGoogleProofLabel, getLocations } from "@/lib/site-content";

/**
 * Durable Google proof (spec §21). The 5.0 rating refers only to the primary
 * Sector 11 profile, so the link goes to that profile's reviews.
 */
export async function GoogleProof({
  placement,
  inverse = false,
}: {
  placement: string;
  inverse?: boolean;
}) {
  const [primary] = await getLocations();
  const label = await getGoogleProofLabel();
  const t = dictionary(await getLocale()).googleProof;
  return (
    <a
      href={primary.reviewsUrl}
      target="_blank"
      rel="noopener noreferrer"
      className={`group inline-flex items-center gap-3 py-1 t-small font-medium ${
        inverse ? "text-white" : "text-navy"
      }`}
      data-analytics="google_reviews_click"
      data-placement={placement}
      data-branch={primary.id}
    >
      <Stars className={inverse ? "!text-cyan" : ""} />
      <span className="underline decoration-transparent underline-offset-4 transition-colors group-hover:decoration-current">
        {label}
      </span>
      <span className="sr-only"> {t.opens}</span>
    </a>
  );
}

/** Thin-rule list of short proof statements. */
export function ProofList({
  items,
  inverse = false,
  className = "",
}: {
  items: string[];
  inverse?: boolean;
  className?: string;
}) {
  return (
    <ul className={className}>
      {items.map((item) => (
        <li
          key={item}
          className={`flex items-start gap-3 border-t py-3.5 t-small font-medium last:border-b ${
            inverse ? "border-white/20 text-white" : "border-line text-navy"
          }`}
        >
          <span
            aria-hidden="true"
            className={`mt-[9px] h-px w-3 shrink-0 ${inverse ? "bg-cyan" : "bg-blue"}`}
          />
          {item}
        </li>
      ))}
    </ul>
  );
}
