/**
 * Local dashboard preview for visual QA: `next dev` with VELTO_ADMIN_PREVIEW=1
 * signs in a preview admin and serves clearly labelled synthetic data.
 *
 * It can never run in a deployed site: `next build`/`next start` (and every
 * Vercel deployment) run with NODE_ENV=production, where this is always false.
 */
export const isAdminPreview = () =>
  process.env.NODE_ENV === "development" && process.env.VELTO_ADMIN_PREVIEW === "1";
