import { fill, type Locale } from "@/lib/i18n/config";
import type { ConditionMarkIn } from "@/lib/invoice";
import type { InvoiceText } from "@/content/i18n/invoice";

/**
 * The garment condition report on the invoice link (owner 2026-11-13): each stain staff recorded at drop-off, with
 * up to two photos (short-lived signed links, see signConditionPhotos), like page 2 of the app's PDF invoice.
 * One compact row per mark: the photos on the left (tap to open full size), the garment and the stain beside them.
 */
export function ConditionReport({
  marks,
  photos,
  t,
  locale,
}: {
  marks: ConditionMarkIn[];
  photos: Record<string, string>;
  t: InvoiceText["condition"];
  locale: Locale;
}) {
  if (!marks.length) return null;
  return (
    <section aria-labelledby="condition-title" data-invoice-condition>
      <h2 id="condition-title" className="t-label uppercase text-navy">
        {t.title}
      </h2>
      <p className="mt-1.5 t-small text-body">{t.intro}</p>
      <ul className="mt-3 divide-y divide-line border-y border-line">
        {marks.map((m, i) => {
          const shown = m.photos.map((p) => photos[p]).filter((u): u is string => Boolean(u));
          return (
            <li key={`${m.item}-${i}`} className="flex items-start gap-3.5 py-3 break-inside-avoid" data-condition-mark>
              {shown.length ? (
                <div className="flex shrink-0 gap-1.5">
                  {shown.map((src, j) => (
                    <a
                      key={j}
                      href={src}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="relative block size-[76px] overflow-hidden rounded-md border border-line bg-soft"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element -- a one-hour signed link to a private photo; no optimiser */}
                      <img src={src} alt={`${m.item}${m.type ? `, ${m.type}` : ""}`} loading="lazy" className="absolute inset-0 size-full object-cover" />
                    </a>
                  ))}
                </div>
              ) : null}
              <span className="min-w-0 pt-0.5">
                <span className="block font-medium text-navy">{m.item || "—"}</span>
                {m.type ? <span className="block t-small text-secondary">{fill(t.stainType, { type: m.type }, locale)}</span> : null}
                {!shown.length ? (
                  <span className="mt-0.5 block t-caption text-secondary">{m.photos.length ? t.photoMissing : t.noPhoto}</span>
                ) : m.more > 0 ? (
                  <span className="mt-0.5 block t-caption text-secondary">{fill(t.more, { n: m.more }, locale)}</span>
                ) : null}
              </span>
            </li>
          );
        })}
      </ul>
      <p className="mt-3 rounded-md bg-soft px-3.5 py-3 t-small text-body">{t.promise}</p>
    </section>
  );
}
