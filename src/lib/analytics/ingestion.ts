/**
 * Is first-party analytics actually broken, or has nobody allowed it lately?
 *
 * Events are only stored for visitors who allow Analytics, and most choose Essential only, so a
 * quiet day is normal. Tracking is "stalled" only when a visitor allowed Analytics and no event
 * arrived after that (the page view lands within seconds of the choice). Runtime-neutral.
 */

/** How long after an Analytics "yes" the first event must have arrived. */
const GRACE_MS = 15 * 60_000;

export type IngestionState =
  | { kind: "stalled"; consentAt: number; lastEventAt: number | null }
  | { kind: "quiet"; lastEventAt: number | null; consentAt: number | null }
  | { kind: "receiving"; lastEventAt: number }
  | { kind: "waiting" };

const time = (v: string | null | undefined) => {
  const t = v ? Date.parse(v) : NaN;
  return Number.isFinite(t) ? t : null;
};

export function ingestionState(
  h: { last_event_at: string | null; last_analytics_consent_at?: string | null },
  now = Date.now(),
): IngestionState {
  const lastEvent = time(h.last_event_at);
  const consent = time(h.last_analytics_consent_at);
  // Older database function without the consent time: fall back to "no event for 6 hours".
  if (h.last_analytics_consent_at === undefined) {
    if (lastEvent === null) return { kind: "waiting" };
    return now - lastEvent > 6 * 3_600_000 ? { kind: "stalled", consentAt: lastEvent, lastEventAt: lastEvent } : { kind: "receiving", lastEventAt: lastEvent };
  }
  if (consent !== null && now - consent > GRACE_MS && (lastEvent === null || lastEvent < consent - 60_000)) {
    return { kind: "stalled", consentAt: consent, lastEventAt: lastEvent };
  }
  if (lastEvent === null) return consent === null ? { kind: "waiting" } : { kind: "quiet", lastEventAt: null, consentAt: consent };
  return now - lastEvent > 6 * 3_600_000 ? { kind: "quiet", lastEventAt: lastEvent, consentAt: consent } : { kind: "receiving", lastEventAt: lastEvent };
}
