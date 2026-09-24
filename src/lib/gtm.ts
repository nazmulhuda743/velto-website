const GTM_ID_PATTERN = /^GTM-[A-Z0-9]+$/i;

/** The configured GTM container ID, or null when missing or malformed. */
export function configuredGtmId() {
  const value = process.env.NEXT_PUBLIC_GTM_ID?.trim();
  return value && GTM_ID_PATTERN.test(value) ? value : null;
}
