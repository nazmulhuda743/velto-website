/** Vercel rejects function request bodies over 4.5 MB before our code runs, so uploads stay under it. */
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
export const MAX_UPLOAD_LABEL = "4 MB";
