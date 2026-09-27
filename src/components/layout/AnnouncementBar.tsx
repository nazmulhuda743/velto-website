import Link from "@/components/i18n/Link";
import { dictionary } from "@/content/i18n";
import { keepBanglaSuffixes } from "@/lib/i18n/config";
import { getLocale } from "@/lib/i18n/server";
import { barLink, barMessages, tickerCopies, tickerSeconds } from "@/lib/promo";
import { getSiteContent } from "@/lib/site-content";
import { TickerControl } from "./TickerControl";

/**
 * Optional site-wide notice above the header, switched on and edited from the admin
 * (Promo & popup). Still: one centred line. Moving: a continuous ticker of the messages
 * (separated by "|" in the admin), which pauses on hover, focus, the pause button and for
 * readers who prefer reduced motion (they get the still line instead).
 */
export async function AnnouncementBar() {
  const { announcement } = (await getSiteContent()).settings;
  if (!announcement.enabled || !announcement.text.trim()) return null;
  const locale = await getLocale();
  const t = dictionary(locale).promo;
  const href = barLink(announcement);
  const external = /^https?:\/\//.test(href);
  // Bangla pages show the Bangla text when there is one; otherwise the English, marked as English.
  const onBangla = locale === "bn";
  const bangla = onBangla && announcement.textBn.trim() ? keepBanglaSuffixes(announcement.textBn) : null;
  const english = onBangla && !bangla;
  const lang = english ? "en" : undefined;
  const messages = barMessages(bangla ?? announcement.text);
  if (!messages.length) return null;

  const wrap = (content: React.ReactNode, className: string) =>
    href ? (
      external ? (
        <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
          {content}
        </a>
      ) : (
        <Link href={href} className={className}>
          {content}
        </Link>
      )
    ) : (
      <div className={className}>{content}</div>
    );

  if (announcement.still) {
    return (
      <div data-promo-bar className="bg-navy text-white">
        <div className="container-page flex min-h-10 items-center justify-center py-2 text-center t-small">
          {wrap(
            <span className="font-medium" lang={lang}>
              {messages.join(" · ")}
            </span>,
            href ? "underline decoration-cyan underline-offset-4" : "",
          )}
        </div>
      </div>
    );
  }

  const copies = tickerCopies(messages);
  const seconds = tickerSeconds(messages, copies);
  const group = (hidden: boolean) => (
    <ul className={`promo-ticker-group flex shrink-0 items-center${hidden ? " promo-ticker-copy" : ""}`} aria-hidden={hidden || undefined} inert={hidden || undefined}>
      {Array.from({ length: copies }, (_, c) =>
        messages.map((m, i) => (
          <li key={`${c}-${i}`} className="flex items-center whitespace-nowrap pr-10 font-medium" lang={lang}>
            <span aria-hidden="true" className="mr-10 inline-block size-1.5 shrink-0 rounded-full bg-cyan" />
            {m}
          </li>
        )),
      )}
    </ul>
  );

  return (
    <TickerControl label={t.barLabel} pauseLabel={t.pause} playLabel={t.play}>
      <div className="promo-ticker-viewport min-h-10 flex-1 overflow-hidden py-2 t-small">
        {wrap(
          <div className="promo-ticker-track" style={{ ["--ticker-duration" as string]: `${seconds}s` }}>
            {group(false)}
            {group(true)}
          </div>,
          "block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan",
        )}
        {/* Reduced motion: the same messages as one still, wrapping line. */}
        <div className="promo-ticker-still container-page text-center">
          {wrap(
            <span className="font-medium" lang={lang}>
              {messages.join(" · ")}
            </span>,
            href ? "underline decoration-cyan underline-offset-4" : "",
          )}
        </div>
      </div>
    </TickerControl>
  );
}
